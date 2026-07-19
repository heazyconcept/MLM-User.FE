# API Integration Progress

**Last updated:** July 2026

| Feature                     | Endpoint                                                  | Status       | Date       | Notes                                                                                                              |
| --------------------------- | --------------------------------------------------------- | ------------ | ---------- | ------------------------------------------------------------------------------------------------------------------ |
| Auth Login                  | `POST /auth/login`                                        | ✅ Completed | 2026-02-18 | Replaced mock with real API, stores accessToken + refreshToken                                                     |
| Auth Register               | `POST /auth/register`                                     | ✅ Completed | 2026-02-24 | username, email, password, package, currency, referralCode?, placementParentUserId?; redirects to /auth/activation |
| Auth Logout                 | `POST /auth/logout`                                       | ✅ Completed | 2026-02-18 | Sends refreshToken, clears local storage                                                                           |
| Auth Refresh                | `POST /auth/refresh`                                      | ✅ Completed | 2026-02-18 | Interceptor auto-refreshes on 401                                                                                  |
| Forgot Password             | `POST /auth/forgot-password`                              | ✅ Completed | 2026-02-18 | Wired to API, always shows success for security                                                                    |
| Reset Password              | `POST /auth/reset-password`                               | ✅ Completed | 2026-02-18 | Reads token from query params                                                                                      |
| User Profile                | `GET /users/me`                                           | ✅ Completed | 2026-02-18 | Fetched after login, populates UserService                                                                         |
| Onboarding Profile          | `PUT /users/me`                                           | ✅ Completed | 2026-02-18 | Profile step: firstName, lastName, dateOfBirth, gender, etc.                                                       |
| Onboarding Profile Photo    | `POST /users/me/photo`                                    | ✅ Completed | 2026-02-18 | Multipart FormData with file                                                                                       |
| Onboarding Identity         | `GET /users/me/identity`, `POST /users/me/identity`       | ✅ Completed | 2026-02-18 | FormData: idType, idNumber, document, selfie                                                                       |
| Onboarding Bank             | `GET /users/me/bank`, `PUT /users/me/bank`                | ✅ Completed | 2026-02-18 | bankName, accountNumber, accountName, accountType                                                                  |
| Onboarding Preferences      | `GET /users/me/preferences`, `PUT /users/me/preferences`  | ✅ Completed | 2026-02-18 | preferredLanguage, displayCurrency (NGN \| USD)                                                                    |
| Wallet Funding              | `POST /payments/wallet-funding/initiate`                  | ✅ Completed | 2026-02-19 | amount, provider (PAYSTACK, FLUTTERWAVE, USDT); Fund Wallet page at /payments/fund                                 |
| Network Referral Info       | `GET /users/me/referral`                                  | ✅ Completed | 2026-02-20 | referralCode, referrerName; ReferralService.getReferralInfo()                                                      |
| Network Downlines           | `GET /referrals/me/downlines`                             | ✅ Completed | 2026-02-20 | depth?; ReferralService.getDownlines(); Downline list page                                                         |
| Network Sponsor             | `GET /referrals/me/sponsor`                               | ✅ Completed | 2026-02-20 | ReferralService.getSponsor(); 404 when no sponsor                                                                  |
| Network Upline/Placement    | `GET /referrals/me/upline`, `GET /referrals/me/placement` | ✅ Completed | 2026-02-20 | ReferralService; matrix tree built from downlines                                                                  |
| Earnings CPV                | `GET /earnings/cpv`                                       | ✅ Completed | 2026-02-20 | EarningsService.fetchCpvSummary(); personal, team, required, cycle                                                 |
| Earnings Summary            | `GET /earnings/summary`                                   | ✅ Completed | 2026-02-20 | EarningsService.fetchEarningsSummary(); Network Performance page                                                   |
| Earnings List               | `GET /earnings`                                           | ✅ Completed | 2026-02-20 | EarningsService.fetchEarningsList(limit, offset); Commission breakdown, overview                                   |
| Earnings Ranking            | `GET /earnings/ranking`                                   | ✅ Completed | 2026-02-20 | EarningsService.fetchRanking(); Ranking page, CommissionService.getRankInfo()                                      |
| Registration Initiate       | `POST /payments/registration/initiate`                    | ✅ Completed | 2026-02-24 | package, currency, callbackUrl?, provider?; returns gatewayUrl, reference; Activation choice + payment-pending     |
| Payment Verify              | `POST /payments/verify`                                   | ✅ Completed | 2026-02-24 | reference, gatewayResponse?; activates user on success; Payment callback page                                      |
| Registration Wallet         | `GET /registration/wallet`                                | ✅ Completed | 2026-02-24 | RegistrationService.getRegistrationWallet(); Activation wallet page                                                |
| Transfer to Registration    | `POST /registration/transfer-to-registration`             | ✅ Completed | 2026-02-24 | amount, currency; RegistrationService.transferToRegistration(); CASH to REGISTRATION                               |
| Registration Activate       | `POST /registration/activate`                             | ✅ Completed | 2026-02-24 | RegistrationService.activate(); Debits REGISTRATION wallet, sets isRegistrationPaid                                |
| Fund Transfer               | `POST /wallets/fund-transfer`                             | ✅ Completed | 2026-07-08 | Cross-user wallet transfer by username; PIN required; page at /wallet/fund-transfer                                |
| Receiver Handover State     | `GET /merchants/me/allocations`                           | ✅ Completed | 2026-07-14 | Backend now returns handover status and supplier pickup details                                                    |
| Geography Countries         | `GET /geography/countries`                                | ✅ Completed | 2026-07-15 | Canonical ISO country options for merchant registration and profile editing                                        |
| Geography Subdivisions      | `GET /geography/countries/:countryCode/subdivisions`      | ✅ Completed | 2026-07-15 | Canonical state/region codes cached per selected country                                                           |
| Merchant Location Geography | `POST /merchants/apply`, `PATCH /merchants/me`            | ✅ Completed | 2026-07-15 | Sends required `homeCountryCode` and canonical location country/subdivision codes                                  |
| Checkout Merchant Discovery | `GET /merchants/available`                                | ✅ Completed | 2026-07-15 | Sends canonical country/subdivision codes and displays matched location, stock state, and fallback warning         |
| Checkout Availability       | `POST /merchants/checkout/availability`                   | ✅ Completed | 2026-07-15 | Canonical geography with partial-stock merchant selection and split resolution                                      |
| Split Checkout & Payment    | `POST /orders/checkout`, `POST /orders/checkout/:id/pay-wallet` | ✅ Completed | 2026-07-15 | Carries canonical geography through all groups and enforces Product Voucher payment                                |
| Pickup Receipt & Disputes   | `POST /orders/:id/confirm-received`, `/orders/:id/disputes` | ✅ Completed | 2026-07-15 | Force refresh, fail-closed dispute loading, multipart evidence, and resolved/closed history                         |
| Merchant Stock Top-up Create | `POST /merchants/me/stock-requests`                        | ✅ Completed | 2026-07-19 | Request stock dialog on inventory; handles 409 pending / 404 not-in-inventory                                      |
| Merchant Stock Top-up List   | `GET /merchants/me/stock-requests`                         | ✅ Completed | 2026-07-19 | Top-ups tab; allocation `source` mapping; confirm receipt via existing allocations flow                            |
| Korapay NGN Gateway          | `provider: KORAPAY` on payment initiate endpoints           | ✅ Completed | 2026-07-19 | NGN picker option on registration, wallet funding, upgrade, merchant fee/upgrade; feature-flagged                  |

---

## Notes

- **Referral code:** Prefilled from `?ref=` query param, `/ref/:code` (localStorage), or `environment.defaultReferralCode`.
- **GET /wallets:** Returns 403 for unactivated users. Activation-wallet page skips `fetchWallets()` when `!isPaid()`; CASH shows 0.
- **Add funds:** Activation-wallet links to `/payments/fund` when CASH is 0. Wallet funding credits CASH; user must transfer CASH → REGISTRATION then Activate.
