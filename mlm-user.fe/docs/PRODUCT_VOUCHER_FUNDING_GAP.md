# Backend API Gap: Product Voucher Wallet Funding

## Overview
A new business requirement has been identified where members must be able to fund their **Product Voucher Wallet** directly. Currently, the system only supports funding the **Cash Wallet** (and the Registration Wallet for unactivated accounts).

---

## Current Endpoint Configuration

The current wallet funding endpoint:
* **Route:** `POST /payments/wallet-funding/initiate`
* **Current Request DTO (`InitiateWalletFundingDto`):**
  ```typescript
  InitiateWalletFundingDto: {
      amount: number;
      provider: "PAYSTACK" | "FLUTTERWAVE" | "USDT" | "ADMIN" | "DIRECT_ACCOUNT";
  }
  ```

### Limitations:
1. The endpoint has no target `walletType` parameter.
2. Every transaction initiated via this endpoint automatically credits the user's **Cash Wallet** upon successful payment verification. There is no way to specify that a payment should fund the **Voucher Wallet**.

---

## Proposed Solutions for Backend Team

To support this requirement, we propose one of the following two designs:

### Option A: Extend the Existing Funding Endpoint (Recommended)
Add an optional/required `walletType` property to the body of `POST /payments/wallet-funding/initiate`.

**Request Body (`InitiateWalletFundingDto`):**
```json
{
  "amount": 25000,
  "provider": "PAYSTACK",
  "walletType": "VOUCHER" 
}
```
* **`walletType` options:** `CASH` (default) or `VOUCHER`.

---

### Option B: Create a Dedicated Voucher Funding Endpoint
Create a new endpoint specifically for funding product vouchers.

* **Route:** `POST /payments/voucher-funding/initiate`
* **Request Body:**
  ```json
  {
    "amount": 25000,
    "provider": "PAYSTACK"
  }
  ```

---

## Verification & Impact
Once this property or endpoint is added to the API:
1. The frontend's `PaymentService` will be updated to pass the target `walletType` parameter or call the new endpoint.
2. The user will be redirected to complete the payment.
3. Upon calling `POST /payments/verify`, the backend will credit the transaction amount to the user's **Product Voucher Wallet** instead of the **Cash Wallet**.
