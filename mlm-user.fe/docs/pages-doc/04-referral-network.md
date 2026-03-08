# 04-referral-network

<a id="04-referral-networkmd"></a>

# 04-referral-network.md

**User Interface Specification – Referral & Network (MLM)**

* * *

<a id="1-purpose"></a>

## 1\. Purpose

This document defines the **Referral & Network UI**, which allows users to:

- Invite new members
- View their referral structure
- Monitor team performance
- Track CPV and matrix progress

> ⚠️ UI-only specification  
> No backend logic, no placement rules enforced.

* * *

<a id="2-entry-points"></a>

## 2\. Entry Points

| Trigger | Route |
| --- | --- |
| Sidebar → Network | `/network` |
| Dashboard shortcut | `/network/overview` |

* * *

<a id="3-network-layout"></a>

## 3\. Network Layout

<a id="tabs-sections"></a>

### Tabs / Sections

1. Overview
2. Referral Link
3. Matrix / Tree View
4. Downline List
5. Performance & CPV

* * *

<a id="4-network-overview"></a>

## 4\. Network Overview

<a id="route"></a>

### Route

```
/network/overview

```

<a id="ui-components"></a>

### UI Components

- Total Team Size
- Direct Referrals
- Active Legs
- Current Stage / Rank
- CPV Summary

<a id="behavior"></a>

### Behavior

- Summary cards clickable
- Redirect to relevant sections

* * *

<a id="5-referral-link"></a>

## 5\. Referral Link

<a id="route"></a>

### Route

```
/network/referrals

```

<a id="ui-components"></a>

### UI Components

- Referral URL (read-only)
- Copy button
- Share buttons (WhatsApp, Email)
- Sponsor username display

<a id="button-behavior"></a>

### Button Behavior

- Copy → clipboard success toast
- Share → opens native share modal (mock)

* * *

<a id="6-matrix-tree-view"></a>

## 6\. Matrix / Tree View

<a id="route"></a>

### Route

```
/network/matrix

```

<a id="ui-components"></a>

### UI Components

- Tree visualization
- Level indicators
- Empty slots
- Zoom controls
- Node click modal

<a id="node-modal"></a>

### Node Modal

- Username
- Package
- Level
- Status (Active / Inactive)

> ⚠️ Placement is mocked  
> No forced spillover logic enforced

* * *

<a id="7-downline-list"></a>

## 7\. Downline List

<a id="route"></a>

### Route

```
/network/downline

```

<a id="ui-components"></a>

### UI Components

- Table/List view
- Columns:
  - Username
  - Level
  - Package
  - Join Date
  - Status
- Search & filter

* * *

<a id="8-performance-cpv"></a>

## 8\. Performance & CPV

<a id="route"></a>

### Route

```
/network/performance

```

<a id="ui-components"></a>

### UI Components

- CPV Progress Bar
- Milestone List
- Team Volume Summary
- Earnings Contribution (visual)

* * *

<a id="9-empty-states"></a>

## 9\. Empty States

<a id="scenarios"></a>

### Scenarios

- No referrals
- No downline
- No CPV activity

<a id="ui-actions"></a>

### UI Actions

- Invite Friends CTA
- Share referral link

* * *

<a id="10-reusable-components"></a>

## 10\. Reusable Components

- `TreeNode`
- `TreeView`
- `ProgressBar`
- `StatCard`
- `Modal`
- `CopyButton`

* * *

<a id="11-state-management-mock"></a>

## 11\. State Management (Mock)

```
network: {
  referralLink: string
  teamSummary: {}
  matrix: []
  downline: []
  cpvProgress: {}
}

```

* * *

<a id="12-ux-accessibility-rules"></a>

## 12\. UX & Accessibility Rules

- Zoomable tree view
- Tooltips on nodes
- Mobile fallback to list view
- Clear empty slot indicators

* * *

<a id="13-ui-flow-summary"></a>

## 13\. UI Flow Summary

```
Dashboard
  → Network Overview
      → Referral Link
      → Matrix View
      → Downline List
      → Performance

```

* * *

<a id="14-future-backend-integration-notes"></a>

## 14\. Future Backend Integration Notes

When backend is introduced:

- Enforce forced matrix logic
- Real CPV calculations
- Rank progression
- Permissions on depth view

* * *

<a id="15-status"></a>

## 15\. Status

✅ MLM UI fully defined  
✅ Visualization-ready  
✅ Backend-independent