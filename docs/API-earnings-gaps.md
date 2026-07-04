# Earnings & Commission API Gaps

> **Date:** 2026-02-21  
> **Context:** Frontend displays commissions, CPV, ranking, bonuses, and milestone pages. This document lists data the frontend needs but the API does **not** currently provide.

---

## 1. `GET /earnings/cpv` — CPV Summary

### What the API returns
```json
{
  "totalCpv": 0.4,
  "lastUpdated": "2026-02-21T13:48:29.889Z",
  "transactions": [
    {
      "id": "...",
      "userId": "...",
      "amount": "0.4",
      "source": "REGISTRATION",
      "sourceId": "...",
      "metadata": { "amount": 20, "package": "SILVER" },
      "createdAt": "2026-02-21T13:48:29.380Z"
    }
  ]
}
```

### What the frontend needs but is MISSING

| Missing Field | Used In | Why It's Needed |
|---------------|---------|-----------------|
| `personalCpv` | CPV summary card — "Personal CPV" | Currently the API only returns `totalCpv` with no personal/team split. Frontend shows a dedicated "Personal CPV" card. |
| `teamCpv` | CPV summary card — "Team CPV" | Same — needs a team CPV value. Currently hardcoded to `0`. |
| `requiredCpv` | Next milestone progress bar | The CPV threshold needed for the next milestone. Used to show "X pts to go". |
| `currentStage` | CPV milestone progress | Stage the user is currently at (e.g. Stage 2 of 5). |
| `totalStages` | CPV milestone progress | Total number of stages available. |
| `cpvCashBonus` | Bonuses page — CPV Cash Bonus card | Cash bonus amount earned from reaching CPV milestones. |
| `nextMilestoneName` | Next milestone progress section | Name/label of the next milestone target (e.g. "500 CPV Club"). |
| `milestones[]` | Milestones list UI | Array of milestone objects. Each needs: `name`, `cpvRequired`, `reward`, `rewardAmount`, `achieved` (bool), `achievedDate`. Currently shows "No milestones yet" empty state. |

### Suggested API response shape
```json
{
  "totalCpv": 0.4,
  "personalCpv": 0.4,
  "teamCpv": 0,
  "requiredCpv": 100,
  "currentStage": 0,
  "totalStages": 6,
  "cpvCashBonus": 0,
  "nextMilestoneName": "First 100 CPV",
  "lastUpdated": "2026-02-21T13:48:29.889Z",
  "milestones": [
    {
      "name": "First 100 CPV",
      "cpvRequired": 100,
      "reward": "Welcome Bonus",
      "rewardAmount": 1000,
      "achieved": false,
      "achievedDate": null
    }
  ],
  "transactions": [ ... ]
}
```

---

## 2. `GET /earnings/summary` — Earnings Summary

### What the frontend needs but may be MISSING

| Missing Field | Used In | Why It's Needed |
|---------------|---------|-----------------|
| `communityBonus` | Bonuses page — Community Bonus card | Total community bonus earned. |
| `productBonus` | Bonuses page — Product Purchase Bonus card | Total product bonus earned. |
| `matchingBonus` | Bonuses page — Matching Bonus card | Total matching bonus earned. |
| `totalEarnings` | Earnings overview — Lifetime Earnings | Aggregate total earned across all types. |
| `pendingAmount` | Earnings overview — Pending stat | Total amount pending approval/payout. |
| `availableAmount` | Earnings overview — Available stat | Total available for withdrawal. |
| `withdrawnAmount` | Earnings overview — Withdrawn stat | Total already withdrawn. |

> **Note:** We haven't verified the actual response of `GET /earnings/summary` — add `console.log` to `fetchEarningsSummary()` to confirm which of these fields the API actually returns.

---

## 3. `GET /earnings/ranking` — Ranking

### What the frontend needs but may be MISSING

| Missing Field | Used In | Why It's Needed |
|---------------|---------|-----------------|
| `currentRank` | Ranking status card — "Member Status" | Current rank name (e.g. "Silver", "Gold"). |
| `nextRank` | Ranking status card — "Next Level" | Name of the next rank to achieve. |
| `progressPercentage` | Progress bar — "X% complete" | Overall percentage towards next rank. |
| `currentStage` / `totalStages` | Progress bar — "Stage X/Y" | Stage tracking. |
| `requirements[]` | Requirements checklist | Array of requirement objects, each with `label`, `current`, `required`, `completed`. |
| `achievedRanks[]` | Achievement timeline | Array of past rank achievements with `rank` and `achievedDate`. |

> **Note:** This endpoint needs verification too. Add `console.log` to `fetchRanking()` to confirm.

---

## 4. `GET /earnings` — Earnings List

### What the frontend needs but may be MISSING

| Missing Field | Used In | Why It's Needed |
|---------------|---------|-----------------|
| `type` or `earningType` | Commission breakdown — Type column | Type label (e.g. "DIRECT_REFERRAL", "COMMUNITY"). |
| `status` | Commission breakdown — Status badge | Entry status (e.g. "PENDING", "APPROVED"). |
| `currency` | Amount display | "NGN" or "USD" to show correct symbol. |
| `source` or `narrative` | Transaction description | Human-readable source label. |

> **Note:** This endpoint likely works since earnings list entries are visible. Verify the exact field names.

---

## 5. Missing Endpoints (Not Available At All)

| What's Needed | Current Workaround | Suggested Endpoint |
|---------------|-------------------|--------------------|
| **Bonus qualification status** | Derived from earnings summary amounts. Can't tell if user is "In Progress" vs "Not Qualified" for a specific bonus. | `GET /earnings/bonuses` — returns each bonus type with `qualificationStatus`, `earnedStatus`, `amount`, `requirements[]` |
| **CPV milestones definition** | Milestones section shows empty. No API provides the milestone tiers. | Include `milestones[]` in `GET /earnings/cpv` (see suggested shape above) |
| **Earnings history by period** | Chart aggregates the earnings list by date client-side, which is limited to however many entries the list returns. | `GET /earnings/history?period=daily&range=30d` — returns pre-aggregated totals per period for charting |
| **Withdrawal totals** | The earnings overview shows "Already Withdrawn" but we don't have a summary endpoint for total withdrawn amount. | Include `withdrawnAmount` in `GET /earnings/summary` |

---

## Priority Ranking

| Priority | Gap | Impact |
|----------|-----|--------|
| 🔴 **High** | CPV endpoint missing `personalCpv` / `teamCpv` split | Two of three CPV cards show incorrect data |
| 🔴 **High** | CPV endpoint missing `milestones[]` | Entire milestones section is empty |
| 🔴 **High** | CPV endpoint missing `requiredCpv` | Progress bar to next milestone can't function |
| 🟡 **Medium** | Earnings summary missing bonus breakdowns | Bonuses page falls back to locked placeholder cards |
| 🟡 **Medium** | No pre-aggregated earnings history | Chart works but requires client-side aggregation of raw entries |
| 🟡 **Medium** | Ranking endpoint — needs verification | May already work; needs console.log check |
| 🟢 **Low** | No bonus qualification endpoint | Workaround in place (derive from summary amounts) |
| 🟢 **Low** | No `withdrawnAmount` in summary | Could be derived from wallet endpoint |

---

## Immediate Next Steps

1. **Backend team:** Review and implement the missing fields in `GET /earnings/cpv` (priority: `personalCpv`, `teamCpv`, `requiredCpv`, `milestones[]`)
2. **Backend team:** Confirm the response shape of `GET /earnings/summary` and `GET /earnings/ranking` — add the missing fields listed above if they're not already present
3. **Frontend:** Add `console.log` to `fetchEarningsSummary()` and `fetchRanking()` to verify their actual response shapes, then update mappers accordingly (same as we just did for CPV)
