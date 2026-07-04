# Earnings Summary Fix

> **Issue:** `GET /earnings/summary` returns `{ "totalEarned": 6 }` but the frontend shows 0, and the currency is unclear for NGN users.

---

## 1. Mapper Fix (Frontend)

**File:** `mlm-user.fe/src/app/services/earnings.service.ts`

**Problem:** The API returns `totalEarned` at the top level. The mapper only checks `earnings?.['totalEarned']` (nested) and never `raw['totalEarned']`, so the value is ignored.

**Fix:** Add `raw['totalEarned']` to the fallback chain in `mapEarningsResponse`:

```ts
// Before (line ~267):
totalEarnings: Number(earnings?.['totalEarned'] ?? raw['totalEarnings'] ?? raw['total_earnings'] ?? 0),

// After:
totalEarnings: Number(raw['totalEarned'] ?? earnings?.['totalEarned'] ?? raw['totalEarnings'] ?? raw['total_earnings'] ?? 0),
```

---

## 2. Currency Clarity (Backend + Frontend)

**Problem:** Showing "6" without context is confusing for NGN users. It's unclear whether the backend returns NGN or USD.

**Backend recommendation:** Add `currency` to the response so the frontend knows how to display:

```json
{
  "totalEarned": 6,
  "currency": "NGN"
}
```

Or, if amounts are in USD:

```json
{
  "totalEarned": 6,
  "currency": "USD"
}
```

**Frontend (once backend adds currency):**

1. Extend `EarningsSummaryDto` with `currency?: 'NGN' | 'USD'`
2. Map `raw['currency']` in `mapEarningsResponse`
3. Use this currency when displaying earnings (or convert to user's display currency if different)

---
