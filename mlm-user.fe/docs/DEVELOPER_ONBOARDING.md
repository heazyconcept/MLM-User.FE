# Developer Onboarding — MLM User Frontend

**Last updated:** February 2026

This document helps incoming developers understand the project scope, what has been implemented, and how to get started.

---

## 1. Project Overview

**MLM User Frontend** is an Angular 21 SPA for an MLM (Multi-Level Marketing) platform. Users can register, activate their account (pay registration fee), complete onboarding, and access dashboard, wallet, network, earnings, marketplace, orders, and settings.

- **Framework:** Angular 21 (standalone components, signals, control flow)
- **UI:** PrimeNG 21, Tailwind CSS 4
- **API:** REST backend at `environment.apiUrl` (e.g. `https://segulah-api.onrender.com`)

---

## 2. Project Scope (from PRD)

| Feature | Route(s) | Status |
|---------|----------|--------|
| Auth (login, register, logout, forgot/reset password) | `/auth/*` | ✅ Integrated |
| Registration & activation (Paystack + wallet) | `/auth/register`, `/auth/activation`, `/auth/activation/wallet` | ✅ Integrated |
| Onboarding (profile, contact, identity, bank, preferences) | `/onboarding/*` | ✅ Integrated |
| Dashboard | `/dashboard` | ✅ Integrated |
| Wallet & funding | `/wallet`, `/payments/fund` | ✅ Integrated (wallet funding); GET /wallets requires activation |
| Network (referrals, matrix, downline, performance) | `/network/*` | ✅ Integrated |
| Earnings & commissions | `/commissions/*` | ✅ Integrated |
| Withdrawals | `/withdrawals` | ⚠️ UI exists; API may require activation |
| Marketplace | `/marketplace` | ⚠️ UI exists; products API pending |
| Orders | `/orders` | ⚠️ UI exists; orders API pending |
| Notifications | `/notifications` | ⚠️ UI exists; API pending |
| Settings | `/settings/*` | ⚠️ UI exists; sessions/preferences API pending |
| Merchant | `/merchant/*` | ⚠️ UI exists; merchant API pending |

---

## 3. Registration & Activation Flow (Implemented)

### 3.1 Flow Summary

1. **Register** (`/auth/register`) → username, email, password, package, currency, optional referral code
2. **Activation choice** (`/auth/activation`) → Pay online (Paystack) or Use wallet balance
3. **Path A — Paystack:** Initiate → redirect to gateway → callback → verify → activated
4. **Path B — Registration wallet:** Transfer CASH → REGISTRATION → Activate

### 3.2 Key Routes

| Route | Purpose |
|-------|---------|
| `/ref/:code` | Referral redirect; stores code in localStorage, redirects to `/auth/register` |
| `/auth/register` | Registration form; referral code prefilled from `?ref=` or localStorage or `environment.defaultReferralCode` |
| `/auth/activation` | Choose Paystack or wallet activation |
| `/auth/activation/wallet` | Transfer CASH → REGISTRATION, then Activate |
| `/auth/payment/callback` | Handles Paystack redirect; verifies payment; redirects to dashboard or onboarding |
| `/auth/register/payment-pending` | USDT/manual payment; shows reference for manual verification |

### 3.3 Important Implementation Details

- **Referral code prefill:** From query param `?ref=`, localStorage (from `/ref/:code`), or `environment.defaultReferralCode` (e.g. `REF000000`)
- **GET /wallets returns 403 for unactivated users:** Activation-wallet page skips `fetchWallets()` when `!isPaid()`; CASH balance shows 0 for unactivated users
- **Add funds link:** When CASH is 0 on activation-wallet, user can click "Add funds" → `/payments/fund` (wallet funding credits CASH)
- **After wallet funding:** Callback redirects to `/wallet`; user must navigate back to `/auth/activation/wallet` to transfer and activate

### 3.4 API Endpoints (Registration & Activation)

| Method | Endpoint | Auth | Notes |
|--------|----------|------|-------|
| POST | `/auth/register` | None | Creates user + 4 wallets |
| POST | `/payments/registration/initiate` | JWT | Returns `gatewayUrl` for Paystack |
| POST | `/payments/verify` | JWT | Activates user on success |
| GET | `/registration/wallet` | JWT | Does **not** require activation |
| POST | `/registration/transfer-to-registration` | JWT | CASH → REGISTRATION |
| POST | `/registration/activate` | JWT | Debits REGISTRATION, sets `isRegistrationPaid` |

---

## 4. Key Services & Files

| Service / File | Purpose |
|----------------|---------|
| `AuthService` | Login, register, logout, refresh |
| `UserService` | Profile, `isPaid()`, `paymentStatus()` |
| `PaymentService` | Initiate registration payment, verify, wallet funding |
| `RegistrationService` | `getRegistrationWallet()`, `transferToRegistration()`, `activate()` |
| `WalletService` | `fetchWallets()`, wallet balances (403 when unactivated) |
| `EarningsService` | Earnings list, summary, CPV, ranking |
| `ReferralService` | Referral info, validate code, downlines |
| `registration.constants.ts` | `getRequiredAmount(package, currency)` for activation |

---

## 5. Known Gaps & Limitations

1. **GET /wallets 403 for unactivated users:** CASH balance cannot be fetched before activation. Activation-wallet shows 0; backend could expose CASH in `GET /registration/wallet` or allow unactivated access to `/wallets`.
2. **Wallet funding `gatewayUrl`:** Some backend responses omit `gatewayUrl`; see `WALLET_FUNDING_BUG.md`.
3. **Redirect after wallet funding:** Unactivated users who fund are sent to `/wallet`; ideal redirect would be `/auth/activation/wallet` for seamless transfer + activate.
4. **Earnings/commissions:** Fetched when `isPaid()`; dashboard calls `fetchEarningsSectionData()` on load.

---

## 6. Documentation Reference

| Document | Content |
|----------|---------|
| `README.md` | Environment, dev server, build |
| `progress.md` | API integration table |
| `docs/REGISTRATION_ACTIVATION_E2E_TEST.md` | E2E test cases for registration/activation |
| `../registration-and-activation-api.md` | Backend API spec for registration/activation |
| `../PRD.md` | Product requirements |
| `../APP_FLOW.md` | Routes and user journeys |
| `../INTEGRATION_STATUS.md` | Integration status summary |
| `../TECH_STACK.md` | Tech stack details |

---

## 7. Quick Start

```bash
cd mlm-user.fe
npm install
# Edit src/environments/environment.development.ts: set apiUrl
ng serve
```

Open `http://localhost:4200`. Default login/register flows are available.
