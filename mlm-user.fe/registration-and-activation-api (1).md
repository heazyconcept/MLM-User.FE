# Registration and Activation — API Guide for Frontend

This document describes **account creation**, **activation** (paying for registration), and the **registration wallet** flow so the frontend can implement signup, payment, and wallet-based activation correctly.

---

## 1. Overview

- **Registration** = creating an account (signup). The user chooses **package**, **currency**, and optional **referral code**. They are created with `isRegistrationPaid: false`.
- **Activation** = paying the registration + admin fee so the account becomes active. Until then, most app features are blocked (earnings, withdrawals, orders, etc.).

**Single activation path:**

1. **Register** → user signs up and completes onboarding.
2. **Login** → user sees dashboard with “registration pending”.
3. **Fund registration wallet** → user pays via Paystack (or later Flutterwave). Backend **credits the REGTISRATION wallet only**; the user is **not** activated yet.
4. **Click Activate** → user calls `POST /registration/activate`. Backend debits the REGISTRATION wallet, records admin fee, sets `isRegistrationPaid: true`, and runs earnings/CPV/IPV.

- **Before activation:** The only way to fund the registration wallet is via Paystack (or later Flutterwave). Transfer from CASH to REGISTRATION is **not** allowed for unactivated users.
- **After activation:** Transfer from CASH to REGISTRATION is allowed (e.g. for future use cases).

**Wallets created at signup:** Every user gets four wallets at account creation: **REGISTRATION**, **CASH**, **VOUCHER**, **AUTOSHIP**. The REGISTRATION wallet holds funds that will be debited when the user clicks **Activate**. Balances are stored in **USD** internally; the API uses the user’s **registration currency** (NGN or USD) for display where applicable.

---

## 2. Account Creation (Signup)

### `POST /auth/register` (Public)

Creates the user and their four wallets. No auth header.

**Request body (RegisterDto):**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `username` | string | Yes | Unique; used for login |
| `email` | string | Yes | Valid email |
| `password` | string | Yes | Min 8 characters |
| `package` | enum | Yes | `NICKEL` \| `SILVER` \| `GOLD` \| `PLATINUM` \| `RUBY` \| `DIAMOND` |
| `currency` | enum | Yes | `NGN` \| `USD` (registration currency; cannot change later) |
| `referralCode` | string | No | Sponsor’s referral code |
| `placementParentUserId` | string | No | Used when sponsor has 3 direct referrals (spillover placement) |

**Response:** Auth tokens (access + refresh) and user info, as per your auth response shape.

**After signup:**

- User has `isRegistrationPaid: false`.
- Wallets **REGISTRATION**, **CASH**, **VOUCHER**, **AUTOSHIP** exist; REGISTRATION and CASH start at 0 unless you have another flow that credits them.
- Package and currency are fixed for the lifetime of the account (for registration/activation).

---

## 3. Fund registration wallet (Paystack)

These endpoints **fund** the REGISTRATION wallet. They do **not** activate the user. Activation happens only when the user calls `POST /registration/activate` (section 4).

### Step 1: Initiate payment

**`POST /payments/registration/initiate`**  
**Auth:** Bearer JWT (does **not** require activation).

**Request body (InitiateRegistrationPaymentDto):**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `package` | enum | Yes | Must match user’s `registrationPackage` |
| `currency` | enum | Yes | Must match user’s `registrationCurrency` |
| `callbackUrl` | string | No | Where Paystack redirects after payment |
| `provider` | enum | No | `PAYSTACK` (default) or `USDT` (manual; no redirect) |

**Response (PaymentInitiationResponseDto):**

```json
{
  "paymentId": "uuid",
  "reference": "string",
  "amount": 20000,
  "currency": "NGN",
  "gatewayUrl": "https://checkout.paystack.com/..."
}
```

- **Amount** is the **activation total** (package fee + admin fee) so one payment funds the full amount needed to activate.
- **Paystack:** Redirect the user to `gatewayUrl`. After they pay, the gateway redirects to `callbackUrl` (e.g. with `?reference=...`).
- **USDT:** No `gatewayUrl`; frontend later calls verify with the same `reference` after manual payment.

**Validation (backend):** User must not already be activated; `package` and `currency` must match the user’s registration package and currency.

### Step 2: Verify payment (after redirect or manual payment)

**`POST /payments/verify`**  
**Auth:** Bearer JWT.

**Request body (VerifyPaymentDto):** `{ "reference": "string", "gatewayResponse"?: object }`

**Response (PaymentResponseDto):** Payment details including `status`, `verifiedAt`, `type: REGISTRATION`.

**Backend behaviour on success:**

- Marks payment as SUCCESS and sets `verifiedAt`.
- **Credits the user’s REGISTRATION wallet** with the payment amount.
- **Does not** set `isRegistrationPaid` or run earnings/CPV/IPV. The user must click **Activate** (section 4) to activate.

**Frontend:** On the callback page, read `reference` from the URL, call `POST /payments/verify` with `{ reference }`, then show “Payment received. Click Activate to complete.” and let the user go to the activate step.

---

## 4. Registration wallet and Activate

### Get registration wallet (balance)

**`GET /registration/wallet`**  
**Auth:** Bearer JWT. Does **not** require activation.

**Response:** `WalletResponseDto | null` (e.g. `walletId`, `walletType: REGISTRATION`, `balance`, `currency`, `status`).

Use this to show the user their registration wallet balance so they know when they can click Activate (balance ≥ activation total).

### Transfer CASH → REGISTRATION (activated users only)

**`POST /registration/transfer-to-registration`**  
**Auth:** Bearer JWT. **Requires activation** (RegistrationPaidGuard).

**Request body (TransferToRegistrationDto):** `amount` (number), `currency` (NGN \| USD).  
**Response:** `{ "transferId": "uuid" }`.

- Only **activated** users can transfer from CASH to REGISTRATION. Unactivated users must fund the registration wallet via Paystack (section 3).

### Activate (debit registration wallet)

**`POST /registration/activate`**  
**Auth:** Bearer JWT. Does **not** require activation.

**Response:** `{ "activated": true }`

**Backend behaviour:**

- User must not already be activated.
- **Required amount** = package registration fee + admin fee (see section 6).
- Debits **REGISTRATION** wallet, records admin fee, sets `isRegistrationPaid: true`.
- Runs direct referral bonus, community referral bonus, CPV, IPV to VOUCHER wallet; emits `registration.activated`.

**Errors:** `400` — “Registration is already activated” or “Insufficient balance in registration wallet. Required: X currency, current: Y USD equivalent”.

**Frontend:** Show “Activate” when REGISTRATION balance ≥ activation total; call `POST /registration/activate`. After success, redirect to dashboard.

---

## 5. API Reference Summary

| Method | Endpoint | Auth | Purpose |
|--------|----------|------|--------|
| POST | `/auth/register` | None | Create account (package, currency, referral); creates 4 wallets |
| POST | `/payments/registration/initiate` | JWT | Fund registration wallet: start payment; get `gatewayUrl` for Paystack |
| POST | `/payments/verify` | JWT | Verify payment by `reference`; credits REGISTRATION wallet only (does not activate) |
| GET | `/registration/wallet` | JWT | Get REGISTRATION wallet and balance |
| POST | `/registration/transfer-to-registration` | JWT + activated | Transfer from CASH to REGISTRATION (activated users only) |
| POST | `/registration/activate` | JWT | Activate by debiting REGISTRATION wallet; runs earnings/CPV/IPV |

Endpoints that do **not** require activation: `/payments/registration/initiate`, `/payments/verify`, `GET /registration/wallet`, `POST /registration/activate`. Only `POST /registration/transfer-to-registration` requires the user to be activated.

---

## 6. Package and Currency (Amounts)

Activation total = **registration fee + admin fee** (both in NGN in backend; converted to USD at fixed rate when needed).

**Registration fee (NGN) — from backend constants:**

| Package | NGN |
|---------|-----|
| NICKEL | 15,000 |
| SILVER | 30,000 |
| GOLD | 120,000 |
| PLATINUM | 600,000 |
| RUBY | 1,800,000 |
| DIAMOND | 6,000,000 |

**Admin fee (NGN) — not distributed:**

| Package | NGN |
|---------|-----|
| NICKEL | 5,000 |
| SILVER | 5,000 |
| GOLD | 10,000 |
| PLATINUM | 20,000 |
| RUBY | 50,000 |
| DIAMOND | 100,000 |

**Conversion:** Backend uses a fixed rate (e.g. 1000 NGN = 1 USD) for activation totals in USD. Frontend can show NGN amounts as above; for USD, divide total NGN by the same rate (e.g. 1000) if you need to display “required amount” before calling activate.

**Example (Nickel, NGN):** 15,000 + 5,000 = **20,000 NGN** total to activate.

---

## 7. User State and Guards

- **`isRegistrationPaid`:** `true` = activated; `false` = not yet paid.
- **Profile / user APIs** expose `package`, `currency`, `isPaid` (or `isRegistrationPaid`) so the frontend can show “Complete payment to activate” when `isPaid === false` and offer “Fund registration wallet” (Paystack) then “Activate”.
- **Guards:** Most app features use **RegistrationPaidGuard** (activated only). Endpoints that unactivated users need: `POST /payments/registration/initiate`, `POST /payments/verify`, `GET /registration/wallet`, `POST /registration/activate` do **not** require activation. `POST /registration/transfer-to-registration` **does** require activation.

---

## 8. What Happens on Activation

Activation happens **only** when the user calls `POST /registration/activate` (not when payment is verified). After a successful activate:

1. **User:** `isRegistrationPaid` set to `true`.
2. **Referrer (if any):** Direct referral bonus and community referral bonuses (13 levels) are processed.
3. **CPV:** Registration CPV is added for the user (package-based).
4. **IPV:** Instant Product Voucher (USD) is credited to the user’s **VOUCHER** wallet (package-based).
5. **Admin fee:** Recorded (not distributed to users).
6. **Event:** `registration.activated` is emitted (for notifications/audit).

Payment verify only **credits** the REGISTRATION wallet; it does not run the above steps.

---

## 9. Frontend Implementation Checklist

- [ ] **Signup:** `POST /auth/register` with package, currency, referralCode; handle tokens and redirect (e.g. to “Complete activation”).
- [ ] **Activation status:** Use profile or user API to read `isRegistrationPaid`; gate main app behind activation where required.
- [ ] **Fund registration wallet (Paystack):**  
  - [ ] `POST /payments/registration/initiate` with package, currency, optional callbackUrl.  
  - [ ] Redirect to `gatewayUrl`.  
  - [ ] Callback page: read `reference`, call `POST /payments/verify` with `{ reference }`.  
  - [ ] After verify success, show “Payment received. Click Activate to complete.” (do **not** treat verify as activation).
- [ ] **Registration wallet and Activate:**  
  - [ ] `GET /registration/wallet` to show REGISTRATION balance.  
  - [ ] When REGISTRATION balance ≥ activation total (section 6), show “Activate” and call `POST /registration/activate`.  
  - [ ] After activate success, redirect to dashboard.
- [ ] **Transfer CASH → REGISTRATION:** Only for activated users; call `POST /registration/transfer-to-registration` when needed (e.g. future use cases).
- [ ] **Required amount:** Compute from section 6 (registration + admin fee in NGN/USD) for your package/currency to show “Activate” only when balance is sufficient.
- [ ] **Errors:** Handle 400 “Registration is already activated”, “Insufficient balance in registration wallet”, and payment-initiation validation errors (package/currency mismatch, already registered).

---

## 10. Related Docs

- **Auth:** `docs/features/01-authentication.md`
- **Payments:** `docs/features/08-payments.md`
- **Wallet / ledger:** `docs/features/04-wallet-management.md`, `docs/features/05-wallet-ledger.md`
- **Gaps (registration/wallet):** `docs/business/gaps/01-registration-and-wallet-flow.md`
