# Product Requirements Document (PRD)

**Every feature and its requirements.**

This document consolidates feature-level requirements from the existing UI specifications (01–14). All specs are **UI-only** unless noted; backend integration is future work.

---

## 1. Authentication & Access (01)

**Purpose:** Login, registration, password recovery/reset, verification, logout.

**Scope:** Login, Register, Forgot Password, Reset Password, Verify, Logout. Excludes: role enforcement, wallet creation, earnings, payments, admin auth.

**Routes:** `/auth/login`, `/auth/register`, `/auth/forgot-password`, `/auth/reset-password`, `/auth/verify`, `/auth/logout`.

**Requirements:**

- **Login:** Email/username + password (min 6 chars); Remember me; Forgot password link; Register link. Validate → loading (e.g. 1.5s) → success redirect to `/dashboard`, failure inline error.
- **Register:** First name, last name, email, phone, password, confirm password, optional sponsor username, package (Silver/Gold/Platinum/Ruby/Diamond). Validate → loading (e.g. 2s) → redirect to `/auth/verify`.
- **Forgot password:** Email; validate → loading → success message → redirect to `/auth/reset-password`.
- **Reset password:** New password, confirm; min 6 chars, match. Loading → success toast → redirect to `/auth/login`.
- **Verify:** 6-digit OTP; Verify button; Resend with 30s cooldown. Validate → loading → redirect to `/dashboard`.
- **Logout:** Clear local auth state → redirect to `/auth/login`.
- **Global UI:** Client-side validation only; simulated async; buttons have disabled and loading states; inline errors; mock navigation.
- **Reusable components:** TextInput, PasswordInput, Checkbox, Select, Button, Spinner, Toast, FormError.
- **State (mock):** isAuthenticated, isLoading, formErrors.

**Status:** UI-complete, backend-independent.

---

## 2. User Dashboard (03)

**Purpose:** Primary landing after auth: system overview, financial and network summaries, quick navigation.

**Route:** `/dashboard`. Accessible after login/onboarding.

**Requirements:**

- **Layout:** Top nav, sidebar, main content, optional notification drawer.
- **Sections:** Welcome header (greeting, rank, profile completion); Summary cards (Total Earnings, Available Balance, Network Size, Current Rank) — clickable to detail sections; Earnings snapshot (by type, Today/Month toggle, View All); Wallet snapshot (Cash/Voucher/Autoship, Withdraw); Network snapshot (direct referrals, downline, matrix progress, View Network); Recent activity (last 5, type + timestamp + status); Notifications preview (latest 3, View All).
- **Empty states:** New user with zero earnings/referrals/transactions: onboarding tips and CTAs (Invite Friends, Fund Wallet, Browse Products).
- **Reusable components:** StatCard, MiniChart, Badge, ActivityItem, Button, SkeletonLoader.
- **State (mock):** dashboard.earningsSummary, walletSummary, networkSummary, recentActivities, notifications.
- **UX:** Skeletons first, lazy load charts, responsive cards, click-through to features.

**Status:** Dashboard UI defined, safe for frontend implementation.

---

## 3. Referral & Network (04)

**Purpose:** Invite members, view referral structure, team performance, CPV and matrix progress.

**Entry:** Sidebar → Network → `/network`; dashboard shortcut → `/network/overview`.

**Requirements:**

- **Tabs/sections:** Overview, Referral Link, Matrix/Tree, Downline List, Performance & CPV.
- **Overview:** Total team size, direct referrals, active legs, current stage/rank, CPV summary.
- **Referral link:** Shareable link, copy button, optional QR.
- **Matrix/Tree:** Visual tree of placement (UI-only; no placement rules).
- **Downline list:** List of downline with key info.
- **Performance/CPV:** CPV and performance metrics.
- **State (mock):** Local/mock data; no backend logic.

**Status:** UI-only; no placement rules enforced.

---

## 4. Wallets & Balances (05)

**Purpose:** View wallet balances, types, and navigate to funding/withdrawals.

**Entry:** Sidebar → Wallet → `/wallet` (or `/wallet/overview`).

**Requirements:**

- **Wallet types:** Cash (withdrawable), Voucher (not withdrawable), Autoship (not withdrawable). Display name, balance, currency (USD/NGN), info tooltip, quick actions.
- **Wallet overview:** Cards per wallet, total balance, currency indicator, quick actions (e.g. Withdraw for Cash).
- **Navigation:** Wallet click → `/wallet`; Withdraw → `/withdrawals`.
- **Currency display:** Per product rules (e.g. symbol, decimals).
- **State (mock):** All balances mocked; no real transactions.

**Status:** UI-only specification.

---

## 5. Earnings & Commissions (07)

**Purpose:** How user earns; earnings by type; bonuses, ranks, milestones.

**Entry:** Sidebar → Earnings → `/commissions` (or `/earnings/overview` per spec; app uses `/commissions`).

**Requirements:**

- **Sections:** Overview, Earnings Breakdown, Bonuses, Ranking & Stages, CPV & Milestones.
- **Overview:** Summary totals, by type (e.g. Direct Referral, Community Bonus, Product Bonuses, Matching Bonus), period toggle (Today/Month).
- **Breakdown:** Detailed commission breakdown.
- **Bonuses:** Bonus types and amounts.
- **Ranking:** Rank/stage display and progress.
- **CPV/Milestones:** CPV and milestone progress.
- **State (mock):** All earnings data mocked; no calculation logic.

**Status:** UI-only.

---

## 6. Withdrawals & Payouts (08)

**Purpose:** Request withdrawals, track status, show rules and limits.

**Entry:** Sidebar → Withdrawals or Wallet → Withdraw → `/withdrawals`.

**Requirements:**

- **Overview:** Withdrawable balance, pending withdrawals summary, withdrawal history list, Request Withdrawal button.
- **Request flow:** Amount, currency, bank details (or selection); validation; submit → pending entry; success/error feedback.
- **History:** List with status (Pending/Approved/Rejected), amount, date, bank info (masked).
- **Rules/limits:** Min/max, frequency, fees — displayed per product; enforcement is future backend.
- **State (mock):** No real money movement or approvals.

**Status:** UI-only.

---

## 7. Products & Marketplace (10)

**Purpose:** Browse products, view details, start purchase.

**Entry:** Sidebar → Marketplace, dashboard CTA, or wallet (Voucher/Autoship) → `/marketplace`.

**Requirements:**

- **Marketplace:** Product grid, category filters, search, sort. Product card: image, name, price, short description, CTA.
- **Product detail:** Full description, gallery, price, options/variants, quantity, Add to cart / Purchase. No real checkout or inventory enforcement (UI-only).
- **State (mock):** Product and cart data mocked.

**Status:** UI-only.

---

## 8. Orders & Fulfilment (11)

**Purpose:** View orders, fulfilment options, order detail and timeline.

**Entry:** Sidebar → Orders → `/orders`.

**Requirements:**

- **Orders list:** List with status filter, search; columns e.g. order ID, date, status, total.
- **Order preview:** Fulfilment options (e.g. ship, pickup, voucher) before final confirm — route `orders/preview`.
- **Order detail:** Single order view: items, status, timeline, actions (e.g. track, cancel if allowed).
- **State (mock):** No real fulfilment or inventory.

**Status:** UI-only.

---

## 9. Notifications (13)

**Purpose:** View notifications, read details, manage preferences.

**Entry:** Header bell or Sidebar → Notifications → `/notifications`.

**Requirements:**

- **List:** Notifications with read/unread, filters/tabs, “Mark all as read.”
- **Detail:** Click to read; optional mark read on open.
- **Preferences:** `/notifications/preferences` — toggles for channels (email, push, etc.). No delivery logic (mock).

**Status:** UI-only.

---

## 10. User Settings & Security (14)

**Purpose:** Account settings, security, preferences, sessions.

**Entry:** Sidebar → Settings or profile menu → `/settings` (default `settings/account`).

**Requirements:**

- **Sections:** Account, Security, Preferences, Sessions.
- **Account:** Profile info, edit fields (name, email, phone, etc.).
- **Security:** Change password, 2FA if specified.
- **Preferences:** App preferences (language, notifications, etc.).
- **Sessions:** Active sessions list, revoke session. No real auth enforcement in UI-only phase.
- **State (mock):** No persistence to backend.

**Status:** UI-only.

---

## 11. Additional app features (from routes)

- **Onboarding:** Multi-step (profile, contact, identity, bank, preferences) after verification; completion → dashboard.
- **Profile (top-level):** `/profile` — dedicated profile view/edit page.
- **Transactions:** `/transactions` — unified transaction list across types.
- **Merchant:** Dashboard, inventory, orders, order detail, deliveries, earnings — for seller role when enabled.

---

## 12. Cross-cutting requirements

- **Accessibility:** WCAG AA, AXE-clean, labels, keyboard nav, focus, contrast.
- **Responsive:** Mobile-first; all screens usable on small viewports.
- **Loading & errors:** Buttons show loading state; errors inline or toast; no silent failures.
- **Future backend:** Replace mocks with API calls; keep validation and UI flows; add token handling, role enforcement, and real persistence.

---

## 13. Reference to detailed specs

| Doc | Feature |
|-----|---------|
| 01-authentication-access.md | Auth & access |
| 03-user-dashboard.md | Dashboard |
| 04-referral-network.md | Network |
| 05-wallets-balances.md | Wallets |
| 07-earnings-commissions.md | Earnings/commissions |
| 08-withdrawals-payouts.md | Withdrawals |
| 10-products-marketplace.md | Marketplace |
| 11-orders-fulfilment.md | Orders |
| 13-notifications.md | Notifications |
| 14-user-settings.md | Settings |

Refer to these files for field-level validation, exact UI components, and button behaviors.