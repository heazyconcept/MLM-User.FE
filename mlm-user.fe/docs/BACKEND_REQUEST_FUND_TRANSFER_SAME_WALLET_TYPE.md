# Backend Request — Allow Same Wallet Type on Cross-User Fund Transfer

**Date:** 2026-07-11  
**From:** User FE (`mlm-user.fe`)  
**Status:** Business rule change — blocked by backend validation  
**Severity:** Medium  
**Area:** Fund transfer (`POST /wallets/fund-transfer`)

**Related docs:**

- [BACKEND_BUG_TRANSFER_SOURCE_REGISTRATION.md](./BACKEND_BUG_TRANSFER_SOURCE_REGISTRATION.md) — intra-user transfer from `REGISTRATION` (`POST /wallets/transfer`)
- Fund transfer UI: [`fund-transfer.component.ts`](../src/app/pages/wallet/fund-transfer/fund-transfer.component.ts)
- Target wallet rules: [`fund-transfer.constants.ts`](../src/app/core/constants/fund-transfer.constants.ts)

---

## 1. Summary

`POST /wallets/fund-transfer` currently rejects requests where `fromWalletType` and `toWalletType` are the same, even when the sender and recipient are **different users**.

This blocks a valid use case: transferring from the sender's **Registration wallet** to the recipient's **Registration wallet** (e.g. helping another member fund activation/upgrade).

The frontend has been updated to allow this. The backend must align its validation with the rule below.

---

## 2. Current error

```json
{
  "statusCode": 400,
  "message": ["Source and target wallet must differ"],
  "error": "Bad Request",
  "timestamp": "2026-07-11T19:17:54.080Z",
  "path": "/wallets/fund-transfer"
}
```

### Reproduction

1. Log in as a paid member with balance in their Registration wallet.
2. Open **Wallet → Fund Transfer** (`/wallet/fund-transfer`).
3. Set **Transfer from** = `Registration Wallet`.
4. Set **Transfer to** = `Registration wallet`.
5. Enter a recipient username (not your own) and a valid amount + PIN.
6. Submit → backend returns `400` with message above.

### Example request body (should succeed)

```json
{
  "recipientUsername": "Oluwapelumi",
  "fromWalletType": "REGISTRATION",
  "toWalletType": "REGISTRATION",
  "amount": 5000,
  "currency": "NGN",
  "pin": "1234"
}
```

---

## 3. Required business rule

| Scenario | `fromWalletType` | `toWalletType` | Sender | Recipient | Should allow? |
|----------|------------------|----------------|--------|-----------|---------------|
| Cross-user, same wallet type | `REGISTRATION` | `REGISTRATION` | User A | User B | **Yes** |
| Cross-user, same wallet type | `CASH` | `CASH` | User A | User B | **Yes** |
| Cross-user, different types | `REGISTRATION` | `CASH` | User A | User B | Yes (already works) |
| Self-transfer (any wallets) | any | any | User A | User A | **No** |

**Rule in plain language:**

- `fromWalletType` and `toWalletType` describe **which wallet bucket** on each user's account is debited/credited.
- They **may be the same** when `recipientUsername` is a **different** user.
- Reject only when the authenticated user is the recipient (**self-transfer**), regardless of wallet types.

The old rule “source and target wallet must differ” applies to **intra-user** wallet moves (`POST /wallets/transfer`), not to **cross-user** fund transfers.

---

## 4. Backend changes requested

1. **Relax validation** on `POST /wallets/fund-transfer`:
   - Remove or narrow the check that rejects `fromWalletType === toWalletType`.
   - Keep rejecting self-transfers: `recipientUsername` must not equal the authenticated user's username (case-insensitive).

2. **Ledger / balance updates** for same-type cross-user transfers:
   - Debit sender's wallet of type `fromWalletType` in `currency`.
   - Credit recipient's wallet of type `toWalletType` in `currency`.
   - Example: `REGISTRATION` → `REGISTRATION` debits sender registration balance, credits recipient registration balance.

3. **Supported combinations** (frontend now exposes all of these for cross-user transfer):

   | Source (`fromWalletType`) | Allowed targets (`toWalletType`) |
   |---------------------------|----------------------------------|
   | `CASH` | `CASH`, `REGISTRATION`, `VOUCHER`, `AUTOSHIP` |
   | `REGISTRATION` | `REGISTRATION`, `CASH`, `VOUCHER`, `AUTOSHIP` |

4. **Error responses** (unchanged except self-transfer case):

   | Case | Suggested `400` message |
   |------|-------------------------|
   | Self-transfer | `You cannot transfer funds to yourself` |
   | Insufficient balance | Existing insufficient-balance payload |
   | Invalid PIN | Existing PIN error |
   | Recipient not found | Existing not-found message |

---

## 5. Frontend status

| Item | Status |
|------|--------|
| Registration → Registration in **Transfer to** dropdown | Done |
| Cash → Cash in **Transfer to** dropdown | Done |
| Block self-transfer by username | Done |
| Removed client-side “source and target must differ” rule for cross-user | Done |

Frontend will send the request as-is once backend accepts it. No further FE changes expected after backend deploy.

---

## 6. Acceptance criteria

- [ ] `POST /wallets/fund-transfer` with `fromWalletType: REGISTRATION`, `toWalletType: REGISTRATION`, different `recipientUsername` returns **201** (or success) with `transferId`.
- [ ] Sender registration balance decreases; recipient registration balance increases by `amount` in `currency`.
- [ ] Same for `CASH` → `CASH` cross-user transfer.
- [ ] Self-transfer (`recipientUsername` = current user) still returns **400**.
- [ ] Intra-user `POST /wallets/transfer` behavior unchanged (source ≠ target on same account).

---

## 7. Test plan (backend)

1. User A → User B: `REGISTRATION` → `REGISTRATION`, amount within balance → success.
2. User A → User B: `CASH` → `CASH` → success.
3. User A → User A (any wallet pair) → `400` self-transfer.
4. User A → User B: `REGISTRATION` → `CASH` → still succeeds (regression).
5. Verify ledger entries reference correct wallet types and both user IDs.
