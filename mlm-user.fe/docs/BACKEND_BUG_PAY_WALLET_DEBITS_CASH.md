# Backend Issue Report: Pay-Wallet Debits Cash Instead of Selected Voucher Wallet

Date reported: 2026-04-20
Reported by: Frontend team
Severity: High
Area: Orders and Wallets

## Summary
When a user selects Voucher as the payment wallet for a product purchase, the backend still debits Cash wallet in some cases.

This causes wallet mismatch, user distrust, and incorrect balances.

## User Impact
- User explicitly selects Voucher wallet in checkout.
- Purchase appears to process under wallet payment flow.
- Cash balance is reduced instead of Voucher balance.

## Reproduction Steps
1. Log in with a user that has:
   - Sufficient balance in Voucher wallet
   - Also a visible Cash wallet balance
2. Go to Marketplace.
3. Open a product and choose Voucher under Pay With.
4. Complete fulfilment selection and confirm order.
5. Observe resulting wallet balances.

## Actual Result
Cash wallet is debited even though Voucher was selected.

In one failing scenario, pay-wallet also returned:
- statusCode: 400
- message: Insufficient balance
- path: /orders/{orderId}/pay-wallet

## Expected Result
If user selected Voucher wallet, backend should:
- Validate Voucher wallet balance
- Debit Voucher wallet
- Leave Cash wallet unchanged

## Frontend Verification (Current Implementation)
Frontend currently sends selected wallet type to pay-wallet request.

Request flow:
1. Create order with payment method WALLET
2. Pay order with walletType payload

Frontend mapping sent by pay-wallet call:
- voucher -> VOUCHER
- autoship -> AUTOSHIP
- cash -> CASH

Code references in frontend:
- Selected wallet passed to pay call: src/app/pages/shop/product-detail-page/product-detail-page.component.ts line 193
- pay-wallet payload includes walletType: src/app/services/order.service.ts line 151
- create-order uses paymentMethod WALLET: src/app/pages/shop/product-detail-page/product-detail-page.component.ts line 180

## Suspected Backend Issues
One or more of the following:
1. POST /orders/:id/pay-wallet ignores walletType and defaults to CASH.
2. Wallet debit may happen during POST /orders create step (before pay-wallet), with default CASH behavior.
3. Wallet type enum parsing mismatch (for example VOUCHER not recognized and silently falling back to CASH).
4. Wallet selection is not persisted correctly between order creation and pay-wallet processing.

## Suggested Backend Checks
1. Confirm request body parsing for pay-wallet includes walletType.
2. Log resolved wallet used for debit for each pay-wallet request.
3. Ensure no debit occurs at order creation when paymentMethod is WALLET.
4. Add validation to reject unknown or missing walletType for pay-wallet instead of fallback to CASH.
5. Add automated tests for all wallet types:
   - CASH
   - VOUCHER
   - AUTOSHIP

## Minimal Contract Proposal
For POST /orders/:id/pay-wallet request body:
- walletType must be required
- accepted values: CASH, VOUCHER, AUTOSHIP

If walletType is missing or invalid:
- return 400 with explicit message
- do not attempt fallback debit

## Acceptance Criteria
1. Selecting Voucher in frontend results in Voucher debit only.
2. Selecting Autoship results in Autoship debit only.
3. Selecting Cash results in Cash debit only.
4. No implicit fallback to Cash when walletType is provided.
5. Balance validation checks the selected wallet only.

## Notes
Frontend has already been updated to send walletType explicitly in pay-wallet request. If backend still debits Cash, issue is backend-side wallet resolution or debit timing.