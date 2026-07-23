# Backend Request — Manual Payment for Package Upgrade

**Date:** 2026-07-23  
**From:** User FE (`mlm-user.fe`)  
**Status:** Backend shipped — FE integrated  
**Severity:** High  
**Area:** Manual deposits (`POST /payments/manual-deposit`) + package upgrade

**Related frontend:**

- Manual deposit: [`manual-deposit.service.ts`](../src/app/services/manual-deposit.service.ts), [`manual-deposit.component.ts`](../src/app/pages/payments/manual-deposit/manual-deposit.component.ts)
- Package upgrade UI: [`package-upgrade.component.ts`](../src/app/pages/settings/package-upgrade/package-upgrade.component.ts)
- Gateway upgrade (working path): `POST /payments/upgrade/initiate` + verify

---

## 1. Summary

NGN gateway payments (Flutterwave, etc.) are disabled. Users must upgrade packages via **manual bank transfer + admin approval**.

Today, “manual funding” from the package-upgrade screen only creates a normal **wallet deposit**. When an admin approves it:

- Registration (or voucher) wallet is credited
- **User package is not upgraded**

So the user paid as if for an upgrade, but only got a wallet top-up. Frontend cannot fix this safely without backend support.

---

## 2. Current behaviour (problem)

```text
Package upgrade UI
  → POST /payments/manual-deposit
      (walletType, amount, depositorName, evidence only)
  → Admin approves deposit
  → Wallet credited
  → Package unchanged  ✗
```

### What FE sends today

`multipart/form-data`:

| Field | Notes |
|-------|--------|
| `walletType` | `REGISTRATION` \| `VOUCHER` |
| `amount` | number |
| `depositorName` | string |
| `evidence` | file |

FE may show `purpose=upgrade` / `targetPackage=GOLD` in the **URL for UI copy only**. Those values are **not** sent to the API and are ignored on approve.

### Observed result

User completes manual payment from upgrade flow → admin approves → balance increases → package stays the same.

---

## 3. Desired behaviour

```text
Package upgrade UI
  → POST /payments/manual-deposit
      + purpose=PACKAGE_UPGRADE
      + targetPackage=GOLD (example)
  → Admin sees “Package upgrade → GOLD” on the deposit
  → Admin approves
  → Same side effects as a successful gateway package upgrade
      (package updated, upgrade payment/ledger recorded as appropriate)
  → User package is GOLD  ✓
```

Wallet-only funding must keep working unchanged when purpose is omitted or is wallet funding.

---

## 4. Recommended API design

### 4.1 Extend create deposit

**Endpoint:** `POST /payments/manual-deposit` (existing)

**Additional optional fields** (multipart or documented form fields):

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `purpose` | enum | No (default `WALLET_FUNDING`) | `WALLET_FUNDING` \| `PACKAGE_UPGRADE` |
| `targetPackage` | enum | Yes if `purpose=PACKAGE_UPGRADE` | e.g. `SILVER` \| `GOLD` \| `PLATINUM` \| `RUBY` \| `DIAMOND` |

Suggested validation when `purpose=PACKAGE_UPGRADE`:

1. User is authenticated and registration-paid (same gate as `POST /payments/upgrade/initiate`).
2. `targetPackage` is a valid **upgrade** relative to the user’s current package (no downgrade / same package).
3. `amount` matches (or meets) the upgrade price for that package and the user’s currency (same source of truth as upgrade options / `GET` upgrade-options).
4. Reject if user already has a conflicting pending upgrade deposit (product rule TBD — recommend one pending `PACKAGE_UPGRADE` at a time).

Suggested `walletType` for upgrades: **`REGISTRATION`** (FE will send this). Confirm if voucher is allowed; prefer registration only for upgrades.

### 4.2 Persist intent on the deposit record

Store on the manual deposit (and expose on list/detail for admin + user):

```json
{
  "id": "uuid",
  "walletType": "REGISTRATION",
  "amount": 90000,
  "currency": "NGN",
  "purpose": "PACKAGE_UPGRADE",
  "targetPackage": "GOLD",
  "status": "PENDING",
  "depositorName": "Jane Doe",
  "evidenceUrl": "...",
  "createdAt": "..."
}
```

For `WALLET_FUNDING`, `targetPackage` is null/omitted.

### 4.3 Admin approve behaviour

**On approve of `WALLET_FUNDING`:** keep current behaviour (credit wallet only).

**On approve of `PACKAGE_UPGRADE`:**

1. Apply package upgrade to `targetPackage` with the **same business side effects** as a verified gateway upgrade payment (`POST /payments/upgrade/initiate` → verify), including commissions / IPV / receipts / payment type `UPGRADE` if that is how gateway upgrades are recorded.
2. Do **not** leave the user on the old package with only a wallet credit.
3. Clarify ledger rule (pick one and document it):
   - **A (preferred):** Treat as upgrade payment settlement — upgrade package; do not also leave a free spendable wallet credit of the full upgrade amount (unless product requires both).
   - **B:** Credit registration wallet **and** immediately debit it to settle the upgrade (wallet moves, package updates).

Frontend needs a deterministic outcome: after approve, `GET /users/me` (or profile) shows the new package.

**On reject:** same as today (no package change; optional rejection reason).

### 4.4 Admin UI / list APIs

Admin pending-deposit list and detail must show:

- `purpose`
- `targetPackage` (when upgrade)
- amount / currency / evidence

So reviewers know they are approving an **upgrade**, not a casual wallet top-up.

### 4.5 User list/detail

`GET /payments/manual-deposit` (user) should return `purpose` and `targetPackage` so the FE can show “Upgrade to Gold — Pending” in history.

---

## 5. Alternative (not preferred)

`POST /payments/upgrade/from-wallet` after a normal wallet deposit:

1. User funds wallet via manual deposit  
2. User calls upgrade-from-wallet  

This still needs backend work and is a worse UX (two steps, easy to fund without upgrading). **Intent on the deposit + upgrade on approve** is preferred.

---

## 6. Frontend plan (after backend ships)

**Done (user FE):**

1. Package upgrade navigates with `purpose=PACKAGE_UPGRADE` + `targetPackage`.
2. Manual deposit submit sends those fields in FormData for upgrade intent.
3. Wallet funding continues to omit purpose (backend defaults to `WALLET_FUNDING`).
4. History shows upgrade purpose; poll on approve refreshes profile and notifies the user.

---

## 7. Acceptance criteria

- [ ] Creating a manual deposit with `purpose=PACKAGE_UPGRADE` and valid `targetPackage` succeeds and stores intent.
- [ ] Invalid package / amount / eligibility returns `400` with a clear message.
- [ ] Admin approve of upgrade deposit updates user package (verified via profile).
- [ ] Admin approve of wallet-funding deposit does **not** change package.
- [ ] Admin reject never changes package.
- [ ] Gateway upgrade path remains unchanged.
- [ ] User and admin deposit APIs expose `purpose` and `targetPackage`.

---

## 8. Open questions for backend

1. Exact enum names: `PACKAGE_UPGRADE` vs `UPGRADE`, package enum alignment with existing upgrade DTO.  
2. Ledger choice on approve: **A** (settle as upgrade payment) vs **B** (credit then debit wallet). Prefer **A** unless finance requires wallet movement.  
3. Should upgrade manual deposits create a `Payment` row with `type=UPGRADE` for receipts/history consistency?  
4. One pending upgrade deposit per user — hard rule?  
5. Exact amount matching: exact match only, or allow overpayment (and what happens to excess)?

---

## 9. Severity / why now

Flutterwave (and other NGN gateways) are turned off in the user app. Package upgrade for NGN users effectively depends on manual payment. Without approve-time upgrade, users pay and do not receive the package they selected.
