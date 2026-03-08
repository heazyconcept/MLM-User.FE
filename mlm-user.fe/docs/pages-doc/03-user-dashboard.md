# 03-user-dashboard

<a id="03-user-dashboardmd"></a>

# 03-user-dashboard.md

**User Interface Specification – User Dashboard**

* * *

<a id="1-purpose"></a>

## 1\. Purpose

This document defines the **User Dashboard UI**, which serves as the **primary landing page** after authentication.

The dashboard provides:

- High-level system overview
- Key financial and network summaries
- Quick navigation to core features

> ⚠️ UI-only specification  
> All data is mocked. No backend integration.

* * *

<a id="2-entry-point"></a>

## 2\. Entry Point

<a id="route"></a>

### Route

```
/dashboard

```

<a id="access-rule"></a>

### Access Rule

- Accessible only after successful login or onboarding completion

* * *

<a id="3-dashboard-layout"></a>

## 3\. Dashboard Layout

<a id="structure"></a>

### Structure

- Top Navigation Bar
- Sidebar Navigation
- Main Content Area
- Notification Drawer (optional)

* * *

<a id="4-dashboard-sections-overview"></a>

## 4\. Dashboard Sections Overview

1. Welcome Header
2. Summary Cards
3. Earnings Snapshot
4. Wallet Snapshot
5. Network Snapshot
6. Recent Activity
7. Notifications Preview

* * *

<a id="5-welcome-header"></a>

## 5\. Welcome Header

<a id="ui-elements"></a>

### UI Elements

- Greeting (e.g. *“Welcome, Ezekiel”*)
- Current Rank / Stage
- Profile completion indicator

* * *

<a id="6-summary-cards"></a>

## 6\. Summary Cards

<a id="cards-displayed"></a>

### Cards Displayed

| Card | Description |
| --- | --- |
| Total Earnings | Lifetime earnings |
| Available Balance | Cash wallet balance |
| Network Size | Total referrals |
| Current Rank | MLM rank |

<a id="behavior"></a>

### Behavior

- Clickable
- Navigate to detailed sections

* * *

<a id="7-earnings-snapshot"></a>

## 7\. Earnings Snapshot

<a id="ui-components"></a>

### UI Components

- Earnings by Type (mini chart or list)
- Today / This Month toggle
- View All Earnings button

<a id="displayed-types"></a>

### Displayed Types

- Direct Referral
- Community Bonus
- Product Bonuses
- Matching Bonus

* * *

<a id="8-wallet-snapshot"></a>

## 8\. Wallet Snapshot

<a id="ui-components"></a>

### UI Components

- Cash Wallet Balance
- Voucher Wallet Balance
- Autoship Wallet Balance
- Withdraw button (disabled if zero)

<a id="behavior"></a>

### Behavior

- Click wallet → `/wallet`
- Withdraw → `/withdrawals`

* * *

<a id="9-network-snapshot"></a>

## 9\. Network Snapshot

<a id="ui-components"></a>

### UI Components

- Direct Referrals count
- Downline count
- Matrix progress indicator
- View Network button

<a id="navigation"></a>

### Navigation

- Redirect → `/network`

* * *

<a id="10-recent-activity"></a>

## 10\. Recent Activity

<a id="activity-types"></a>

### Activity Types

- Earnings posted
- Wallet funding
- Withdrawals
- Orders placed

<a id="ui"></a>

### UI

- List (last 5 activities)
- Timestamp
- Status badge

* * *

<a id="11-notifications-preview"></a>

## 11\. Notifications Preview

<a id="ui-components"></a>

### UI Components

- Latest 3 notifications
- View All button

<a id="navigation"></a>

### Navigation

- Redirect → `/notifications`

* * *

<a id="12-empty-states"></a>

## 12\. Empty States

- New user:
  - Zero earnings
  - No referrals
  - No transactions

<a id="empty-state-behavior"></a>

### Empty State Behavior

- Show onboarding tips
- CTA buttons:
  - Invite Friends
  - Fund Wallet
  - Browse Products

* * *

<a id="13-reusable-components"></a>

## 13\. Reusable Components

- `StatCard`
- `MiniChart`
- `Badge`
- `ActivityItem`
- `Button`
- `SkeletonLoader`

* * *

<a id="14-state-management-mock"></a>

## 14\. State Management (Mock)

```
dashboard: {
  earningsSummary: {}
  walletSummary: {}
  networkSummary: {}
  recentActivities: []
  notifications: []
}

```

* * *

<a id="15-ux-performance-rules"></a>

## 15\. UX & Performance Rules

- Load skeletons first
- Lazy load charts
- Mobile responsive cards
- Click-through everywhere

* * *

<a id="16-ui-flow-summary"></a>

## 16\. UI Flow Summary

```
Login
  → Dashboard
      → Earnings
      → Wallet
      → Network
      → Orders
      → Notifications

```

* * *

<a id="17-future-backend-integration-notes"></a>

## 17\. Future Backend Integration Notes

When backend is introduced:

- Replace mock data
- Introduce real-time refresh
- Add role-based widgets
- Enable alerts

* * *

<a id="18-status"></a>

## 18\. Status

✅ Dashboard UI defined  
✅ User-centric  
✅ Safe for frontend implementation