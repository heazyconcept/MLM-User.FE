# Legacy Cashout → Registration wallet

**Date:** 2026-09-25  
**Audience:** Backend + member FE  
**Status:** Member FE wired; **backend must accept `REGISTRATION`**

---

## 1. Purpose

Allow Legacy Club members to move funds from **LEGACY_CASHOUT** to their **Network registration wallet** (`REGISTRATION`), so they can fund Segulah registration, Legacy join payments, Successline registration, etc.

---

## 2. API

Existing endpoint — no new route.

```http
POST /legacy/cashout/transfer
Authorization: Bearer (paid member)
```

**Request body:**

```json
{
  "toWalletType": "REGISTRATION",
  "amount": 5000,
  "currency": "NGN",
  "pin": "1234"
}
```

### Allowed `toWalletType` values

| Value | Credits |
|---|---|
| `CASH` | Network cash wallet |
| `VOUCHER` | Network product voucher |
| `LEGACY_VOUCHER` | Legacy product voucher |
| `AUTOSHIP` | Deprecated alias → credit `LEGACY_VOUCHER` |
| **`REGISTRATION`** | **Network registration wallet** |

**Success `200`:**

```json
{
  "data": {
    "transferId": "uuid"
  }
}
```

---

## 3. Backend behaviour

1. Validate PIN, currency lock, sufficient `LEGACY_CASHOUT` balance (same rules as other transfer targets).
2. **No Successline gate** on Legacy cashout transfers.
3. Debit `LEGACY_CASHOUT`; credit `REGISTRATION` in the same currency.
4. Persist ledger on Legacy cashout side with human-readable copy, e.g. `Move to Registration wallet`, and store `toWalletType: REGISTRATION` in metadata (see `docs/BACKEND_REQUEST_LEGACY_MEMBERSHIP_HISTORY.md`).
5. Persist corresponding credit on registration wallet ledger.
6. Block during admin impersonation (`IMPERSONATION_ACTION_BLOCKED`).

**Errors (reuse existing):** `INSUFFICIENT_BALANCE`, `INVALID_PIN`, `WALLET_LOCKED`, `IMPERSONATION_ACTION_BLOCKED`, invalid `toWalletType`.

---

## 4. Member FE (implemented)

| Location | Change |
|---|---|
| `/legacy/cashout` → Move to another wallet | **Registration wallet** added to destination dropdown |
| `POST /legacy/cashout/transfer` | Sends `toWalletType: "REGISTRATION"` when selected |

---

## 5. QA checklist

- [ ] Transfer from Legacy cashout to Registration wallet succeeds with valid PIN
- [ ] Registration wallet balance increases by transfer amount
- [ ] Legacy cashout balance decreases
- [ ] Ledger shows “Move to Registration wallet” (not `undefined`)
- [ ] Insufficient balance / wrong PIN return expected errors
- [ ] `AUTOSHIP` alias still credits Legacy product voucher only

---

## 6. Related docs

- [phase-1-frontend-integration.md](./phase-1-frontend-integration.md) §4.9
- [phase-1-backend.md](./phase-1-backend.md) §8.2
- [docs/BACKEND_REQUEST_LEGACY_MEMBERSHIP_HISTORY.md](../docs/BACKEND_REQUEST_LEGACY_MEMBERSHIP_HISTORY.md)
