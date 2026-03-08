# App Flow

**Every screen, route, and user journey.**

This document maps all routes, screens, and primary user flows for the MLM User Frontend.

---

## 1. Route map

### 1.1 Root and redirects

| Path | Behavior |
|------|----------|
| `''` | Redirect → `auth/login` |
| `shop` | Redirect → `marketplace` |
| `auth/logout` | Redirect → `auth/login` |

### 1.2 Auth (unauthenticated)

| Route | Screen | Description |
|-------|--------|-------------|
| `ref/:code` | Referral redirect | Stores referral code in localStorage, redirects to `auth/register` |
| `auth/login` | Login | Email/username, password, Remember me, Forgot password, Register link |
| `auth/register` | Registration | Username, email, password, package, currency, optional referral code; → `auth/activation` |
| `auth/activation` | Activation choice | Pay online (Paystack) or Use wallet balance |
| `auth/activation/wallet` | Activation wallet | Transfer CASH → REGISTRATION, then Activate |
| `auth/payment/callback` | Payment callback | Handles Paystack redirect; verifies payment; → dashboard or onboarding |
| `auth/register/payment-pending` | Payment pending | USDT/manual payment; shows reference for manual verification |
| `auth/forgot-password` | Forgot password | Email; submit → reset flow |
| `auth/reset-password` | Reset password | New password, confirm; → login |
| `auth/verify` | Account verification | 6-digit OTP, verify, resend with cooldown; → dashboard (or onboarding) |

### 1.3 Onboarding (post-registration)

| Route | Screen | Description |
|-------|--------|-------------|
| `onboarding` | (redirect) | → `onboarding/profile` |
| `onboarding/profile` | Profile info | User profile step |
| `onboarding/contact` | Contact details | Contact step |
| `onboarding/identity` | Identity / KYC | Identity verification step |
| `onboarding/bank` | Bank details | Bank info step |
| `onboarding/preferences` | Preferences | Final onboarding preferences |

All under **OnboardingLayoutComponent** (stepper/wizard).

### 1.4 Dashboard (authenticated shell)

All below routes use **DashboardLayoutComponent** (sidebar + header + outlet).

| Route | Screen | Description |
|-------|--------|-------------|
| `dashboard` | Dashboard | Main landing: welcome, summary cards, earnings snapshot, wallet snapshot, network snapshot, recent activity, notifications preview |
| `profile` | Profile | User profile view/edit (top-level) |

### 1.5 Marketplace / Shop

| Route | Screen | Description |
|-------|--------|-------------|
| `marketplace` | Shop / Marketplace | Product grid, filters, search, sort |
| `marketplace/product/:id` | Product detail | Product detail, add to cart, purchase |

### 1.6 Wallet and money movement

| Route | Screen | Description |
|-------|--------|-------------|
| `wallet` | Wallet | Wallet overview (Cash, Voucher, Autoship), quick actions |
| `wallet/transactions/:currency` | Transaction history | List of transactions for selected currency |
| `withdrawals` | Withdrawals | Withdrawable balance, pending, history, request withdrawal |

### 1.7 Network (referrals and structure)

| Route | Screen | Description |
|-------|--------|-------------|
| `network` | (redirect) | → `network/overview` |
| `network/overview` | Network overview | Team size, direct referrals, legs, rank, CPV summary |
| `network/referrals` | Referral link | Share referral link, copy |
| `network/matrix` | Matrix tree | Matrix/tree view of structure |
| `network/downline` | Downline list | List of downline members |
| `network/performance` | Performance / CPV | Performance stats and CPV |

### 1.8 Commissions / Earnings

| Route | Screen | Description |
|-------|--------|-------------|
| `commissions` | Earnings overview | Earnings summary, by type |
| `commissions/breakdown` | Commission breakdown | Detailed breakdown |
| `commissions/bonuses` | Bonuses | Bonus types and amounts |
| `commissions/ranking` | Ranking | Rank/stage info |
| `commissions/cpv` | CPV milestones | CPV and milestones |

### 1.9 Transactions

| Route | Screen | Description |
|-------|--------|-------------|
| `transactions` | Transactions | Unified transactions list (all types) |

### 1.10 Orders

| Route | Screen | Description |
|-------|--------|-------------|
| `orders` | Orders overview | List of orders, status filters |
| `orders/preview` | Order preview | Fulfilment options before confirm |
| `orders/:id` | Order detail | Single order detail, timeline, actions |

### 1.11 Notifications

| Route | Screen | Description |
|-------|--------|-------------|
| `notifications` | Notifications list | List, read/unread, filters, mark all read |
| `notifications/preferences` | Notification preferences | Preference toggles (email, push, etc.) |

### 1.12 Settings

| Route | Screen | Description |
|-------|--------|-------------|
| `settings` | (redirect) | → `settings/account` |
| `settings/account` | Account settings | Account info, profile edits |
| `settings/security` | Security | Password change, 2FA, etc. |
| `settings/preferences` | Preferences | App preferences |
| `settings/sessions` | Sessions | Active sessions, revoke |

Settings use **SettingsShellComponent** (sub-nav) with nested routes.

### 1.13 Merchant (seller role)

| Route | Screen | Description |
|-------|--------|-------------|
| `merchant` | (redirect) | → `merchant/dashboard` |
| `merchant/dashboard` | Merchant dashboard | Merchant stats and overview |
| `merchant/inventory` | Merchant inventory | Product inventory management |
| `merchant/orders` | Merchant orders | Incoming orders list |
| `merchant/orders/:id` | Merchant order detail | Fulfilment actions for one order |
| `merchant/deliveries` | Merchant deliveries | Delivery tracking |
| `merchant/earnings` | Merchant earnings | Earnings from sales |

---

## 2. User journeys

### 2.1 New user: Register → Activation → Onboarding → Dashboard

1. Land on **auth/login** (or open **auth/register**; or **ref/:code** for referral link).
2. **auth/register**: username, email, password, package, currency, optional referral code → submit.
3. **auth/activation**: choose "Pay online" (Paystack) or "Use wallet balance".
4. **Path A — Paystack:** Initiate → redirect to gateway → pay → **auth/payment/callback** → verify → activated.
5. **Path B — Wallet:** **auth/activation/wallet** → transfer CASH → REGISTRATION → Activate. (If CASH is 0: Add funds → **payments/fund** → pay → return to activation/wallet.)
6. **onboarding**: profile → contact → identity → bank → preferences (steps may vary).
7. After onboarding complete → **dashboard**.

### 2.2 Returning user: Login → Dashboard

1. **auth/login**: credentials → submit.
2. If registration fee / onboarding not complete, redirect to **onboarding** or payment flow (per product logic).
3. Otherwise → **dashboard**.

### 2.3 Password recovery

1. **auth/login** → “Forgot password”.
2. **auth/forgot-password**: email → submit → success message.
3. **auth/reset-password**: new password → submit.
4. **auth/login**: log in with new password.

### 2.4 Logout

1. Logout control (header or settings) → clear auth state, redirect to **auth/login**.

### 2.5 From dashboard to features

- **Earnings** → **commissions** (overview, breakdown, bonuses, ranking, cpv).
- **Wallet** → **wallet** → **wallet/transactions/:currency** or **withdrawals**.
- **Network** → **network/overview** → referrals, matrix, downline, performance.
- **Orders** → **orders** → **orders/preview** or **orders/:id**.
- **Notifications** → **notifications** → **notifications/preferences**.
- **Marketplace** → **marketplace** → **marketplace/product/:id**.
- **Settings** → **settings** → account, security, preferences, sessions.
- **Merchant** (if applicable) → **merchant/dashboard** and sub-routes.

### 2.6 Purchase flow (marketplace)

1. **marketplace**: browse, filter, search.
2. **marketplace/product/:id**: view detail, add to cart / choose options.
3. Checkout (modal or page) → **orders/preview** (fulfilment options).
4. Confirm → **orders** or **orders/:id** for status.

### 2.7 Withdrawal flow

1. **wallet** or **dashboard** → “Withdraw”.
2. **withdrawals**: see balance, request withdrawal (form).
3. Submit → entry in withdrawal history (pending/approved/rejected).

---

## 3. Access and guards

- **Authenticated routes:** Dashboard, profile, marketplace, wallet, network, commissions, transactions, orders, notifications, settings, merchant — typically guarded so unauthenticated users redirect to **auth/login**.
- **Auth routes:** Login, register, forgot-password, reset-password, verify — often inaccessible when already logged in (redirect to dashboard).
- **Onboarding:** Shown when user is authenticated but onboarding not complete (per product rules).
- **Merchant:** Shown only if user has merchant/seller role (when enforced).

(Exact guard implementation is in the codebase; this section describes the intended access model.)

---

## 4. Layout summary

| Layout | Routes |
|--------|--------|
| None (full page) | auth/* |
| OnboardingLayoutComponent | onboarding/* |
| DashboardLayoutComponent | dashboard, profile, marketplace, wallet, network, commissions, transactions, orders, notifications, settings, merchant |

---

## 5. Route data (title)

Many routes set `data: { title: '...' }` for breadcrumbs or browser title (e.g. Marketplace, Order details, Network Overview). See `app.routes.ts` for the full list.
