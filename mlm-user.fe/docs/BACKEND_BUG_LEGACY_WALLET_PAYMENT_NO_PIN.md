# Backend Bug: Legacy Registration-Wallet Payment Still Requires PIN

**Date:** 2026-09-23  
**From:** User FE (`mlm-user.fe`)  
**Status:** Open — backend fix required  
**Severity:** High  
**Area:** `POST /legacy/payments/wallet` (JOIN / UPGRADE / REACTIVATE)

**Related docs:**

- Legacy API samples: [`legacy-api-samples/README.md`](./legacy-api-samples/README.md)
- FE pay screen: [`legacy-pay.component.ts`](../src/app/pages/legacy-club/legacy-pay/legacy-pay.component.ts)
- FE payment service: [`legacy-payment.service.ts`](../src/app/services/legacy-payment.service.ts)

**Note:** Legacy **cash out** and **move funds** (`/legacy/cashout/*`) should **keep** requiring a Transaction PIN. Only registration-wallet **membership payments** are in scope here.

---

## Summary

Product decision: paying for Legacy Club membership (join, upgrade, reactivate) from the **registration wallet** must **not** require a Transaction PIN.

The frontend sends:

```json
{
  "purpose": "JOIN",
  "requestKey": "<uuid>"
}
```

The backend still validates `pin` as a required 4-digit string and returns **400** when `pin` is omitted.

---

## Observed API error

`POST /legacy/payments/wallet` (2026-09-23, production `api.segulah.ng`):

**Request body:**

```json
{
  "purpose": "JOIN",
  "requestKey": "1b8fa6f4-57ef-4727-b12d-282a832bf7d9"
}
```

**Response (400):**

```json
{
  "statusCode": 400,
  "message": [
    "pin must match /^\\d{4}$/ regular expression",
    "pin must be a string"
  ],
  "error": "Bad Request",
  "timestamp": "2026-09-23T11:10:56.474Z",
  "path": "/legacy/payments/wallet"
}
```

This blocks users from completing Legacy join/upgrade/reactivate payment even when their registration wallet has sufficient balance.

---

## Reproduction

1. Log in as a user with enough balance in the registration wallet.
2. Start Legacy join (or upgrade/reactivate) so `/legacy/pay/:purpose` is available.
3. Choose **Registration wallet** and submit payment.

**Expected:** Payment succeeds with `{ purpose, requestKey }` only.

**Actual:** 400 with PIN validation errors because `pin` is missing from the body.

---

## Expected backend behavior

For `POST /legacy/payments/wallet` when debiting the **registration wallet** for Legacy membership:

| Field | Required | Notes |
|-------|----------|--------|
| `purpose` | yes | `JOIN` \| `UPGRADE` \| `REACTIVATE` |
| `requestKey` | yes | Idempotency key (UUID) |
| `pin` | **no** | Omit from DTO validation; do not require Transaction PIN |

Backend should:

1. Remove `pin` from the required request DTO (or mark it `@IsOptional()` and ignore it when absent).
2. Debit the registration wallet and complete the Legacy payment flow without PIN verification.
3. Continue to return appropriate errors for insufficient balance, duplicate `requestKey`, invalid purpose, etc.

### Out of scope (PIN still required)

These flows should **continue** to require a 4-digit Transaction PIN:

- `POST /legacy/cashout/withdraw`
- `POST /legacy/cashout/transfer`
- Network wallet withdrawals and other cash-movement endpoints

---

## Frontend status

FE updated to match the product decision:

- [`legacy-pay.component.ts`](../src/app/pages/legacy-club/legacy-pay/legacy-pay.component.ts) — no PIN field or PIN setup gate for registration-wallet pay.
- [`legacy-payment.service.ts`](../src/app/services/legacy-payment.service.ts) — sends `{ purpose, requestKey }` only.
- [`LegacyPaymentWalletRequest`](../src/app/core/models/legacy-club.models.ts) — `pin` is optional and not sent.

No further FE workaround is planned. Backend must stop requiring `pin` on this endpoint.

---

## Acceptance checklist (backend)

- [ ] `POST /legacy/payments/wallet` with `{ purpose, requestKey }` and no `pin` succeeds when balance is sufficient.
- [ ] Sending an invalid or missing `pin` does **not** return 400 for registration-wallet Legacy membership payment.
- [ ] `JOIN`, `UPGRADE`, and `REACTIVATE` purposes all work without PIN.
- [ ] Legacy cashout endpoints still require PIN.
- [ ] OpenAPI / `/api/docs-json` updated so `pin` is optional or absent on the wallet payment DTO.

---

## Temporary user workaround (until fixed)

Use **Manual bank** on the Legacy pay screen if available, or ask backend to deploy the PIN-optional change. There is no reliable client-side bypass for DTO validation on `pin`.
