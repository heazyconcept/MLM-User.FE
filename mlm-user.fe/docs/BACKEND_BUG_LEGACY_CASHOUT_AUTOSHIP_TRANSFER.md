# Backend Bug: Legacy Cashout Transfer to AUTOSHIP Credits Wrong Wallet

**Date:** 2026-09-23  
**From:** User FE (`mlm-user.fe`)  
**Status:** Resolved — backend + FE verified (2026-09-24)  
**Severity:** High  
**Area:** `POST /legacy/cashout/transfer`

**Related docs:**

- Legacy cashout transfer samples: [`legacy-api-samples/README.md`](./legacy-api-samples/README.md)
- Phase 1 integration: [`../legacy-club update/phase-1-frontend-integration.md`](../legacy-club%20update/phase-1-frontend-integration.md) (§4.9)
- FE cashout page: [`legacy-cashout.component.ts`](../src/app/pages/legacy-club/legacy-cashout/legacy-cashout.component.ts)
- FE transfer remap: [`legacy-club.service.ts`](../src/app/services/legacy-club.service.ts) (`transferCashout`, `resolveLegacyCashoutTransferTarget`)

---

## Summary

Legacy Club has **no separate Legacy Autoship wallet** in the member UI. Marketplace checkout uses **Legacy product voucher** (`LEGACY_VOUCHER`) only.

When a member transfers from Legacy cashout with `toWalletType: "AUTOSHIP"`, the backend credits the member's **network** Autoship wallet. That balance is not shown anywhere in Legacy Club, so the transfer appears to vanish (reported example: ₦4,000).

**Product rule:** Any Legacy cashout transfer intended for Autoship must credit **Legacy product voucher**, not network `AUTOSHIP`.

---

## Affected endpoints

### Transfer

```http
POST /legacy/cashout/transfer
Authorization: Bearer <token>
Content-Type: application/json
```

### Cashout history (ledger)

```http
GET /legacy/cashout
Authorization: Bearer <token>
```

Each successful transfer must appear in the **`items`** ledger returned by `GET /legacy/cashout` (History panel on the Legacy Cashout page). Members use this list to confirm moves out of Legacy cashout.

**Example request (problematic target):**

```json
{
  "toWalletType": "AUTOSHIP",
  "amount": 4000,
  "currency": "NGN",
  "pin": "1234"
}
```

**Current behavior:** Funds leave Legacy cashout and are credited to the network `AUTOSHIP` wallet.

**Expected behavior:** Funds are credited to **Legacy product voucher** (`LEGACY_VOUCHER`), or `AUTOSHIP` is treated as an alias for `LEGACY_VOUCHER` on this endpoint.

---

## Why this matters

| Wallet | Visible in Legacy UI | Used for Legacy marketplace |
|--------|----------------------|-----------------------------|
| Network `AUTOSHIP` | No | No |
| `LEGACY_VOUCHER` | Yes (`/legacy/home`, `/legacy/voucher`) | Yes (`POST .../pay-wallet` with `LEGACY_VOUCHER`) |

Members expect Autoship-related Legacy earnings to fund Legacy marketplace purchases via the product voucher balance.

---

## Frontend mitigation (shipped)

The member app remaps the target before calling the API:

```typescript
// resolveLegacyCashoutTransferTarget in legacy-club.models.ts
AUTOSHIP → LEGACY_VOUCHER
```

- The cashout UI no longer offers a standalone “Autoship” destination; **Legacy product voucher** is the Autoship-equivalent target.
- Helper copy on the cashout page states there is no separate Legacy Autoship wallet.

This fixes **new** transfers from updated clients. It does **not** recover funds already credited to network `AUTOSHIP`.

---

## Backend action items

1. **Server-side alias:** When `toWalletType === "AUTOSHIP"` on `POST /legacy/cashout/transfer`, credit `LEGACY_VOUCHER` (same as explicit `LEGACY_VOUCHER`), or reject `AUTOSHIP` with a clear message pointing to `LEGACY_VOUCHER`.
2. **Document** allowed `toWalletType` values for Legacy cashout: `CASH`, `VOUCHER`, `LEGACY_VOUCHER` (and whether `AUTOSHIP` remains as a deprecated alias).
3. **Ledger / history:** On every successful transfer (and withdraw), append a **Debit** row to the Legacy cashout ledger returned by `GET /legacy/cashout` → `items[]`. Without this, the member History panel stays empty or incomplete after a move.
4. **Ledger copy:** Use member-facing descriptions, e.g. `Move to Legacy product voucher` (not raw `AUTOSHIP` or `LEGACY_VOUCHER` enum strings) when the destination is Autoship-equivalent.
5. **Data correction:** Manually move mis-credited balances (e.g. ₦4,000 network Autoship from Legacy cashout transfers) to the member's Legacy product voucher where appropriate. Backfill ledger rows for past transfers if missing.

**Example ledger row after transfer to Legacy product voucher:**

```json
{
  "id": "ledger-uuid",
  "date": "2026-09-23T15:30:00.000Z",
  "description": "Move to Legacy product voucher",
  "type": "Debit",
  "amount": 4000,
  "currency": "NGN"
}
```

---

## Out of scope (separate issue)

Automatic **weekly commission drops** (`nextDueVoucherNet` on `GET /legacy/me`) are unrelated to manual cashout transfers. If weekly Autoship portions also land in the wrong wallet, that requires a separate backend commission-drop fix.

---

## Verification checklist

- [x] `POST /legacy/cashout/transfer` with `toWalletType: "AUTOSHIP"` credits Legacy product voucher (`LEGACY_VOUCHER` alias server-side).
- [x] Legacy cashout balance decreases by the transfer amount.
- [x] Network Autoship balance is **not** increased for this flow (transfer targets `LEGACY_VOUCHER`).
- [x] Explicit `toWalletType: "LEGACY_VOUCHER"` still works unchanged.
- [ ] Past mis-credited transfers documented / corrected for affected members (ops / manual).
- [x] `GET /legacy/cashout` → `items` includes a **Debit** ledger row for each transfer.
- [x] Ledger `description` for voucher moves reads **Move to Legacy product voucher** (FE also humanizes via `humanizeLegacyCashoutLedgerDescription`).

### Verification evidence (code)

| Layer | What was verified |
|-------|-------------------|
| **Backend** | `legacy-club.service.ts` — `AUTOSHIP` aliased to `LEGACY_VOUCHER` before `walletService.transfer`; `legacy-club.service.cashout.spec.ts` covers alias, explicit voucher, and ledger copy |
| **Backend DTO** | `legacy-cashout-transfer.dto.ts` — documents `AUTOSHIP` as deprecated alias |
| **User FE** | `resolveLegacyCashoutTransferTarget()` remaps `AUTOSHIP` → `LEGACY_VOUCHER` before POST; cashout dropdown uses `LEGACY_VOUCHER` only; `legacy-club.service.spec.ts` asserts POST body |
| **User FE UI** | `legacy-cashout.component.ts` — helper copy + ledger humanization on History panel |
