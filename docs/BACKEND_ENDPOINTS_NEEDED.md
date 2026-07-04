# Backend Endpoints — Integration Status

> Cross-referenced against Swagger at `https://segulah-api.onrender.com/api/docs` (fetched 2026-02-24).
> This is the **user-facing frontend** — admin-only endpoints are excluded.

---

## INTEGRATED ENDPOINTS

These endpoints exist and are now called by the frontend. Hardcoded constants remain as **fallback** in case the API response doesn't include the expected fields.

---

### 1. `GET /settings/commission-rules` ✅

**Integrated in:** `SettingsService.fetchCommissionRules()`

**Consumed by:**
- `level-commission-table.component.ts` — populates the full level table; falls back to `FALLBACK_DATA` if API returns empty
- `earnings-overview.component.ts` — reads `pdpaRates` / `cdpaRates` from response; falls back to `PDPA_RATES` / `CDPA_RATES` constants
- `wallet.component.ts` — reads `cashoutSplit` / `autoshipSplit` from response; falls back to constants

---

### 2. `GET /settings/ranking-rules` ✅

**Integrated in:** `SettingsService.fetchRankingRules()`

**Consumed by:**
- `level-commission-table.component.ts` — ranking bonus column can be populated from this; currently merged into commission-rules response if the backend nests them together
- `ranking.component.ts` — existing integration

---

### 3. `GET /earnings/types` ✅

**Integrated in:** `SettingsService.fetchEarningTypes()`

**Consumed by:**
- Loaded via `earningsService.fetchEarningsSectionData()` which calls `settingsService.fetchAll()`
- Validates that PDPA and CDPA are recognized earning types from the backend
- Can be used to build dynamic filter dropdowns in commission breakdown

---

### 4. `GET /earnings/summary` ✅

**Integrated in:** `EarningsService.fetchEarningsSummary()`

**Consumed by:**
- `earnings-overview.component.ts` — reads `pdpaEarnings` and `cdpaEarnings` from the summary response (looks for `byType.PDPA`, `byType.CDPA`, or direct fields)
- Falls back to client-side aggregation from the earnings list if summary doesn't include PDPA/CDPA

---

### 5. `GET /users/me/upgrade-options` ✅

**Integrated in:** `PaymentService.fetchUpgradeOptions()`

**Consumed by:**
- `package-upgrade.component.ts` — shows available upgrade packages with prices from the API
- Not used at registration (registration form users aren't authenticated yet, so it uses constants)

---

## MISSING ENDPOINTS (need backend implementation)

These endpoints **do not exist** in the Swagger spec. The frontend works around them with static data.

---

### M1. `GET /packages` (Public or Auth)

**Why needed:** The frontend hardcodes all package configuration (registration fee, admin fee, IPV %, PV values, PDPA/CDPA rates, cashout/autoship split, monthly autoship amounts) in `registration.constants.ts`. If the configuration changes server-side, the frontend won't reflect it until a code deploy.

**Expected response:**
```json
[
  {
    "name": "NICKEL",
    "registrationFee": { "NGN": 15000, "USD": 15 },
    "adminFee": { "NGN": 5000, "USD": 5 },
    "ipvPercent": 0.60,
    "instantRegistrationPv": 2,
    "communityRegistrationPv": 0.4,
    "directReferralPercent": 10,
    "pdpaRate": 0.05,
    "cdpaRate": 5,
    "cashoutSplitPercent": 65,
    "autoshipSplitPercent": 35,
    "monthlyAutoshipUsd": 10,
    "autoshipAdminFeeUsd": 1
  }
]
```

**Frontend files that would consume this:**
- `registration.constants.ts` — replace all hardcoded maps
- `register.component.ts` — package info panel at registration

**Priority:** Medium

---

### M2. `GET /autoship/status`

**Why needed:** The wallet page shows a static "Monthly Autoship" card. Users cannot see their due date, payment history, or whether autoship is overdue.

**Expected response:**
```json
{
  "isActive": true,
  "package": "SILVER",
  "monthlyAmountUsd": 10,
  "adminFeeUsd": 1,
  "nextDueDate": "2026-03-15T00:00:00.000Z",
  "lastPaidDate": "2026-02-15T00:00:00.000Z",
  "currency": "NGN",
  "monthlyAmountLocal": 10000,
  "adminFeeLocal": 1000
}
```

**Priority:** High

---

### M3. `POST /autoship/pay`

**Why needed:** Users need to manually trigger monthly autoship payment from their autoship wallet.

**Expected request:**
```json
{ "currency": "NGN" }
```

**Expected response:**
```json
{
  "success": true,
  "message": "Autoship payment processed",
  "nextDueDate": "2026-04-15T00:00:00.000Z"
}
```

**Priority:** High

---

### M4. `GET /earnings/registration-pv`

**Why needed:** After activation, users should see the actual PV credited (Instant Registration PV + Community Registration PV). The frontend will **not** compute this from constants — it must come from the API.

**Expected response:**
```json
{
  "instantRegistrationPv": 5,
  "communityRegistrationPv": 1,
  "creditedAt": "2026-02-24T12:30:00.000Z"
}
```

**Frontend integration:** Earnings overview and CPV milestones pages will display this when the endpoint exists. No frontend-derived fallback.

**Note:** `GET /earnings/cpv` may partially cover this — needs verification.

**Priority:** Medium

---

### M5. IPV (Instant Product Voucher) credited at activation

**Why needed:** The wallet shows voucher balance but does not indicate how much was credited at activation (60% of registration fee). The frontend will **not** compute this — it must come from the API.

**Options (backend chooses one):**

- **Option A:** Extend `GET /wallets` (or wallet response) with per-wallet:
  ```json
  {
    "voucherBalance": 18000,
    "activationVoucherCredit": 18000,
    "activationVoucherCreditedAt": "2026-02-24T12:30:00.000Z"
  }
  ```
- **Option B:** New endpoint `GET /users/me/activation-credits`:
  ```json
  {
    "ipvAmount": 18000,
    "ipvCurrency": "NGN",
    "creditedAt": "2026-02-24T12:30:00.000Z"
  }
  ```

**Frontend integration:** Wallet Balance Breakdown will show "Includes ₦X from activation" under Voucher Balance when the API provides this data. No frontend-derived fallback.

**Priority:** Medium

---

### M6. CPV transactions: `source` and `pvType` for personal vs community PV

**Why needed:** The CPV Activity table should distinguish Instant PV vs Community PV when the backend can provide it. The frontend maps what the API returns — no inference.

**Extend `GET /earnings/cpv` transactions:**
```json
{
  "transactions": [
    {
      "id": "...",
      "amount": "5",
      "source": "REGISTRATION",
      "pvType": "INSTANT",
      "metadata": { "package": "SILVER" },
      "createdAt": "..."
    },
    {
      "id": "...",
      "amount": "1",
      "source": "REGISTRATION",
      "pvType": "COMMUNITY",
      "createdAt": "..."
    }
  ]
}
```

**Frontend integration:** `mapCpvResponse` will map `source` and `pvType` from each transaction. UI will show "Registration (Instant PV)" or "Registration (Community PV)" when available.

**Priority:** Low

---

## Summary

| # | Endpoint | Status | Frontend Service |
|---|---|---|---|
| 1 | `GET /settings/commission-rules` | ✅ Integrated | `SettingsService` |
| 2 | `GET /settings/ranking-rules` | ✅ Integrated | `SettingsService` |
| 3 | `GET /earnings/types` | ✅ Integrated | `SettingsService` |
| 4 | `GET /earnings/summary` | ✅ Integrated | `EarningsService` |
| 5 | `GET /users/me/upgrade-options` | ✅ Integrated | `PaymentService` |
| M1 | `GET /packages` | ❌ Missing | — |
| M2 | `GET /autoship/status` | ❌ Missing | — |
| M3 | `POST /autoship/pay` | ❌ Missing | — |
| M4 | `GET /earnings/registration-pv` | ❌ Missing | — |
| M5 | IPV in wallet / activation-credits | ❌ Missing | — |
| M6 | CPV transactions `source` + `pvType` | ❌ Missing | — |

---

*Last updated: 2026-02-24*
*Swagger source: `https://segulah-api.onrender.com/api/docs-json`*
*Frontend branch: `registeration-activation`*
