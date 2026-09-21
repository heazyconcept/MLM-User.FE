# Backend Bug Report — Checkout Debits Cash Instead of Selected Voucher Wallet

**Date:** 2026-04-20  
**From:** Frontend (`your-frontend-app`)  
**Status:** Open  
**Severity:** High  
**Area:** Orders and Wallets  
**Endpoints:** `POST /orders/:id/pay-wallet`

**Related FE:**

- [`product-detail.page.ts`](../src/app/pages/shop/product-detail.page.ts)
- [`order.service.ts`](../src/app/services/order.service.ts)

---

## 1. Summary

When a user selects Voucher as the payment wallet for a product purchase, the backend still debits Cash in some cases. This causes wallet mismatch, user distrust, and incorrect balances.

## 2. User impact

- User explicitly selects Voucher at checkout.
- Purchase appears to process under the wallet payment flow.
- Cash balance is reduced instead of Voucher balance.

## 3. Reproduction steps

1. Log in with a user that has sufficient Voucher balance and a visible Cash balance.
2. Open Marketplace → product detail.
3. Choose **Voucher** under Pay With.
4. Complete fulfilment selection and confirm the order.
5. Observe resulting wallet balances.

## 4. Actual vs expected

| | |
|--|--|
| **Actual** | Cash wallet is debited even though Voucher was selected. Sometimes `400 Insufficient balance` on `/orders/{id}/pay-wallet`. |
| **Expected** | Validate and debit the selected Voucher wallet only; leave Cash unchanged. |

## 5. Evidence

### Request

- **Endpoint:** `POST /orders/:id/pay-wallet`
- **Body:**

```json
{
  "walletType": "VOUCHER"
}
```

### Response (failing scenario)

```json
{
  "statusCode": 400,
  "message": "Insufficient balance",
  "path": "/orders/ord_123/pay-wallet"
}
```

### Observed state at failure time

- Voucher balance: sufficient for the order total
- Cash balance: also non-zero
- Selected wallet in UI: Voucher

## 6. Frontend verification

Frontend already:

- Creates the order with `paymentMethod: "WALLET"`
- Sends `walletType` on pay-wallet: `voucher → VOUCHER`, `autoship → AUTOSHIP`, `cash → CASH`

Code references:

- `product-detail.page.ts` — passes selected wallet into pay call
- `order.service.ts` — pay-wallet payload includes `walletType`

## 7. Suspected backend issues

1. `POST /orders/:id/pay-wallet` ignores `walletType` and defaults to `CASH`.
2. Debit happens during order create (before pay-wallet) with default Cash behavior.
3. Enum parsing mismatch (`VOUCHER` not recognized → silent fallback to Cash).

## 8. Suggested backend checks

1. Confirm request body parsing includes `walletType`.
2. Log the resolved wallet used for each debit.
3. Ensure no debit at order creation when `paymentMethod` is `WALLET`.
4. Reject unknown/missing `walletType` with `400` instead of falling back to Cash.
5. Add tests for `CASH`, `VOUCHER`, and `AUTOSHIP`.

## 9. Minimal contract

For `POST /orders/:id/pay-wallet`:

| Field | Type | Required | Meaning |
|-------|------|----------|---------|
| `walletType` | string enum | yes | `CASH` \| `VOUCHER` \| `AUTOSHIP` |

If missing or invalid: return `400` with an explicit message; do not attempt a fallback debit.

## 10. Acceptance criteria

- [ ] Selecting Voucher debits Voucher only
- [ ] Selecting Autoship debits Autoship only
- [ ] Selecting Cash debits Cash only
- [ ] No implicit fallback to Cash when `walletType` is provided
- [ ] Balance validation checks the selected wallet only

## 11. Out of scope

- Changing FE wallet picker UX
- New wallet types beyond the three listed above

## 12. Changelog

| Date | Author | Change |
|------|--------|--------|
| 2026-04-20 | Frontend | Initial report |
