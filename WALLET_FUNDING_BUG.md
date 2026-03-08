# Payment Initiate – Missing `gatewayUrl`

Two payment initiate endpoints return no gateway redirect URL when `provider` is `PAYSTACK` or `FLUTTERWAVE`. Without it, the frontend cannot redirect users to complete payment.

---

## 1. Wallet Funding

**Endpoint:** `POST /payments/wallet-funding/initiate`

### Current Response

```json
{
  "paymentId": "30474b52-a9e2-4cd8-bc0d-4f3260b57a7e",
  "reference": "1ddc7693-f431-4be1-976f-530d2036c3c1",
  "amount": 10000,
  "currency": "NGN"
}
```

---

## 2. Package Upgrade

**Endpoint:** `POST /payments/upgrade/initiate`

### Current Response

```json
{
  "paymentId": "c029589b-d697-4ae2-84ce-5f576d1eb122",
  "reference": "8664f166-5d56-4305-8633-f9da96dfb59d",
  "amount": 90000,
  "currency": "NGN"
}
```

---

## Required (both endpoints)

For `provider: "PAYSTACK"` or `provider: "FLUTTERWAVE"`, include one of:

- `gatewayUrl` – URL to redirect the user to complete payment
- `authorizationUrl` – same purpose (Paystack naming)

Example:

```json
{
  "paymentId": "...",
  "reference": "...",
  "amount": 90000,
  "currency": "NGN",
  "gatewayUrl": "https://checkout.paystack.com/..."
}
```

## Impact

Users cannot complete NGN card/bank payments via Paystack or Flutterwave. They only see a reference with no way to pay.
