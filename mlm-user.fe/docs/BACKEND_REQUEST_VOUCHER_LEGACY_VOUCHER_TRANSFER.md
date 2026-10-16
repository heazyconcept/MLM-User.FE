# Backend Request — Product Voucher ↔ Legacy Product Voucher (Same Member)

**Date:** 2026-10-15  
**From:** Product / User FE  
**Priority:** **Urgent** (ship before 1 Nov 2026 cashout gate)  
**Status:** **Not shipped** — specification for HerbApi team  
**Area:** Same-user wallet transfer — `POST /wallets/transfer`  
**Endpoint:** `POST /wallets/transfer` (`HerbApi/src/modules/wallet/wallet.controller.ts` → `wallet.service.ts` `transfer()`)

**Related docs:**

- [BACKEND_REQUEST_LEGACY_VOUCHER_AND_CASHOUT_FUNDING.md](./BACKEND_REQUEST_LEGACY_VOUCHER_AND_CASHOUT_FUNDING.md) — funding into Legacy voucher from Cash/Registration (unchanged scope)
- [BUSINESS_RULE_VOUCHER_CASHOUT_GATE_2026-11-01.md](./BUSINESS_RULE_VOUCHER_CASHOUT_GATE_2026-11-01.md) — separate rule effective 1 Nov 2026 (not part of this request)

---

## 1. Summary

Members have **two different product voucher wallets**:

| Wallet type (API) | Member-facing name | Used for |
|-------------------|-------------------|----------|
| `VOUCHER` | **Network Product Voucher** | Main / network marketplace orders |
| `LEGACY_VOUCHER` | **Legacy product voucher** | Legacy Club marketplace only |

**Product rule (urgent):** Allow a member to **move money between these two wallets only** — same user, either direction — so they can **combine balances** before placing an order (e.g. ₦70k network + ₦60k Legacy → move funds to one wallet → pay for a ₦120k product).

**Still forbidden:**

- Transfer **from** Product Voucher **to** Cash, Registration, Autoship, Legacy cashout, or **any other wallet** (except Legacy product voucher).
- Transfer **from** Legacy product voucher **to** anything except **network Product Voucher**.
- **Peer** transfers using Product Voucher or Legacy product voucher (`POST /wallets/fund-transfer`) — **no change**; sources remain **CASH** and **REGISTRATION** only.

---

## 2. Client requirement (source of truth)

1. “You can only transfer from product voucher **to product voucher**.”
2. “From your **network** product voucher account to your **Legacy** product voucher account” — **and vice versa**.
3. “Not from product voucher to any other wallet.”
4. Member-to-member voucher sends remain **not** allowed.

---

## 3. Current backend behavior (gap)

### 3.1 `POST /wallets/transfer` — partial support

In `HerbApi/src/modules/wallet/wallet.service.ts` `transferTargets` today:

| From | Allowed to (today) |
|------|---------------------|
| `CASH` | `REGISTRATION`, `VOUCHER`, `LEGACY_VOUCHER` |
| `REGISTRATION` | `VOUCHER`, `CASH`, `LEGACY_VOUCHER` |
| **`VOUCHER`** | **`LEGACY_VOUCHER` only** ✅ |
| **`LEGACY_VOUCHER`** | **Not a allowed source** ❌ |
| `LEGACY_CASHOUT` | `CASH`, `VOUCHER`, `LEGACY_VOUCHER`, `REGISTRATION` |

**Gap:** Implement **`LEGACY_VOUCHER` → `VOUCHER`** (Legacy product voucher → network Product Voucher).

**Keep:** **`VOUCHER` → `LEGACY_VOUCHER`** (already in matrix). Verify in staging that it works end-to-end for active Legacy members.

### 3.2 Legacy membership

Inbound to **`LEGACY_VOUCHER`** from network wallets (including **`VOUCHER`**) already calls `assertActiveLegacyMember` (`NOT_LEGACY_MEMBER` if not active).

**Recommendation for `LEGACY_VOUCHER` → `VOUCHER`:** Require **active Legacy Club membership** (same as other Legacy wallet operations). Do **not** allow this path for users with no Legacy membership / no Legacy voucher wallet.

### 3.3 Ledger validation (align with transfer path)

`HerbApi/src/modules/wallet/ledger/utils/wallet-type-ledger-validation.util.ts`:

- **`VOUCHER` debit:** Today only `PRODUCT_PURCHASE` (and admin undo) is allowed; **`TRANSFER` is rejected** if validation runs on that path.
- **`LEGACY_VOUCHER` debit:** `PRODUCT_PURCHASE` and **`TRANSFER`** are already allowed.

**Action:** Allow **`VOUCHER` + `LedgerSource.TRANSFER` + `DEBIT`** for same-user voucher-bridge transfers (so any code path using `validateDebitWalletType` stays consistent with `wallet.service.transfer`, which writes `TRANSFER` ledger rows).

**Action:** Confirm **`VOUCHER` credit** from **`TRANSFER`** is allowed (no extra block needed for credit side today).

### 3.4 `POST /wallets/fund-transfer` — do not change

`HerbApi/src/modules/wallet/fund-transfer.service.ts` — sources **`CASH`** and **`REGISTRATION`** only. **Do not** add `VOUCHER` or `LEGACY_VOUCHER` to `FUND_TRANSFER_TARGETS`.

---

## 4. Required implementation

### 4.1 Transfer matrix (target state)

Same-user only (`fromWallet.userId === toWallet.userId`). Amount & currency unchanged (must match **source** wallet `displayCurrency`).

| From | To | Allowed |
|------|-----|---------|
| `VOUCHER` | `LEGACY_VOUCHER` | Yes |
| `LEGACY_VOUCHER` | `VOUCHER` | **Yes (new)** |
| `VOUCHER` | anything else | No |
| `LEGACY_VOUCHER` | anything except `VOUCHER` | No |

All other existing `transferTargets` rows (CASH, REGISTRATION, LEGACY_CASHOUT, etc.) **unchanged**.

Update:

- `transfer()` in **`wallet.service.ts`**
- Error message when `fromWalletType` is invalid (include **`LEGACY_VOUCHER`** as a source where applicable)
- **`HerbApi/src/modules/wallet/dto/transfer-wallet.dto.ts`** — Swagger / description text

### 4.2 Ledger rows (unchanged pattern)

Continue using paired entries, `LedgerSource.TRANSFER`, references `XFER-{transferId}-OUT` / `-IN`, metadata:

```json
{
  "transferId": "<uuid>",
  "fromWalletType": "VOUCHER",
  "toWalletType": "LEGACY_VOUCHER"
}
```

(on debit: include `toWalletType`; on credit: include `fromWalletType` — match existing `wallet.service.transfer` behavior.)

### 4.3 Human-readable descriptions (recommended)

Update ledger / activity formatters so members see clear text, e.g.:

- VOUCHER → LEGACY_VOUCHER: **“Move to Legacy product voucher”** (may exist)
- LEGACY_VOUCHER → VOUCHER: **“Move to network Product Voucher”** (new)

Files to check: `HerbApi/src/modules/earnings/utils/format-ledger-activity-description.util.ts`, `HerbApi/src/modules/dashboard/utils/ledger-transaction-description.util.ts`.

### 4.4 Tests

Extend **`HerbApi/src/modules/wallet/wallet.service.transfer.spec.ts`**:

- **LEGACY_VOUCHER → VOUCHER** success (active Legacy member, sufficient balance, correct ledger DEBIT/CREDIT).
- **LEGACY_VOUCHER → CASH** rejected.
- **VOUCHER → CASH** rejected (regression).
- **VOUCHER → LEGACY_VOUCHER** without active membership → `NOT_LEGACY_MEMBER` (regression).

Extend **`HerbApi/src/modules/wallet/ledger/utils/wallet-type-ledger-validation.util.spec.ts`**:

- **VOUCHER** debit + **TRANSFER** allowed.

---

## 5. API contract (member app)

**Request:** `POST /wallets/transfer`

**Headers:** Bearer auth (member).

**Body example — network → Legacy:**

```json
{
  "fromWalletType": "VOUCHER",
  "toWalletType": "LEGACY_VOUCHER",
  "amount": 5000,
  "currency": "NGN"
}
```

**Body example — Legacy → network (new):**

```json
{
  "fromWalletType": "LEGACY_VOUCHER",
  "toWalletType": "VOUCHER",
  "amount": 5000,
  "currency": "NGN"
}
```

**Success:** `{ "transferId": "<uuid>" }`

**Errors (existing patterns):**

| Condition | Expected |
|-----------|----------|
| Not active Legacy member (when Legacy wallet involved per rules above) | `NOT_LEGACY_MEMBER` |
| Insufficient balance | `Insufficient balance` (JSON body with amounts) |
| Disallowed pair | `Cannot transfer from X to Y` |
| Currency mismatch | Display currency mismatch message |

**No new endpoint.** Member FE will call the same `POST /wallets/transfer` once backend ships.

---

## 6. Out of scope (this request)

- Nov 2026 **₦10,000 Product Voucher cashout gate** — see [BUSINESS_RULE_VOUCHER_CASHOUT_GATE_2026-11-01.md](./BUSINESS_RULE_VOUCHER_CASHOUT_GATE_2026-11-01.md).
- Single checkout debiting **both** vouchers automatically — members transfer first, then pay from one wallet.
- Admin reports (member transfer report already lists `FUND_TRANSFER`; same-user `TRANSFER` between voucher types may appear in member ledger/history only unless product asks for admin report later).
- Changing **LEGACY_CASHOUT** transfer matrix.

---

## 7. Acceptance criteria

- [ ] Active Legacy member with ₦70,000 **network** voucher and ₦60,000 **Legacy** voucher can move any amount (≤ source balance) **VOUCHER → LEGACY_VOUCHER** and **LEGACY_VOUCHER → VOUCHER**.
- [ ] Balances update correctly; ledger shows paired TRANSFER rows with correct metadata.
- [ ] **VOUCHER → CASH** (and other non-voucher targets) still **rejected**.
- [ ] **LEGACY_VOUCHER → LEGACY_CASHOUT** (and other non-VOUCHER targets) **rejected**.
- [ ] **`POST /wallets/fund-transfer`** cannot use **VOUCHER** or **LEGACY_VOUCHER** as source (unchanged).
- [ ] Unit/integration tests cover new path and regressions.

---

## 8. Member FE follow-up (separate ticket)

After backend is deployed, User FE will add UI (“Move between product vouchers”) on wallet / Legacy voucher pages calling `POST /wallets/transfer`. **No FE change is required for backend to ship and test via API.**

---

## 9. Change log

| Date | Change |
|------|--------|
| 2026-10-15 | Initial backend handoff from product discussion. |
