# API Integration Status

**Last updated:** February 2026

---

## Completed Integrations

| Feature | Endpoints | Status |
|---------|-----------|--------|
| Auth | login, register, logout, refresh, forgot/reset password | ✅ Done |
| Registration & Activation | POST /auth/register, POST /payments/registration/initiate, POST /payments/verify | ✅ Done |
| Registration Wallet | GET /registration/wallet, POST /registration/transfer-to-registration, POST /registration/activate | ✅ Done |
| User Profile | GET/PUT /users/me | ✅ Done |
| Onboarding | profile, contact, identity, bank, preferences | ✅ Done |
| Profile Page | GET /users/me, GET /users/me/bank, GET /users/me/identity | ✅ Done |
| Wallet Funding | POST /payments/wallet-funding/initiate, POST /payments/verify | ✅ Done |
| Network | GET /users/me/referral, GET /referrals/me/downlines, sponsor, upline, placement; GET /earnings/cpv, /earnings/summary | ✅ Done |
| Earnings | GET /earnings, GET /earnings/summary, GET /earnings/cpv, GET /earnings/ranking | ✅ Done |

---

## Next Integration Priorities

| Priority | Feature | Endpoints | Notes |
|----------|---------|-----------|-------|
| 1 | **Wallets** | GET /wallets, GET /wallets/:type | Requires RegistrationPaid |
| 2 | **Withdrawals** | POST /withdrawals/request, GET /withdrawals, GET /withdrawals/:id | Requires RegistrationPaid |
| 3 | **Products** | GET /products, GET /products/:id | Bearer only |
| 4 | **Orders** | POST /orders, GET /orders, GET /orders/:id, POST /orders/:id/pay-wallet | Requires RegistrationPaid |
| 5 | **Notifications** | GET /notifications, GET /notifications/unread-count, PUT /notifications/:id/read | Bearer only |
| 6 | **Settings Sessions** | GET /users/me/sessions, DELETE /users/me/sessions/:id | Bearer only |
| 7 | **Notification Preferences** | GET /notifications/preferences, PUT /notifications/preferences | Bearer only |

---

## Notes

- **Registration & Activation:** Two paths — (A) Paystack: initiate → gateway → verify; (B) Wallet: transfer CASH → REGISTRATION → activate. Referral code prefilled from `?ref=`, `/ref/:code`, or `environment.defaultReferralCode`.
- **GET /wallets 403:** Unactivated users get 403. Activation-wallet page skips `fetchWallets()` when `!isPaid()`; CASH shows 0. Add funds link goes to `/payments/fund`.
- **RegistrationPaidGuard:** Wallets, earnings, withdrawals, orders require `registration.isPaid === true`. Users with unpaid registration will get 403.
- **Referral/Network:** Integrated. Overview, Referrals, Matrix, Downline, Performance pages use real API.
- **Earnings:** Integrated. Overview, Breakdown, CPV Milestones, Ranking pages use real API. CommissionService delegates to EarningsService.
- **Merchant:** GET /merchants/me, orders, inventory, etc. — available for merchant flows.
