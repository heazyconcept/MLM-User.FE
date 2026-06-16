# Backend Issue: Wallet Transfers Blocked From REGISTRATION Wallet

Date: 2026-06-08  
Area: Wallet Transfer (`POST /wallets/transfer`)

## Summary

When attempting to transfer funds from the `REGISTRATION` wallet to another wallet (such as the `VOUCHER` or `CASH` wallet), the backend API returns a `400 Bad Request` with the message: `"Transfers can only be made from CASH (withdrawal) wallet"`.

To support the requirement where users can transfer funds from their registration wallet (e.g., when they have unused registration funds and want to move them to product vouchers or cash), the backend needs to permit `fromWalletType: 'REGISTRATION'` in transfer requests.

## Exact Error Response

```json
{
  "statusCode": 400,
  "message": ["Transfers can only be made from CASH (withdrawal) wallet"],
  "error": "Bad Request",
  "timestamp": "2026-06-08T08:56:51.183Z",
  "path": "/wallets/transfer"
}
```

## Reproduction Steps

1. Go to the Wallet page.
2. Under the **Registration Wallet** row, click **Transfer**.
3. In the transfer modal:
   - Select **Transfer from**: `Registration Wallet`
   - Select **Move to**: `Product Voucher Wallet` (or `Cash Wallet`)
   - Enter an amount (e.g., `1000`).
4. Click **Transfer** to submit the request.
5. Observe the API returns `400 Bad Request` with the error above.

## API Request Context

- **Endpoint**: `POST https://api.segulah.ng/wallets/transfer`
- **Request Payload Example**:
  ```json
  {
    "fromWalletType": "REGISTRATION",
    "toWalletType": "VOUCHER",
    "amount": 1000,
    "currency": "NGN"
  }
  ```

## Frontend Status

The frontend has been fully integrated to allow dynamic selection of both source (`fromWalletType`) and target (`toWalletType`) wallets in the transfer modal. It correctly sends the parameters to `POST /wallets/transfer` based on the user's choices. It is currently blocked by this validation constraint on the backend.

## Backend Changes Requested

1. Update the transfer validation logic in the backend `wallets/transfer` service to allow `fromWalletType` to be either `CASH` or `REGISTRATION`.
2. Ensure that transferring _from_ `REGISTRATION` correctly debits the registration wallet balance and credits the specified destination wallet balance (`VOUCHER` or `CASH`).
3. Ensure transfer ledger logs are recorded accurately for the registration-sourced transfer transactions.

## Expected Behavior

Users should be able to transfer funds between their own wallets (from either `CASH` or `REGISTRATION` source) as long as they have sufficient balance in the selected source wallet for the transaction currency.
