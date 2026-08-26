# Backend Request — Merchant Per-Product Delivery Totals

**Date:** 2026-08-26  
**From:** User FE (`mlm-user.fe`)  
**Status:** Request for backend change  
**Severity:** Medium  
**Area:** Merchant deliveries, fulfilment reporting  

**Related docs:**

- [MERCHANTS_API.md](./MERCHANTS_API.md) — `GET /merchants/deliveries`
- [backend-request-merchant-delivery-history.md](./backend-request-merchant-delivery-history.md) — fulfilment history gaps (pickup excluded from confirmations)

**Related frontend:**

- Page: `src/app/pages/merchant/merchant-deliveries/`
- Service: `src/app/services/merchant.service.ts` — `fetchProductDeliverySummary()`

---

## 1. Summary

Merchants need a **per-product totals** view on **Merchant Center → Deliveries**: how many units of each product they have delivered (e.g. Product A → 120 units, Product B → 45 units).

Today `GET /merchants/deliveries` returns **confirmation rows** only (order id, confirmedBy, date, notes/proof). It does **not** aggregate quantities by product. The FE will **not** client-aggregate from that list (incomplete for pickup, pagination, missing items).

---

## 2. Problem

| Current | Needed |
|---------|--------|
| List of delivery confirmation events | Totals of units delivered **per product** |
| No product name / quantity on the page | `productName` + `totalQuantityDelivered` |
| Pickup fulfilments often missing from confirmations | Include fulfilment-complete pickup orders |

---

## 3. Requested endpoint

### `GET /merchants/deliveries/product-summary`

**Purpose:** Return aggregated delivered unit counts per product for the authenticated merchant. **Merchant-only.**

**Does not replace** `GET /merchants/deliveries` (confirmations list can remain for other uses).

#### Request

| Item | Value |
|------|--------|
| Method | `GET` |
| Path | `/merchants/deliveries/product-summary` |
| Auth | Merchant guard (same as other `/merchants/*`) |

**Query (optional, for later FE filters — v1 FE may omit):**

| Param | Type | Notes |
|-------|------|--------|
| `fromDate` | ISO date | Inclusive lower bound on completion / confirmation time |
| `toDate` | ISO date | Inclusive upper bound |

#### Response (200)

```json
{
  "products": [
    {
      "productId": "uuid",
      "productName": "Product A",
      "totalQuantityDelivered": 120
    },
    {
      "productId": "uuid-2",
      "productName": "Product B",
      "totalQuantityDelivered": 45
    }
  ],
  "totalProducts": 2,
  "totalUnits": 165
}
```

| Field | Type | Meaning |
|-------|------|---------|
| `products` | array | One row per distinct `productId` |
| `products[].productId` | string (uuid) | Product id |
| `products[].productName` | string | Display name at aggregation time (or current catalog name) |
| `products[].totalQuantityDelivered` | number | Sum of line-item quantities across qualifying orders |
| `totalProducts` | number | `products.length` |
| `totalUnits` | number | Sum of all `totalQuantityDelivered` |

Empty merchant / no qualifying orders:

```json
{
  "products": [],
  "totalProducts": 0,
  "totalUnits": 0
}
```

---

## 4. Aggregation rules

1. **Scope:** Only orders where `selectedMerchantId` = authenticated merchant profile id.
2. **Qualifying order statuses** (fulfilment-complete for this merchant):
   - `DELIVERED`
   - `COMPLETED`
   - `PICKED_UP` (pickup handoff — must be included so pickup is not invisible the way confirmations are today)
3. **Aggregate** by `productId`; sum each line item’s `quantity`.
4. **Sort** `products` by `totalQuantityDelivered` descending.
5. **Do not** double-count the same order/item if multiple confirmation events exist for one order.

---

## 5. Acceptance criteria

1. Merchant with three delivered orders containing Product A (qty 2, 3, 5) sees Product A → `10`.
2. Two different products appear as two rows; `totalProducts` = 2; `totalUnits` = sum of both.
3. Pickup order after `mark-picked-up` (`PICKED_UP`) contributes to totals even if no `confirm-delivery` row exists.
4. Merchant with no qualifying orders gets empty `products` and zeros (200, not error).
5. Another merchant’s deliveries never appear in this merchant’s summary.

---

## 6. FE follow-up (User FE)

1. Call `GET /merchants/deliveries/product-summary` from **Products Delivered** (`/merchant/deliveries/products`).
2. Keep **Delivery History** (`/merchant/deliveries`) on confirmations via `GET /merchants/deliveries`.
3. Side menu: **Deliveries** → Delivery History | Products Delivered.
4. Show a table: **Product** | **Units delivered**, plus `totalProducts` / `totalUnits` meta.
5. Optional later: date-range UI using `fromDate` / `toDate`.

---

## 7. References (FE files)

| File | Role |
|------|------|
| `src/app/pages/merchant/merchant-deliveries/` | Delivery History (confirmations) |
| `src/app/pages/merchant/merchant-product-delivery-totals/` | Products Delivered (per-product totals) |
| `src/app/services/merchant.service.ts` | `fetchDeliveries()`, `fetchProductDeliverySummary()` |
| `docs/MERCHANTS_API.md` | Existing deliveries API |
