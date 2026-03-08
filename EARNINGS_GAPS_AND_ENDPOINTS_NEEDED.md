# Earnings Gaps & Required Backend Endpoints

> **Source:** [new-project-gaps (1).md](new-project-gaps%20(1).md) — sections 2 (17 Earning Gateways), 4 (Level Commission), 5 (CPV Milestones).  
> This doc lists **what is still not done** for each earning type and the **exact endpoints** the backend must expose so the frontend can display them.

---

## 1. Registration & Daily Allocations

| # | Earning Type | Frontend status | What's missing |
|---|--------------|-----------------|----------------|
| 1 | **PDPA** (Personal Daily Proceeds Allocation) | ⚠️ UI exists, **data from API only** | Frontend shows rate + accumulated only if backend sends them. **Rate** must come from `GET /settings/commission-rules` (e.g. `pdpaRates` by package). **Accumulated** must come from `GET /earnings/summary`. |
| 2 | **CDPA** (Community Daily Proceeds Allocation) | ⚠️ Same as PDPA | Same as above: rate from commission-rules, accumulated from earnings/summary. |

### Endpoints required (already exist — response shape must include)

- **`GET /settings/commission-rules`**  
  Response must include per-package rates so the frontend can show "Your PDPA rate: X%" and "Your CDPA rate: Y%":
  ```json
  {
    "levels": [ ... ],
    "pdpaRates": { "NICKEL": 0.05, "SILVER": 0.08, "GOLD": 0.1, "PLATINUM": 0.15, "RUBY": 0.18, "DIAMOND": 0.2 },
    "cdpaRates": { "NICKEL": 5, "SILVER": 10, "GOLD": 15, "PLATINUM": 20, "RUBY": 25, "DIAMOND": 30 }
  }
  ```

- **`GET /earnings/summary`**  
  Response must include PDPA and CDPA totals (so the overview cards show accumulated amounts):
  ```json
  {
    "totalEarnings": 50000,
    "byType": {
      "PDPA": 1200,
      "CDPA": 3500,
      "Direct Referral": 10000,
      ...
    }
  }
  ```
  Alternatively: top-level `pdpaEarnings` and `cdpaEarnings` (frontend already maps both).

- **`GET /earnings`** (list)  
  Each ledger entry for PDPA/CDPA must use `type` (or `earningType`) values the frontend can map to `"PDPA"` and `"CDPA"` (e.g. `PDPA`, `CDPA`, `PERSONAL_DAILY`, `COMMUNITY_DAILY`). Frontend normalizer already handles these.

---

## 2. Referral Commissions

| # | Earning Type | Frontend status | What's missing |
|---|--------------|-----------------|----------------|
| 3 | Direct Referral Bonus | ✅ Done | Shown in breakdown; `normalizeEarningType` handles `DIRECT_REFERRAL`. No new endpoint. |
| 4 | **Community Referral Bonus (13 levels)** | ⚠️ Partial | "Community Bonus" exists in normalizer and breakdown, but **no level-by-level breakdown** (which level each bonus came from). |

### Endpoints required

- **`GET /earnings/summary`** (extend)  
  Expose community bonus **per level** so the frontend can show a table (e.g. "Level 1: ₦X, Level 2: ₦Y, …"):
  ```json
  {
    "communityBonus": 15000,
    "communityBonusByLevel": [
      { "level": 1, "amount": 5000, "currency": "NGN" },
      { "level": 2, "amount": 3000, "currency": "NGN" },
      ...
    ]
  }
  ```
  If the backend cannot add this to summary, a **dedicated endpoint** is needed:

- **`GET /earnings/community-by-level`** (new, if summary cannot be extended)  
  Response: array of `{ level: number, amount: number, currency: string }` for levels 1–13.

---



## 3. CPV & Milestones

| # | Earning Type | Frontend status | What's missing |
|---|--------------|-----------------|----------------|
| 11 | **CPV Cash Bonus** | ⚠️ Partial | DTO and UI exist; **API returns 0** and milestone data is empty. |
| 12 | **CPV Milestone Incentives** | ⚠️ Partial | UI template exists with empty state; **API doesn't return the 12 milestone tiers** from project.md. |

### Endpoints required

- **`GET /earnings/cpv`** (exists)  
  Response must populate:
  - **`cpvCashBonus`** (or `cashBonus`) — total CPV cash bonus credited to the user (not 0 when they have earned it).
  - **`milestones`** — array of **12 tiers** matching project.md (e.g. 40, 100, 1K, 5K, 20K, 50K, 120K, 500K, 1M, 5M CPVs with cash/material awards). Each item should include at least:
    - `cpvRequired` / `threshold`
    - `reward` (e.g. "$2", "Washing Machine")
    - `rewardAmount` (optional)
    - `achieved: boolean`
    - `achievedDate` (optional)
  - **`totalCpv`** or **`personalCpv`** / **`teamCpv`** so progress to next milestone can be shown.

  Example shape the frontend already maps (see `mapCpvResponse` in `earnings.service.ts`):
  ```json
  {
    "totalCpv": 2500,
    "personalCpv": 500,
    "teamCpv": 2000,
    "requiredCpv": 5000,
    "currentStage": 1,
    "totalStages": 6,
    "cpvCashBonus": 78,
    "nextMilestoneName": "5,000 CPVs",
    "milestones": [
      { "name": "40 CPVs", "cpvRequired": 40, "reward": "$2", "rewardAmount": 2, "achieved": true, "achievedDate": "2026-01-10T00:00:00Z" },
      { "name": "100 CPVs", "cpvRequired": 100, "reward": "$6", "rewardAmount": 6, "achieved": true, "achievedDate": "2026-01-15T00:00:00Z" },
      ...
    ],
    "transactions": [ ... ]
  }
  ```

- **`GET /settings/cpv-milestones`** (exists)  
  Should return the **definition** of the 12 tiers (thresholds, cash award, material award) so the frontend can display "Next: 5,000 CPVs → $100 + Washing Machine". If milestone definitions are only in `GET /earnings/cpv`, that is acceptable as long as all 12 tiers are present.

---

## Summary: Endpoints That Must Expose These Earnings

| Earning / Feature | Endpoint | Required response fields / behavior |
|-------------------|----------|-------------------------------------|
| PDPA rate | `GET /settings/commission-rules` | `pdpaRates` by package (e.g. NICKEL: 0.05, …) |
| CDPA rate | `GET /settings/commission-rules` | `cdpaRates` by package |
| PDPA / CDPA accumulated | `GET /earnings/summary` | `byType.PDPA`, `byType.CDPA` or top-level `pdpaEarnings`, `cdpaEarnings` |
| PDPA / CDPA in list | `GET /earnings` | Each entry `type` / `earningType`: `PDPA`, `CDPA` (or PERSONAL_DAILY, COMMUNITY_DAILY) |
| Community bonus by level | `GET /earnings/summary` or `GET /earnings/community-by-level` | `communityBonusByLevel`: [{ level, amount, currency }] for levels 1–13 |
| Matching bonus qualification | `GET /earnings/matching-bonus-status` | `qualified`, `totalEarned`, optional counts for UX copy |
| Ranking bonus earned/paid | `GET /earnings/ranking` | `rankingBonuses` or `stageBonuses`: [{ stage, rankName, bonusUsd, earned, paidAt }] |
| CPV cash bonus | `GET /earnings/cpv` | `cpvCashBonus` (or `cashBonus`) populated when user has earned it |
| CPV 12 milestones | `GET /earnings/cpv` | `milestones`: 12 items with `cpvRequired`, `reward`, `achieved`, `achievedDate` |

---

*Document generated from new-project-gaps (1).md sections 34–38, 40–46, 56–61, 63–68.*  
*Note: Update this document when the enpoint is done*
