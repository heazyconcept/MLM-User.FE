# Registration and Activation — End-to-End Test Procedure

This document provides step-by-step use cases to test the registration and activation flow as described in [registration-and-activation-api.md](../../registration-and-activation-api.md).

---

## Prerequisites

- Backend API running and reachable (configured in `environment.apiUrl`)
- Paystack test keys configured (for Path A)
- Browser with DevTools Network tab for debugging

---

## Use Case 1: Full Registration + Paystack Activation (Path A)

**Actor:** New user  
**Goal:** Create account and activate via online payment

### Steps

1. **Navigate to registration**
   - Go to `/auth/register` (or click "Sign Up" from login)
   - Verify two-step form: Step 1 (Credentials), Step 2 (Membership)

2. **Step 1 — Account credentials**
   - Enter username (min 3 chars, unique)
   - Enter email (required, valid format)
   - Enter password (min 8 chars, letter, number, symbol)
   - Confirm password (must match)
   - Click "Next Step"

3. **Step 2 — Membership**
   - Select package (NICKEL, SILVER, GOLD, PLATINUM, RUBY, DIAMOND)
   - Select currency (NGN or USD)
   - Optionally enter referral code (leave blank for no sponsor)
   - Optionally enter Placement Parent ID (for spillover)
   - Accept terms and conditions
   - Click "Create Account"

4. **Post-signup**
   - Verify redirect to `/auth/activation` (activation choice page)
   - Verify two options visible: "Pay online with Paystack" and "Use wallet balance"

5. **Initiate Paystack payment**
   - Click "Pay online with Paystack"
   - Verify redirect to Paystack gateway URL (or payment-pending if USDT)
   - If Paystack: complete test payment (use test card if available)
   - Gateway redirects to `/auth/payment/callback?reference=...`

6. **Payment callback**
   - Verify "Verifying your payment" spinner
   - Verify success message "Payment verified"
   - Verify redirect to `/auth/activation` (registration payment verified) or other flow-specific target; profile wizard is optional from `/profile`

7. **Post-activation**
   - Verify user can access dashboard, wallet, earnings, etc.
   - Verify `isRegistrationPaid` / payment status is PAID

### Expected API Calls (in order)

- `POST /auth/register`
- `GET /users/me` (fetch profile)
- `POST /payments/registration/initiate`
- (Redirect to Paystack)
- `POST /payments/verify`
- `GET /users/me` (refresh profile)

---

## Use Case 2: Registration + USDT / Manual Payment (Path A variant)

**Actor:** New user who will pay manually (e.g. bank transfer, USDT)  
**Goal:** Create account, get reference, verify later

### Steps

1. Complete **Steps 1–4** from Use Case 1 (register and reach activation choice)

2. **Initiate with USDT provider**
   - Backend may return `reference` without `gatewayUrl` when provider is USDT
   - Verify redirect to `/auth/register/payment-pending?reference=...`
   - Verify reference displayed on screen

3. **Payment pending page**
   - Verify "I've paid - Verify" button
   - Click "I've paid - Verify"
   - Verify redirect to `/auth/payment/callback?reference=...`

4. **Verify payment**
   - Callback page calls `POST /payments/verify` with reference
   - After backend confirms payment, verify success and redirect

### Notes

- If backend returns `gatewayUrl`, user goes to Paystack instead
- "Restart payment" on payment-pending re-initiates and may return new reference

---

## Use Case 3: Registration + Wallet Activation (Path B)

**Actor:** New user with CASH balance (e.g. admin-funded)  
**Goal:** Activate using registration wallet

### Steps

1. Complete **Steps 1–4** from Use Case 1 (register and reach activation choice)

2. **Choose wallet path**
   - Click "Use wallet balance"
   - Verify redirect to `/auth/activation/wallet`

3. **Activation wallet page**
   - Verify "Registration wallet balance" displayed (may be 0)
   - Verify "Required to activate" amount (package + admin fee per doc section 6)
   - If CASH balance > 0: verify "Transfer from CASH to Registration" form

4. **Transfer CASH to REGISTRATION**
   - Enter amount (positive)
   - Select currency (NGN or USD)
   - Click "Transfer"
   - Verify balance updates; repeat until REGISTRATION balance ≥ required

5. **Activate**
   - Verify "Activate" button enabled when balance sufficient
   - Click "Activate"
   - Verify success and redirect to dashboard or onboarding

6. **Post-activation**
   - Same as Use Case 1 step 7

### Expected API Calls (in order)

- `POST /auth/register`
- `GET /users/me`
- `GET /registration/wallet`
- `GET /wallets` (for CASH balance)
- `POST /registration/transfer-to-registration` (one or more times)
- `POST /registration/activate`
- `GET /users/me`

### Edge Cases

- **No CASH balance:** Verify message "You have no CASH balance to transfer" and link to "pay online"
- **Insufficient balance on Activate:** Verify error message from backend
- **Already activated:** Verify redirect to dashboard

---

## Use Case 4: Referral Link Pre-fill

**Actor:** User arriving via sponsor referral link  
**Goal:** Referral code pre-filled from URL

### Steps

1. Navigate to `/ref/ABC123` (or similar)
   - Verify redirect to `/auth/register`
   - Verify referral code field pre-filled with `ABC123`
   - Optionally verify validation runs (check icon)

2. Complete registration with or without editing referral code
   - If left as-is and valid, `referralCode` sent in payload
   - If cleared, `referralCode` omitted (no default sponsor)

---

## Use Case 5: Unactivated User — Dashboard / Registration Payment

**Actor:** Logged-in user with `isRegistrationPaid: false`  
**Goal:** Redirect to activation when trying to complete payment

### Steps

1. Log in as unactivated user (or register and skip activation)

2. Navigate to `/dashboard/registration-payment`
   - Verify redirect to `/auth/activation`

3. From dashboard "Activate Account" (when unpaid)
   - Verify redirect to `/auth/activation`

4. Choose Paystack or wallet path and complete activation

---

## Use Case 6: Error Handling

### 6a. Payment initiation — already activated

- Log in as activated user
- Manually navigate to `/auth/activation`
- Click "Pay online with Paystack"
- Verify redirect to `/dashboard` (or error message if backend returns different)

### 6b. Payment initiation — generic error

- Simulate network error or invalid backend response
- Verify error message displayed (e.g. "Could not initiate payment. Please try again.")

### 6c. Activation wallet — insufficient balance

- On activation wallet page, click "Activate" when REGISTRATION balance < required
- Button should be disabled; if not, backend returns 400
- Verify error message displayed

### 6d. Activation wallet — already activated

- Call `POST /registration/activate` when user already activated
- Verify error handling and redirect to dashboard

---

## Use Case 7: Payment Callback — Reference Fallback

**Actor:** Paystack (or gateway) redirects with `trxref` instead of `reference`  
**Goal:** Verify payment still works

### Steps

1. Simulate callback URL: `/auth/payment/callback?trxref=xxx` (no `reference` param)
2. Verify callback reads `trxref` and calls verify
3. Verify success/error handling

---

## Checklist Summary

| Item | Use Case |
|------|----------|
| Signup with all fields | 1 |
| Optional referralCode | 1, 4 |
| Optional placementParentUserId | 1 |
| Redirect to activation after signup | 1 |
| Paystack path (gateway redirect) | 1 |
| Payment callback (reference, gatewayResponse) | 1 |
| USDT / payment-pending path | 2 |
| Registration wallet path | 3 |
| Transfer CASH → REGISTRATION | 3 |
| Activate when balance sufficient | 3 |
| Referral link pre-fill | 4 |
| Dashboard → activation redirect | 5 |
| Error handling | 6 |
| trxref fallback | 7 |
