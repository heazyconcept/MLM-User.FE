# MLM User Frontend — Executive Presentation

**Project:** MLM User Frontend (MLM-User.FE)  
**Audience:** Executive / stakeholders  
**Last updated:** February 2025  

---

## 1. Context Framing

### Why This Project Exists

The MLM (Multi-Level Marketing) User Frontend is a **user-facing web application** designed to serve distributors, affiliates, and sellers in an MLM or direct-selling ecosystem. It provides a single entry point for users to manage their business: track earnings, grow their network, handle wallets and withdrawals, browse products, manage orders, and stay informed through notifications.

### Market and Stakeholder Context

- **Users:** Affiliates and distributors who need clarity on earnings, referrals, and next steps.
- **Business:** Platform operators who need a professional, trustworthy UI that reduces support burden and increases engagement.
- **Technical:** Frontend-first delivery that validates UX and flows before backend integration, reducing rework and accelerating time-to-market.

### Strategic Position

This is a **UI-first delivery**. All features are implemented with mock data and client-side logic. The architecture is built to swap mocks for real APIs when the backend is ready, minimizing integration risk and enabling parallel development.

---

## 2. System Overview

### What We Built

A **single-page application (SPA)** that covers the full MLM user lifecycle:

| Domain | Purpose |
|--------|---------|
| **Authentication** | Login, registration, password recovery, OTP verification |
| **Onboarding** | Multi-step setup (profile, contact, identity, bank, preferences) |
| **Dashboard** | At-a-glance overview: earnings, wallet, network, activity, notifications |
| **Network** | Referral links, matrix/tree view, downline list, performance & CPV |
| **Wallets** | Cash, Voucher, Autoship balances; transactions; withdrawal requests |
| **Commissions** | Earnings by type, bonuses, ranking, CPV milestones |
| **Marketplace** | Product catalog, filters, product detail, purchase flow |
| **Orders** | Order list, fulfilment options, order detail with timeline |
| **Notifications** | Inbox, read/unread, preferences |
| **Settings** | Account, security, preferences, active sessions |
| **Merchant** | Seller dashboard, inventory, orders, deliveries, earnings |

### Technical Foundation

- **Framework:** Angular 21 (standalone components, signals, lazy-loaded routes)
- **UI:** PrimeNG 21 + Tailwind CSS 4
- **Design:** Custom design system with brand green (`#49A321`), semantic tokens, dark mode support
- **State:** Signals + RxJS; singleton services; mock data in localStorage
- **Quality:** WCAG AA target, AXE-clean, responsive/mobile-first

### Architecture Snapshot

```
┌─────────────────────────────────────────────────────────────┐
│                     MLM User Frontend                        │
├──────────────┬──────────────┬──────────────┬────────────────┤
│ Auth Flow    │ Onboarding   │ Dashboard    │ Feature Areas   │
│ (login,      │ (5 steps)    │ (landing)    │ (network,       │
│  register,   │              │              │  wallet,        │
│  verify)     │              │              │  commissions,   │
│              │              │              │  marketplace,   │
│              │              │              │  orders, etc.)  │
├──────────────┴──────────────┴──────────────┴────────────────┤
│ Layouts: DashboardLayout | OnboardingLayout | SettingsShell  │
├─────────────────────────────────────────────────────────────┤
│ Services: Auth, User, Wallet, Order, Product, Commission,    │
│           Notification, Merchant, Transaction, Layout, Modal │
├─────────────────────────────────────────────────────────────┤
│ Interceptors: Auth | Loading | Error                        │
└─────────────────────────────────────────────────────────────┘
```

---

## 3. User Journey Walkthrough

### 3.1 New User: Registration to First Dashboard View

1. **Landing** → Redirect to `/auth/login` (or open `/auth/register`)
2. **Register** → Name, email, phone, password, optional sponsor, package (Silver/Gold/Platinum/Ruby/Diamond)
3. **Verify** → 6-digit OTP with resend cooldown
4. **Onboarding** → Profile → Contact → Identity → Bank → Preferences
5. **Dashboard** → Welcome, summary cards, earnings snapshot, wallet, network, activity

### 3.2 Returning User: Quick Access

1. **Login** → Credentials → Dashboard
2. **Navigation** → Sidebar: Wallet, Network, Commissions, Marketplace, Orders, Notifications, Settings
3. **Shortcuts** → Summary cards on dashboard link to detail sections

### 3.3 Key Flows

| Flow | Steps |
|------|-------|
| **Password recovery** | Login → Forgot password → Email → Reset password → Login |
| **Withdrawal** | Dashboard/Wallet → Withdrawals → Request → Amount, bank details → Pending history |
| **Purchase** | Marketplace → Product detail → Add to cart / Purchase → Order preview (fulfilment) → Order list/detail |
| **Network growth** | Network → Referral link → Copy / Share → Downline list / Matrix view |

---

## 4. Feature + Intent Explanation

### Authentication & Access

**Intent:** Secure, low-friction entry for new and returning users.  
- Login with email/username and password  
- Registration with sponsor and package selection  
- Password reset via email  
- OTP verification before access  
- Remember-me and logout  

**Design choice:** Client-side validation and simulated async; buttons show loading and disabled states to avoid double submission and to signal progress.

---

### Dashboard

**Intent:** Single screen that answers “How am I doing?” and “What should I do next?”  
- Welcome header with rank and profile completion  
- Summary cards: Total Earnings, Available Balance, Network Size, Current Rank  
- Earnings snapshot (by type, Today/Month)  
- Wallet snapshot with quick Withdraw  
- Network snapshot (direct referrals, downline, matrix progress)  
- Recent activity and notifications preview  

**Design choice:** Cards are clickable; empty states show onboarding tips (Invite Friends, Fund Wallet, Browse Products) so new users know their next steps.

---

### Network (Referrals & Structure)

**Intent:** Make it easy to grow the team and understand placement and performance.  
- Overview: team size, direct referrals, active legs, rank, CPV summary  
- Referral link with copy and optional QR  
- Matrix/Tree visual (UI-only; placement rules are future backend)  
- Downline list with key info  
- Performance & CPV metrics  

---

### Wallets & Balances

**Intent:** Clear visibility into money types and actions.  
- Cash (withdrawable), Voucher (not withdrawable), Autoship (not withdrawable)  
- Per-wallet quick actions (e.g. Withdraw for Cash)  
- Transaction history per currency  
- Currency display (USD/NGN) per product rules  

---

### Earnings & Commissions

**Intent:** Transparency on how users earn and progress.  
- Overview by type (Direct Referral, Community Bonus, Product Bonuses, Matching Bonus)  
- Period toggle (Today/Month)  
- Breakdown, bonuses, ranking, CPV & milestones  

---

### Withdrawals & Payouts

**Intent:** Simple, rules-aware withdrawal requests.  
- Withdrawable balance and pending summary  
- Request flow: amount, currency, bank details  
- History with status (Pending/Approved/Rejected)  
- Rules/limits displayed (min/max, frequency, fees); enforcement is backend  

---

### Marketplace & Orders

**Intent:** Browse, purchase, and track fulfilment.  
- Product grid with filters, search, sort  
- Product detail with gallery, options, Add to cart / Purchase  
- Order preview with fulfilment options (ship, pickup, voucher)  
- Order detail with timeline and actions  

---

### Notifications & Settings

**Intent:** Stay informed and in control.  
- Notifications: list, read/unread, filters, preferences (email, push)  
- Settings: account, security (password, 2FA), preferences, active sessions  

---

### Merchant (Seller Role)

**Intent:** Sellers manage their side of the business.  
- Dashboard, inventory, orders, order detail, deliveries, earnings  
- Shown only when user has merchant/seller role  

---

## 5. UX & Design Reasoning

### Design Philosophy

Guided by a premium UI/UX philosophy: *“If a user needs to think about how to use it, you’ve failed.”* Hierarchy, whitespace, typography, and motion are tuned so every screen feels clear and intentional.

### Design System

| Element | Approach | Rationale |
|---------|----------|-----------|
| **Color** | Brand green `#49A321`, semantic tokens (success, error, warning) | Trust, consistency, accessibility |
| **Typography** | Geist (body), optional Outfit/Poppins | Readable, modern, scalable |
| **Layout** | Mobile-first, responsive cards, sidebar + header | Usable on phones and desktops |
| **Loading** | Skeletons first, lazy-load charts | Perceived speed, no blank flashes |
| **Empty states** | Onboarding tips and CTAs | Guide new users, reduce support |
| **Feedback** | Inline errors, toasts, button loading states | No silent failures |

### Interaction Patterns

- **Click-through:** Summary cards link to detail sections.  
- **Copy actions:** One-tap copy for referral links.  
- **Validation:** Client-side before submit; clear, inline messages.  
- **Guards:** Auth and onboarding guards (per product rules) steer users to the right screen.  

---

## 6. Edge Case Highlighting

### Handled in Current Implementation

| Edge Case | Handling |
|-----------|----------|
| **New user with zero data** | Empty states with onboarding tips and CTAs |
| **Duplicate form submit** | Buttons disabled + loading state during async |
| **Invalid OTP** | Inline error; resend with 30s cooldown |
| **Long lists** | PrimeNG Table supports virtual scroll; filters and search |
| **Missing bank details** | Withdrawal form validates; rules/limits shown |
| **Unread notifications** | Read/unread filters, “Mark all as read” |

### Pending or Product-Specific

| Edge Case | Status | Notes |
|-----------|--------|-------|
| **Token expiry / refresh** | Backend | Client handles token; refresh flow is API-dependent |
| **Onboarding incomplete** | Product-specific | Guard redirect logic depends on registration/onboarding rules |
| **Large matrix/tree** | Future | Current tree is UI-only; large datasets need virtualization |
| **Offline / PWA** | Not implemented | No service worker or offline caching yet |
| **i18n / multi-locale** | Not configured | Angular i18n available; needs setup |

---

## 7. Business Value Mapping

| Capability | Business Value |
|------------|----------------|
| **Unified user experience** | Single app for all MLM functions → higher engagement, lower drop-off |
| **Transparent earnings** | Clear commission and bonus visibility → trust, fewer disputes |
| **Referral tools** | Easy link copy and sharing → faster network growth |
| **Wallet and withdrawals** | Clear balance and rules → fewer support tickets, clearer expectations |
| **Marketplace and orders** | Browse and purchase in-app → revenue, product adoption |
| **Merchant dashboard** | Sellers self-serve inventory and orders → operational efficiency |
| **Notifications and settings** | Users control preferences → reduced spam complaints, better retention |
| **UI-first delivery** | Validated flows before backend → faster iteration, lower integration risk |
| **Accessible, responsive UI** | WCAG AA, mobile-friendly → broader reach, compliance |

---

## 8. Next-Phase Roadmap

### Phase 1: Backend Integration (Priority)

- Replace mocks with real API calls (auth, user, wallet, commissions, orders, notifications)
- Implement token refresh and secure storage
- Enforce auth and onboarding guards based on backend state
- Add proper error handling and retry for network failures

### Phase 2: Production Readiness

- E2E tests (e.g. Cypress or Playwright)
- CSP and security headers
- Performance audit (bundle size, lazy loading, images)
- Optional PWA for offline support

### Phase 3: Enhancement

- i18n and locale switching
- Real-time notifications (WebSocket/SSE)
- Advanced matrix/tree visualization for large networks
- Merchant onboarding and inventory sync

### Phase 4: Scale & Extend

- SSR or SSG for SEO if needed
- Role-based feature gating (admin vs user vs merchant)
- Analytics and usage insights
- A/B testing for flows (e.g. onboarding, checkout)

---

## Appendix: Quick Reference

- **PRD:** `PRD.md` — Feature-level requirements  
- **App Flow:** `APP_FLOW.md` — Routes and user journeys  
- **Design System:** `DESIGN_SYSTEM.md` — Tokens, colors, typography  
- **Tech Stack:** `TECH_STACK.md` — Capabilities and limits  
- **Progress:** `progress.txt` — Implementation status  
