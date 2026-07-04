# BUG: `POST /payments/verify` returns 400 "Currency mismatch"

## Summary

After a successful Paystack payment for registration, the frontend calls `POST /payments/verify` with `{ reference }`. The backend returns **400 Bad Request** with `"Currency mismatch"`, preventing the REGISTRATION wallet from being credited.

---

## Steps to Reproduce

1. Register a new user (e.g. package `SILVER`, currency `NGN`).
2. Navigate to `/auth/activation`.
3. Click **Fund via Paystack**.
4. Frontend calls `POST /payments/registration/initiate` with `{ package: "SILVER", currency: "NGN" }` — **succeeds**, returns `gatewayUrl` and `reference`.
5. User completes payment on Paystack checkout.
6. Paystack redirects to `/auth/payment/callback?reference=<ref>`.
7. Frontend calls `POST /payments/verify` with `{ "reference": "<ref>" }`.
8. Backend returns:

```json
{
  "statusCode": 400,
  "message": ["Currency mismatch"],
  "error": "Bad Request",
  "timestamp": "2026-02-24T21:50:35.630Z",
  "path": "/payments/verify"
}
```

---

## Request / Response Evidence

### Initiate (succeeds)

```
POST /payments/registration/initiate
Body: { "package": "SILVER", "currency": "NGN" }
Response: 201 — { reference, gatewayUrl, amount, currency }
```

### Verify (fails)

```
POST /payments/verify
Body: { "reference": "c208eed6-0f15-45d8-92f1-050ca713a97a" }
Response: 400 — { message: ["Currency mismatch"] }
```

---

## Analysis

### 1. Original issue – 400 "Currency mismatch" (fixed by backend)

The frontend sends only `{ reference }` — no currency field. The mismatch was determined entirely server-side during verification.

Possible backend causes (before fix):

1. **Paystack transaction currency vs payment record currency** — The backend likely calls Paystack's Verify Transaction API internally. If the Paystack transaction was processed in a different currency than what was stored in the payment record, the comparison fails.
2. **Internal USD storage vs display currency** — Per the API doc, wallet balances are stored in **USD internally**. If the verify endpoint compares the payment's `currency` (e.g. `NGN`) against the REGISTRATION wallet's internal currency (`USD`), it would always mismatch for NGN users.
3. **Missing currency conversion during verification** — The initiate step correctly accepts `NGN` as the registration currency, but the verify step may not be applying the same NGN→USD conversion before crediting the wallet.

The backend has now adjusted this so that `/payments/verify` succeeds.

### 2. Current issue – wallet credited with base amount only

After the backend fix, `/payments/verify` returns a successful response such as:

```json
{
  "id": "dfecca96-41d1-48e0-9f77-1fc668b155f2",
  "userId": "05435759-9fea-4b23-9f58-f8e8e6cf8a02",
  "amount": 20000,
  "baseAmount": 20,
  "currency": "NGN",
  "displayCurrency": "NGN",
  "type": "REGISTRATION",
  "provider": "PAYSTACK",
  "reference": "c199d54d-f7ef-4e05-a872-a9e7c3cb5b1b",
  "status": "SUCCESS",
  "metadata": {
    "fxRate": 1000,
    "package": "NICKEL"
  }
}
```

But the registration wallet shows:

```json
{
  "walletId": "54325d08-df54-4072-8016-622b59fb05ca",
  "walletType": "REGISTRATION",
  "currency": "NGN",
  "baseCurrency": "USD",
  "status": "ACTIVE",
  "balance": 20
}
```

Observations:

- `amount` (20,000) is the NGN amount the user paid.
- `baseAmount` (20) is the USD equivalent (`amount / fxRate`, 20,000 / 1,000).
- The wallet reports `currency: "NGN"` and `baseCurrency: "USD"`, but `balance` is **20**, which matches `baseAmount` (USD), not `amount` (NGN).

So the backend is crediting the wallet with the **base amount** (20 USD) while exposing the wallet as if the `balance` were in NGN. This leads to:

- Confusing UX (wallet shows `currency: "NGN", balance: 20` instead of `20,000`).
- A likely failure when checking `balance >= requiredAmount` for activation (required amount for NICKEL in NGN is 20,000).

Required backend fix:

- Decide on a consistent convention:
  - Either store in USD internally and, when returning the wallet with `currency: "NGN"`, convert `baseAmount` back to NGN for `balance` (e.g. 20 → 20,000), or
  - Expose the wallet as `currency: "USD"` when `balance` is in base currency.
- Ensure the activation check uses the same currency/scale for both `balance` and `requiredAmount`.

---

## Expected Behaviour

Per `registration-and-activation-api (1).md` section 3, Step 2:

> **Backend behaviour on success:**
> - Marks payment as SUCCESS and sets `verifiedAt`.
> - **Credits the user's REGISTRATION wallet** with the payment amount.
> - Does **not** set `isRegistrationPaid` or run earnings/CPV/IPV.

The verify endpoint should:
- Look up the payment by `reference`
- Confirm with Paystack that the payment succeeded
- Convert the amount to the wallet's internal currency if needed
- Credit the REGISTRATION wallet
- Return the payment details

---

## Frontend Status

The frontend implementation is correct:
- Initiate sends `{ package, currency }` matching the user's registration values
- Verify sends only `{ reference }` as specified in the API doc
- No `gatewayResponse` or extra fields are sent

**This is a backend-only fix.** No frontend changes are needed once the backend resolves the currency comparison logic in the verify endpoint.

---

## Affected Flow

Registration activation was previously **blocked** because verify failed. After the backend fix, verify succeeds and credits the wallet, but the wallet balance is currently the base amount (20) instead of the full NGN amount (20,000), so activation will still fail if the backend compares `balance` (20) against the NGN activation total (e.g. 20,000).

## Workaround

None from the frontend. Backend must fix the currency validation in the verify endpoint.
