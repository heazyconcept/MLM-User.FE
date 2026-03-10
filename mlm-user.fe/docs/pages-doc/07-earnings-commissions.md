# 07-earnings-commissions

<a id="07-earnings-commissionsmd"></a>

# 07-earnings-commissions.md

**User Interface Specification – Earnings & Commissions**

* * *

<a id="1-purpose"></a>

## 1\. Purpose

This document defines the **Earnings & Commissions UI**, which allows users to:

- Understand how they earn
- View earnings breakdown by type
- Track bonuses, ranks, and milestones

> ⚠️ UI-only specification  
> All earnings data is mocked. No calculation logic enforced.

* * *

<a id="2-entry-points"></a>

## 2\. Entry Points

| Trigger | Route |
| --- | --- |
| Sidebar → Earnings | `/earnings` |
| Dashboard → Earnings card | `/earnings/overview` |

* * *

<a id="3-earnings-layout"></a>

## 3\. Earnings Layout

<a id="tabs-sections"></a>

### Tabs / Sections

1. Overview
2. Earnings Breakdown
3. Bonuses
4. Ranking & Stages
5. CPV & Milestones

* * *

<a id="4-earnings-overview"></a>

## 4\. Earnings Overview

<a id="route"></a>

### Route

```
/earnings/overview

```

<a id="ui-components"></a>

### UI Components

- Total Earnings (lifetime)
- Available vs Pending earnings
- Earnings trend (mock chart)
- Wallet impact summary

* * *

<a id="5-earnings-breakdown"></a>

## 5\. Earnings Breakdown

<a id="route"></a>

### Route

```
/earnings/breakdown

```

<a id="ui-components"></a>

### UI Components

- Earnings grouped by type
- Expandable rows
- Date filter

<a id="earnings-types-displayed"></a>

### Earnings Types (Displayed)

- Direct Referral Bonus
- Community Bonus
- Product Purchase Bonus
- Matching Bonus
- Leadership Bonus
- Merchant Bonuses (if applicable)

* * *

<a id="6-bonuses"></a>

## 6\. Bonuses

<a id="route"></a>

### Route

```
/earnings/bonuses

```

<a id="ui-components"></a>

### UI Components

- Bonus list
- Bonus description
- Qualification status
- Earned / Pending badge

* * *

<a id="7-ranking-stages"></a>

## 7\. Ranking & Stages

<a id="route"></a>

### Route

```
/earnings/ranking

```

<a id="ui-components"></a>

### UI Components

- Current rank
- Stage progress bar
- Next rank requirements
- Achieved ranks history

* * *

<a id="8-cpv-milestones"></a>

## 8\. CPV & Milestones

<a id="route"></a>

### Route

```
/earnings/cpv

```

<a id="ui-components"></a>

### UI Components

- Total CPV
- Progress towards next milestone
- Milestone rewards list
- Achieved milestones

* * *

<a id="9-empty-states"></a>

## 9\. Empty States

<a id="scenarios"></a>

### Scenarios

- No earnings yet
- No bonuses qualified

<a id="ui-actions"></a>

### UI Actions

- Invite Friends
- Browse Products
- Learn How to Earn

* * *

<a id="10-reusable-components"></a>

## 10\. Reusable Components

- `EarningsCard`
- `ProgressTracker`
- `ExpandableList`
- `Badge`
- `Chart`
- `InfoTooltip`

* * *

<a id="11-state-management-mock"></a>

## 11\. State Management (Mock)

```
earnings: {
  total: number
  breakdown: []
  bonuses: []
  rank: {}
  cpv: {}
}

```

* * *

<a id="12-ux-accessibility-rules"></a>

## 12\. UX & Accessibility Rules

- Clear explanations per earning type
- Tooltips for complex terms
- Consistent currency formatting
- Mobile-friendly charts

* * *

<a id="13-ui-flow-summary"></a>

## 13\. UI Flow Summary

```
Dashboard
  → Earnings Overview
      → Breakdown
      → Bonuses
      → Ranking
      → CPV

```

* * *

<a id="14-future-backend-integration-notes"></a>

## 14\. Future Backend Integration Notes

When backend is introduced:

- Replace mock earnings
- Enforce earning rules
- Real-time rank progression
- Ledger linking

* * *

<a id="15-status"></a>

## 15\. Status

✅ Earnings UI defined  
✅ Educational & transparent  
✅ Backend-independent