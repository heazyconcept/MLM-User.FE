# Backend Bug: Cash Wallet Transfers Return 400 Insufficient Balance

Date: 2026-04-20  
Area: Wallet Transfer (Cash -> Registration/Voucher/Autoship)

## Summary

When attempting to transfer funds from Cash Wallet to any non-cash wallet, backend returns 400 Bad Request with Insufficient balance, even when user cash balance is clearly higher than requested transfer amount.

## Exact Error

{
  "statusCode": 400,
  "message": [
    "Insufficient balance"
  ],
  "error": "Bad Request",
  "timestamp": "2026-04-20T15:50:46.709Z",
  "path": "/wallets/transfer"
}

## Reproduction

1. Go to Wallet page.
2. Click any transfer action from Cash to another wallet:
  - Voucher Wallet (Top Up)
  - Autoship Wallet (Top Up)
  - Registration Wallet (Pay from Cash)
3. Enter amount 2000.
4. Submit transfer.
5. Observe API response 400 Insufficient balance.

## Observed Balances at Time of Error

- Cash wallet balance: 18000
- Transfer attempt: 2000
- Expected: transfer should succeed
- Actual: 400 Insufficient balance

## Request Context

- Endpoint: POST /wallets/transfer
- Transfer direction(s):
  - CASH -> VOUCHER
  - CASH -> AUTOSHIP
  - CASH -> REGISTRATION

## Frontend Status

Frontend has already been updated to send transfer currency from the selected wallet row (not display preference), so this is no longer caused by display currency mismatch in UI.

## Likely Backend Cause

This now appears to be broader than wallet-type aliasing because failure occurs across multiple destination wallet types.

Most likely causes:

1. Source cash balance lookup is using a different balance bucket than what wallet summary shows (for example base/available/locked mismatch).
2. Source wallet currency validation may still be resolving the wrong wallet bucket before balance check.
3. Transfer service may be applying a shared validation branch that always returns generic Insufficient balance when wallet resolution fails.
4. Wallet type enum normalization may still be partially mismatched (for example PRODUCT_VOUCHER vs VOUCHER), but this no longer explains all observed failures alone.

## Backend Fix Requested

1. Validate source CASH wallet resolution first and return explicit errors when source wallet is not found for the request currency.
2. Validate available transferable balance from the same wallet bucket shown in GET /wallets (avoid mismatch between displayed balance and transfer validation source).
3. Ensure destination wallet enum normalization supports all intended targets consistently: REGISTRATION, VOUCHER/PRODUCT_VOUCHER, AUTOSHIP.
4. Improve error response details for failed transfer checks, including:
   - checked source wallet type
   - checked target wallet type
   - checked currency
   - available balance and requested amount

## Expected Behavior

Transfer should succeed for any supported destination wallet when source cash balance is greater than or equal to transfer amount for the selected currency.

---

# Additional Backend Issue: Product Purchase Credits CPV But Not PV

Date: 2026-04-20  
Area: Product Purchase Earnings (PV and CPV crediting)

## Summary

When a user purchases a product that should credit both PV and CPV, only CPV is credited. PV is not credited/dropped.

## Observed Behavior

- CPV credit is posted successfully.
- PV credit is missing for the same purchase event.

## Expected Behavior

- Both PV and CPV should be credited for products configured to award both values.

## Reproduction

1. Purchase a product that has both PV and CPV configured.
2. Confirm purchase completes successfully.
3. Check earnings/volume updates after processing.
4. Observe that CPV is credited but PV is not credited.

## Backend Investigation Requested

1. Verify product reward configuration for the purchased SKU includes both PV and CPV.
2. Verify purchase-processing service applies both credit operations in the same successful transaction path.
3. Check whether PV credit path is skipped due to validation, mapping, or enum mismatch.
4. Confirm ledger/event emission for PV is being created and persisted.
5. Ensure API responses sent to frontend include both updated PV and CPV values after purchase.