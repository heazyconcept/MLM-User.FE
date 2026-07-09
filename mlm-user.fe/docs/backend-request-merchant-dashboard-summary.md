# Backend Request — Merchant Dashboard Summary Endpoint

**Date:** 2026-07-08  
**From:** User FE (`mlm-user.fe`)  
**Related:** [MERCHANTS_API.md](./MERCHANTS_API.md), [MERCHANTS_FRONTEND_GUIDE.md](./MERCHANTS_FRONTEND_GUIDE.md), [merchant-flow-frontend.md](./merchant-flow-frontend.md)  
**Status:** Request for backend implementation  
**Reported issue:** Merchant dashboard loads multiple endpoints and computes summary metrics on the client. Totals are incomplete or inaccurate (e.g. sales summed from the first page of orders only). Chart/trend data is hardcoded on the frontend.

---

## 1. Problem

The **Merchant Dashboard** (`/merchant/dashboard`) needs a single backend summary for the hero cards, stat tiles, and trend widgets shown in the UI.

### Current frontend behaviour (today)

On dashboard load for an **ACTIVE** merchant, the frontend calls:

| Call | Purpose |
|------|---------|
| `GET /merchants/me` | Profile / status gate |
| `GET /merchants/earnings/summary` | Merchant earnings total + breakdown |
| `GET /merchants/orders?limit=20&offset=0` | Orders list (also used for sales total + pending count) |
| `GET /merchants/inventory` | Full inventory list (product count + low/out count) |
| `GET /merchants/me/allocations` | Allocations (actionable count badge) |
| `GET /merchants/me/stock-disputes` | Disputes needing acknowledgement |

**Limitations:**

1. **Total merchant sales** is computed client-side as the sum of `totalAmount` on the **current orders page** (default 20 rows), not all historical sales.
2. **Pending fulfillments** counts only orders on the current page, not all pending orders assigned to the merchant.
3. **Inventory summary** requires fetching the **entire** inventory list just to show `total products` and `low/out` counts.
4. **7-day sales trend** and **month-over-month growth** are **hardcoded mock data** on the frontend — not from the API.
5. **Recent activity** is stitched together from the first few orders and deliveries returned by separate list endpoints.
6. Six HTTP requests on every dashboard visit — slower load, more failure points, harder to keep numbers consistent.

---

## 2. Requested endpoint

### `GET /merchants/dashboard/summary`

**Purpose:** Return aggregated dashboard metrics for the authenticated merchant in one response.

**Auth:** Bearer token. Merchant must exist and have status **`ACTIVE`** (same guard as other merchant operational endpoints). Return **`403`** for non-active merchants.

**Query params (optional):**

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `trendDays` | number | `7` | Number of days for sales trend series |
| `salesMonths` | number | `7` | Number of months for sales overview bars |

---

## 3. Proposed response shape

```json
{
  "currency": "NGN",
  "sales": {
    "totalSales": 10000,
    "salesChangePct": 12,
    "trend": {
      "period": "7d",
      "points": [
        { "date": "2026-07-02", "amount": 1200 },
        { "date": "2026-07-03", "amount": 800 }
      ],
      "changePctVsPreviousPeriod": 15
    },
    "monthlyOverview": [
      { "month": "2026-01", "label": "Jan", "amount": 5000 },
      { "month": "2026-02", "label": "Feb", "amount": 12000 }
    ]
  },
  "orders": {
    "pendingFulfillments": 0,
    "pendingByStatus": {
      "ASSIGNED_TO_MERCHANT": 0,
      "READY_FOR_PICKUP": 0,
      "OFFLINE_DELIVERY_REQUESTED": 0
    }
  },
  "inventory": {
    "totalProducts": 5,
    "lowStockCount": 0,
    "outOfStockCount": 0,
    "lowOrOutCount": 0
  },
  "earnings": {
    "totalEarnings": 7141.6,
    "availableEarnings": 5000,
    "pendingEarnings": 2141.6,
    "byType": {
      "personalProduct": 1000,
      "directReferralProduct": 2000,
      "communityProduct": 500,
      "deliveryBonus": 3641.6
    }
  },
  "allocations": {
    "actionableCount": 2
  },
  "recentActivity": [
    {
      "id": "act-uuid",
      "type": "ORDER_RECEIVED",
      "title": "New Order",
      "description": "Order 940d41a4…",
      "amount": 40000,
      "currency": "NGN",
      "occurredAt": "2026-06-24T15:31:40.046Z",
      "metadata": {
        "orderId": "940d41a4-f9b4-4d7f-8e76-430d6c997a64"
      }
    }
  ]
}
```

---

## 4. Field definitions

### 4.1 Sales

| Field | Type | Description |
|-------|------|-------------|
| `totalSales` | number | Sum of **completed / paid** order amounts assigned to this merchant (all time, or configurable window — see §5) |
| `salesChangePct` | number \| null | % change vs previous calendar month (for “sales up X% this month” banner). `null` if not enough data. |
| `trend.points[]` | array | Daily sales totals for sparkline (last N days) |
| `trend.changePctVsPreviousPeriod` | number \| null | % change vs prior equal-length period (e.g. last 7 days vs previous 7 days) |
| `monthlyOverview[]` | array | Monthly sales totals for bar chart (last N months) |

**Amounts:** Main currency units (NGN or USD), consistent with existing merchant order/earnings endpoints.

### 4.2 Orders

| Field | Type | Description |
|-------|------|-------------|
| `pendingFulfillments` | number | Count of assigned orders still awaiting merchant action |
| `pendingByStatus` | object | Optional breakdown for debugging / future UI filters |

**Include order statuses:**

- `ASSIGNED_TO_MERCHANT`
- `READY_FOR_PICKUP`
- `OFFLINE_DELIVERY_REQUESTED`

(Align with current frontend `pendingFulfilmentsCount` logic.)

### 4.3 Inventory

| Field | Type | Description |
|-------|------|-------------|
| `totalProducts` | number | Count of distinct products in merchant inventory (`GET /merchants/inventory` items length) |
| `lowStockCount` | number | Items with `stockStatus = LOW_STOCK` |
| `outOfStockCount` | number | Items with `stockStatus = OUT_OF_STOCK` |
| `lowOrOutCount` | number | `lowStockCount + outOfStockCount` (convenience for UI badge) |

**Note:** Items with `stockStatus = null` should not count as low/out unless business rules say otherwise.

### 4.4 Earnings

Reuse the **`merchantEarnings`** slice from existing `GET /merchants/earnings/summary` (do not duplicate network earnings on the dashboard unless requested later):

| Field | Type | Description |
|-------|------|-------------|
| `totalEarnings` | number | Total merchant earnings |
| `availableEarnings` | number | Withdrawable balance |
| `pendingEarnings` | number | Pending / locked earnings |
| `byType` | object | Breakdown by earning type (same keys as earnings summary) |

Top-level `currency` applies to sales and earnings.

### 4.5 Allocations (optional but useful)

| Field | Type | Description |
|-------|------|-------------|
| `actionableCount` | number | Allocations in `DELIVERED` status awaiting confirm-receipt **plus** stock disputes in `ADMIN_REJECTED` awaiting merchant acknowledgement |

Matches current frontend `actionableAllocationCount` on Quick Actions badge.

### 4.6 Recent activity (optional)

| Field | Type | Description |
|-------|------|-------------|
| `recentActivity[]` | array | Last 5–10 merchant-relevant events (new order assigned, delivery confirmed, earning credited, allocation delivered) |

If omitted, frontend can keep building activity from list endpoints — but a unified feed is preferred for consistency.

**Suggested `type` values:**

- `ORDER_RECEIVED`
- `DELIVERY_CONFIRMED`
- `EARNING_CREDITED`
- `ALLOCATION_DELIVERED`
- `STOCK_DISPUTE_OPENED`

---

## 5. Business rules (backend to confirm)

1. **What counts as “total sales”?**  
   Recommend: sum of `totalAmount` on orders assigned to this merchant with status in a **completed/settled** set (e.g. `DELIVERED`, `COMPLETED`, `FULFILLED`) **or** all paid assigned orders excluding `CANCELLED` / `FAILED`. Document the exact status filter.

2. **Currency:** Single currency per merchant user (NGN or USD from user profile). Do not mix currencies in one total.

3. **Trend windows:** Daily trend = calendar days in merchant/user timezone (confirm with backend). Monthly overview = calendar months.

4. **Caching:** Summary may be cached briefly (e.g. 30–60s) if expensive; frontend will refetch on navigation and after order/inventory actions.

5. **Inactive merchants:** Return `403` with message like `"Merchant not active"` — same as other operational endpoints.

---

## 6. UI mapping (what the frontend will show)

| Dashboard UI element | Summary field |
|---------------------|---------------|
| Hero — **Total Merchant Sales** | `sales.totalSales` |
| Hero — **Pending Orders** | `orders.pendingFulfillments` |
| Hero — **Products Low/Out** | `inventory.lowOrOutCount` |
| Hero — **7-Day Sales Trend** sparkline | `sales.trend.points` |
| Hero — **↑ X% vs last week** | `sales.trend.changePctVsPreviousPeriod` |
| Banner — **sales up X% this month** | `sales.salesChangePct` |
| Stat card — **Total Merchant Sales** | `sales.totalSales` |
| Stat card — **Pending Fulfillments** | `orders.pendingFulfillments` |
| Stat card — **Inventory Summary** | `inventory.totalProducts` + `inventory.lowOrOutCount` |
| Stat card — **Merchant Earnings** | `earnings.totalEarnings` |
| Sales Overview bar chart | `sales.monthlyOverview` |
| Earnings Breakdown | `earnings.byType` |
| Recent Activity list | `recentActivity` |
| Allocations nav badge | `allocations.actionableCount` |

---

## 7. Frontend integration plan (after backend ships)

1. Add `fetchDashboardSummary()` to `MerchantService` calling `GET /merchants/dashboard/summary`.
2. Replace dashboard `ngOnInit` multi-fetch with a **single summary call** (+ keep `GET /merchants/me` for status gate if needed).
3. Remove client-side `totalMerchantSales`, `pendingFulfilmentsCount`, and `inventorySummary` computed signals for dashboard (keep inventory list fetch only on Inventory page).
4. Remove hardcoded chart data in `merchant-dashboard.component.ts`.
5. Add TypeScript interface `MerchantDashboardSummary` aligned with response above.

---

## 8. Acceptance criteria

- [ ] `GET /merchants/dashboard/summary` returns **200** for ACTIVE merchants with all fields in §3.
- [ ] `totalSales` reflects **all** qualifying orders, not a paginated subset.
- [ ] `pendingFulfillments` reflects **all** pending assigned orders.
- [ ] `inventory.totalProducts` matches count from `GET /merchants/inventory` without requiring full list on dashboard.
- [ ] `inventory.lowOrOutCount` matches LOW_STOCK + OUT_OF_STOCK counts.
- [ ] `earnings` matches `merchantEarnings` from `GET /merchants/earnings/summary` for the same user.
- [ ] `sales.trend` returns at least 7 daily data points when merchant has order history.
- [ ] Returns **403** for PENDING / SUSPENDED / non-merchant users.
- [ ] Amounts use main currency units (not kobo/cents unless documented otherwise).
- [ ] OpenAPI / Swagger updated with new route and schema.

---

## 9. Out of scope (for this request)

- Admin dashboard summary
- Network earnings on merchant dashboard (already available via separate earnings endpoints if needed)
- Real-time WebSocket push of summary updates (frontend can poll/refetch on navigation)

---

## 10. Priority

**High** — Dashboard is the merchant landing page. Incorrect totals (especially sales from paginated orders) undermine trust in the platform.
