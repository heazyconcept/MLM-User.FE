# Legacy API response shapes (reference)

Captured from [legacy-club-frontend-integration.md](../../../../../Downloads/legacy-club-frontend-integration.md).
Live probe against `https://api.segulah.ng` returned 502 at implementation time — mappers follow the integration spec.

## GET /legacy/me (ACTIVE member excerpt)

```json
{
  "status": "success",
  "data": {
    "status": "ACTIVE",
    "currency": "NGN",
    "lifecycle": {
      "status": "ACTIVE",
      "earningEligible": true,
      "cashoutEligible": true,
      "canReactivate": false,
      "startedAt": "2026-01-01T00:00:00.000Z",
      "earningEndsAt": "2026-07-01T00:00:00.000Z",
      "suspensionDueAt": null,
      "reactivationSecondsRemaining": 0
    },
    "shopMode": "SHOP",
    "pendingPayment": null,
    "canCashoutLegacy": true,
    "cashoutRestrictionReason": null,
    "cycle": {
      "cycleWeeks": 26,
      "issuedCount": 3,
      "nextDueCashoutAmount": 5000,
      "nextDueVoucherNet": 2250
    }
  }
}
```

## GET /legacy/me (PENDING_JOIN with pendingPayment)

```json
{
  "status": "success",
  "data": {
    "status": "PENDING_JOIN",
    "pendingPayment": {
      "purpose": "JOIN",
      "status": "PENDING",
      "paymentRequired": 60000,
      "paymentMethods": ["REGISTRATION_WALLET", "MANUAL_BANK"]
    }
  }
}
```

## POST /legacy/payments/wallet

Request: `{ "purpose": "JOIN", "requestKey": "<uuid>" }` — registration-wallet Legacy payments do **not** require `pin`.

## POST /legacy/payments/manual (multipart)

Fields: `purpose`, `requestKey`, `depositorName`, `evidence`

## POST /legacy/cashout/withdraw

Request body (bank details come from the user's saved profile on the server — do **not** send `bankName`, `accountNumber`, or `accountName`):

```json
{
  "amount": 50000,
  "currency": "NGN",
  "pin": "1234"
}
```

## POST /legacy/cashout/transfer

```json
{
  "toWalletType": "CASH",
  "amount": 10000,
  "currency": "NGN",
  "pin": "1234"
}
```
