# Backend Request — Merchant Inventory Summary, Admin Adjustment Reasons & Stock Balance

**Date:** 2026-07-13  
**From:** User FE (`mlm-user.fe`)  
**Status:** Business rule / API gaps — blocked by missing or incomplete backend fields  
**Severity:** High  
**Area:** Merchant dashboard summary, inventory adjustment disputes, admin merchant stock balance

**Related docs:**

- [backend-request-merchant-dashboard-summary.md](./backend-request-merchant-dashboard-summary.md) — existing `GET /merchants/dashboard/summary` contract
- [backend-request-inventory-adjustment-disputes.md](./backend-request-inventory-adjustment-disputes.md) — adjustment dispute workflow + admin endpoints
- [frontend-integration-merchant-stock-dispatch.md](./frontend-integration-merchant-stock-dispatch.md) — allocation dispatch and receipt disputes
- [MERCHANTS_API.md](./MERCHANTS_API.md) — merchant inventory endpoints
- Merchant dashboard: [`merchant-dashboard.component.ts`](../src/app/pages/merchant/merchant-dashboard/merchant-dashboard.component.ts)
- Merchant inventory: [`merchant-inventory.component.ts`](../src/app/pages/merchant/merchant-inventory/merchant-inventory.component.ts)
- Merchant service: [`merchant.service.ts`](../src/app/services/merchant.service.ts)

---

## 1. Summary

A merchant client reported three inventory-related issues:

1. **Merchant dashboard — Inventory Summary** shows **5** instead of **250**. The card displays the count of distinct product SKUs, not the total number of physical units in stock. The client also wants a breakdown by **product catalog category** (e.g. Health, Beverages) showing total pieces per category.
2. **Admin — Inventory adjustment** — When a merchant submits a stock adjustment request with a mandatory reason, the admin review screen does not show the merchant's reason.
3. **Admin — Merchant stock balance** — Admin cannot see how much stock each merchant has been given, how much has been fulfilled/sold, and the remaining balance.

This document requests backend API changes for all three. User FE will update the merchant dashboard UI once §4.1 ships. Admin app changes are out of scope for `mlm-user.fe` but depend on §4.2 and §4.3.

---

## 2. Current behavior (reproduction)

### 2.1 Merchant dashboard — Inventory Summary shows 5 instead of 250

**Client observation (2026-07-13):**

> Merchant INVENTORY SUMMARY ON merchant dashboard is showing 5 instead of 250 (total number of the product of the merchant). It needs to show the class of product and total pieces available under that type of product.

**Steps to reproduce:**

1. Log in as an **ACTIVE** merchant with inventory (e.g. 5 distinct products totalling 250 units).
2. Open **Merchant Dashboard** (`/merchant/dashboard`).
3. Observe the **Inventory Summary** stat card.

**Actual:** Card shows **5** (number of distinct SKUs).

**Expected:** Card shows **250** (total physical units) plus a breakdown by product catalog category.

**Root cause (frontend):**

The dashboard binds the Inventory Summary card to `inventory.totalProducts` from `GET /merchants/dashboard/summary`:

```typescript
// merchant-dashboard.component.ts
totalProducts = computed(() => this.dashboardSummary()?.inventory.totalProducts ?? 0);

// statCardsData → Inventory Summary card
{ label: 'Inventory Summary', value: String(this.totalProducts()), icon: 'pi-box' }
```

`totalProducts` is defined as the count of distinct products in merchant inventory (SKU count), not `SUM(stockQuantity)`. See [backend-request-merchant-dashboard-summary.md](./backend-request-merchant-dashboard-summary.md) §4.3.

**Verify:** Compare:

- `GET /merchants/dashboard/summary` → `inventory.totalProducts` (e.g. 5)
- `GET /merchants/inventory` → sum of each item's `stockQuantity` (e.g. 250)

---

### 2.2 Admin — Merchant adjustment reason not visible

**Client observation (2026-07-13):**

> Under Inventory adjustment on admin — Admin should be allowed to see the merchant reason for adjustments, it is not showing.

**Steps to reproduce:**

1. Merchant opens **Inventory** (`/merchant/inventory`), edits a product quantity that differs from the platform-recognized amount, and submits an adjustment request with a reason (min 10 characters).
2. Admin opens the inventory adjustment review screen.
3. Admin cannot read the merchant's stated reason.

**Root cause:**

User FE already submits `reason` on `POST /merchants/inventory/:productId/adjustment-requests` (see [backend-request-inventory-adjustment-disputes.md](./backend-request-inventory-adjustment-disputes.md) §3.2). The admin list/detail endpoints (`GET /admin/merchants/inventory-adjustment-disputes`) either do not exist yet or do not return `reason` (and related fields) in the response payload.

---

### 2.3 Admin — Merchant stock balance not visible

**Client observation (2026-07-13):**

> Also Merchant stock inventory balance is not showing on admin. Admin should be able to see the stock that each merchant has left, how many has been given out, and the balance stock.

**Steps to reproduce:**

1. Log in as admin.
2. Open merchant management / inventory views.
3. Attempt to view per-merchant stock: total allocated, total fulfilled, current balance.

**Actual:** No consolidated admin endpoint exposes per-merchant stock balance. Admin can see allocations and dispatch status ([frontend-integration-merchant-stock-dispatch.md](./frontend-integration-merchant-stock-dispatch.md)) but not a ledger-derived balance summary per product or per merchant.

**Expected:** Admin sees, per merchant and per product:

- **Given out / allocated** — total units credited to the merchant
- **Fulfilled / used** — units consumed via order fulfilment
- **Balance** — units the merchant currently holds

---

## 3. Required business rules

| Rule | Detail |
|------|--------|
| Inventory Summary total | Dashboard must expose **total physical units** (`SUM(stockQuantity)`), not only SKU count |
| Category grouping | Group inventory by **product catalog category** (`categoryId` / `categoryName` from product master), not merchant tier |
| SKU count retained | Keep `totalProducts` for backward compatibility |
| Adjustment reason | Merchant-submitted `reason` must be returned on admin list and detail endpoints |
| Stock balance | Admin balance view uses ledger-derived totals: allocated, fulfilled, current balance |
| Category source | `categoryId` / `categoryName` come from the product record linked to each `MerchantProduct` |

---

## 4. Backend changes requested

### 4.1 Extend `GET /merchants/dashboard/summary` — inventory section

**Endpoint:** `GET /merchants/dashboard/summary` (existing)  
**Auth:** Bearer + ACTIVE merchant

Add fields to the `inventory` object. Keep existing fields for backward compatibility.

**Updated `inventory` shape:**

```json
{
  "inventory": {
    "totalProducts": 5,
    "totalStockQuantity": 250,
    "lowStockCount": 0,
    "outOfStockCount": 0,
    "lowOrOutCount": 0,
    "byCategory": [
      {
        "categoryId": "health",
        "categoryName": "Health",
        "productCount": 3,
        "totalStockQuantity": 150
      },
      {
        "categoryId": "beverages",
        "categoryName": "Beverages",
        "productCount": 2,
        "totalStockQuantity": 100
      }
    ]
  }
}
```

| Field | Type | Description |
|-------|------|-------------|
| `totalProducts` | number | Count of distinct products (SKUs) — **unchanged** |
| `totalStockQuantity` | number | `SUM(stockQuantity)` across active merchant inventory items |
| `lowStockCount` | number | Unchanged |
| `outOfStockCount` | number | Unchanged |
| `lowOrOutCount` | number | Unchanged |
| `byCategory` | array | Inventory grouped by product catalog category |

**`byCategory[]` item fields:**

| Field | Type | Description |
|-------|------|-------------|
| `categoryId` | string | Product catalog category ID |
| `categoryName` | string | Display name (e.g. "Health") |
| `productCount` | number | Distinct SKUs in this category |
| `totalStockQuantity` | number | `SUM(stockQuantity)` for items in this category |

**Rules:**

- `totalStockQuantity` must equal the sum of `byCategory[].totalStockQuantity`.
- Empty inventory → `totalStockQuantity: 0`, `byCategory: []`.
- Only include active merchant inventory items (`isActive = true` unless business rules say otherwise).
- Products without a category → group under `categoryId: "uncategorized"`, `categoryName: "Uncategorized"`.

---

### 4.2 Admin inventory adjustment disputes — expose merchant reason

**Base:** `/admin/merchants` — admin role + RBAC

Tighten the contract from [backend-request-inventory-adjustment-disputes.md](./backend-request-inventory-adjustment-disputes.md) §3.5. Admin list and detail responses **must** include the merchant-submitted `reason`.

#### `GET /admin/merchants/inventory-adjustment-disputes`

**Query (optional):** `status`, `merchantId`, `productId`, `limit`, `offset`

**Response (200):**

```json
{
  "disputes": [
    {
      "id": "dispute-uuid",
      "merchantId": "merchant-uuid",
      "merchantUsername": "DELE1",
      "productId": "product-uuid",
      "productName": "Herbal Tea",
      "productSku": "SHT-001",
      "authorizedQuantity": 10,
      "requestedQuantity": 12,
      "adjustmentType": "INCREASE",
      "reason": "Physical count found 2 extra units in store after delivery.",
      "status": "OPEN",
      "adminNotes": null,
      "createdAt": "2026-07-13T01:39:00.000Z",
      "resolvedAt": null
    }
  ],
  "total": 1
}
```

**Required fields on every list item:**

| Field | Required | Notes |
|-------|----------|-------|
| `id` | Yes | Dispute UUID |
| `merchantId` | Yes | |
| `merchantUsername` | Yes | For admin table display |
| `productId` | Yes | |
| `productName` | Yes | |
| `productSku` | Yes | |
| `authorizedQuantity` | Yes | Platform-recognized qty at time of request |
| `requestedQuantity` | Yes | Merchant-requested qty |
| `adjustmentType` | Yes | `INCREASE` \| `DECREASE` |
| `reason` | **Yes** | Full merchant reason (10–500 chars) — **currently missing on admin** |
| `status` | Yes | `OPEN` \| `ADMIN_APPROVED` \| `ADMIN_REJECTED` \| `CLOSED` |
| `adminNotes` | No | Set after admin resolves |
| `createdAt` | Yes | |
| `resolvedAt` | No | |

#### `GET /admin/merchants/inventory-adjustment-disputes/:id`

Same fields as list item, plus optional merchant profile snippet:

```json
{
  "id": "dispute-uuid",
  "merchantId": "merchant-uuid",
  "merchantUsername": "DELE1",
  "merchantType": "BRONZE",
  "productId": "product-uuid",
  "productName": "Herbal Tea",
  "productSku": "SHT-001",
  "authorizedQuantity": 10,
  "requestedQuantity": 12,
  "adjustmentType": "INCREASE",
  "reason": "Physical count found 2 extra units in store after delivery.",
  "status": "OPEN",
  "adminNotes": null,
  "createdAt": "2026-07-13T01:39:00.000Z",
  "resolvedAt": null
}
```

Approve/reject endpoints (`POST .../approve`, `POST .../reject`) remain as specified in [backend-request-inventory-adjustment-disputes.md](./backend-request-inventory-adjustment-disputes.md) §3.5.

---

### 4.3 New — Admin merchant stock balance

#### `GET /admin/merchants/:merchantId/stock-balance`

**Auth:** Admin role + RBAC (`merchants.view_details`)

**Purpose:** Consolidated per-merchant stock ledger for admin visibility.

**Response (200):**

```json
{
  "merchantId": "merchant-uuid",
  "merchantUsername": "DELE1",
  "merchantType": "BRONZE",
  "currency": "NGN",
  "totals": {
    "totalAllocated": 300,
    "totalFulfilled": 50,
    "currentBalance": 250,
    "productCount": 5
  },
  "byCategory": [
    {
      "categoryId": "health",
      "categoryName": "Health",
      "totalAllocated": 180,
      "totalFulfilled": 30,
      "currentBalance": 150,
      "productCount": 3
    },
    {
      "categoryId": "beverages",
      "categoryName": "Beverages",
      "totalAllocated": 120,
      "totalFulfilled": 20,
      "currentBalance": 100,
      "productCount": 2
    }
  ],
  "items": [
    {
      "productId": "product-uuid",
      "productName": "Herbal Tea",
      "productSku": "SHT-001",
      "categoryId": "health",
      "categoryName": "Health",
      "totalAllocated": 60,
      "totalFulfilled": 10,
      "currentBalance": 50,
      "authorizedQuantity": 50,
      "stockQuantity": 50,
      "stockStatus": "IN_STOCK"
    }
  ]
}
```

**Field definitions:**

| Field | Meaning |
|-------|---------|
| `totalAllocated` | Total units ever credited to merchant (RECEIVED allocations + approved adjustment increases) |
| `totalFulfilled` | Units consumed via order fulfilment (`ORDER_PICKUP`, `ORDER_MERCHANT_ASSIGN`, and related movement types) |
| `currentBalance` | Units merchant currently holds (`stockQuantity` / ledger-derived balance) |
| `authorizedQuantity` | Platform-recognized qty per existing adjustment-dispute formula |
| `stockQuantity` | Merchant-reported qty (may differ from `authorizedQuantity` when dispute is open) |

**Ledger source:** Stock movement types from [backend-request-inventory-adjustment-disputes.md](./backend-request-inventory-adjustment-disputes.md) §2 and allocation dispatch flow in [frontend-integration-merchant-stock-dispatch.md](./frontend-integration-merchant-stock-dispatch.md).

**Rules:**

- `totals.currentBalance` = `SUM(items[].currentBalance)`.
- `totals.totalAllocated` = `SUM(items[].totalAllocated)`.
- `totals.totalFulfilled` = `SUM(items[].totalFulfilled)`.
- `byCategory` aggregates `items` by product catalog category.
- Invariant: `currentBalance` = `totalAllocated - totalFulfilled ± approved adjustments` (document exact formula in OpenAPI).

**Errors:**

| Case | Status |
|------|--------|
| Merchant not found | `404` |
| Unauthorized | `401` / `403` |

#### Optional — `GET /admin/merchants/stock-balance` (list)

For admin table of all merchants with summary totals only.

**Query:** `status` (e.g. `ACTIVE`), `merchantType`, `limit`, `offset`

**Response (200):**

```json
{
  "merchants": [
    {
      "merchantId": "merchant-uuid",
      "merchantUsername": "DELE1",
      "merchantType": "BRONZE",
      "totals": {
        "totalAllocated": 300,
        "totalFulfilled": 50,
        "currentBalance": 250,
        "productCount": 5
      }
    }
  ],
  "total": 1
}
```

---

## 5. Frontend status

| Item | Status |
|------|--------|
| Merchant dashboard Inventory Summary shows SKU count (`totalProducts`) only | Current behaviour — incorrect per client expectation |
| Merchant submits adjustment `reason` on quantity change | **Done** — [`merchant-inventory.component.ts`](../src/app/pages/merchant/merchant-inventory/merchant-inventory.component.ts) |
| Merchant inventory shows `authorizedQuantity` vs `stockQuantity` | **Done** — pending backend field consistency |
| Admin sees adjustment `reason` | **Blocked** — backend must return `reason` on admin dispute endpoints |
| Admin merchant stock balance view | **Blocked** — new `GET /admin/merchants/:merchantId/stock-balance` needed |
| Dashboard shows `totalStockQuantity` + `byCategory` breakdown | **Pending** — after §4.1 ships |

### Pending User FE changes (after §4.1 backend deploy)

No code changes until backend ships. Planned updates:

1. **`merchant.service.ts`** — extend `MerchantDashboardSummary.inventory`:

   ```typescript
   inventory: {
     totalProducts: number;
     totalStockQuantity: number;       // NEW
     lowStockCount: number;
     outOfStockCount: number;
     lowOrOutCount: number;
     byCategory: {                     // NEW
       categoryId: string;
       categoryName: string;
       productCount: number;
       totalStockQuantity: number;
     }[];
   }
   ```

2. **`merchant-dashboard.component.ts`** — Inventory Summary stat card:
   - Primary value: `totalStockQuantity` (e.g. **250**)
   - Sub-rows or expandable section: each `byCategory` entry with category name + piece count

3. **`mapDashboardSummary()`** in `merchant.service.ts` — map new fields with snake_case fallbacks (`total_stock_quantity`, `by_category`).

Admin app changes are owned by the admin FE team; this doc provides the API contract only.

---

## 6. Acceptance criteria

### Merchant dashboard (§4.1)

- [ ] `GET /merchants/dashboard/summary` returns `inventory.totalStockQuantity` equal to `SUM(stockQuantity)` from `GET /merchants/inventory`.
- [ ] `inventory.byCategory[]` groups items by product catalog category with correct `totalStockQuantity` per category.
- [ ] `inventory.totalProducts` still returns distinct SKU count (backward compatible).
- [ ] Empty inventory returns `totalStockQuantity: 0` and `byCategory: []`.

### Admin adjustment reasons (§4.2)

- [ ] `GET /admin/merchants/inventory-adjustment-disputes` returns `reason` on every dispute in the list.
- [ ] `GET /admin/merchants/inventory-adjustment-disputes/:id` returns full `reason` text.
- [ ] List response includes `merchantUsername`, `authorizedQuantity`, `requestedQuantity`, `adjustmentType`.
- [ ] Admin can review disputes without calling merchant-side endpoints.

### Admin stock balance (§4.3)

- [ ] `GET /admin/merchants/:merchantId/stock-balance` returns `totals` and per-product `items[]`.
- [ ] Each item shows `totalAllocated`, `totalFulfilled`, `currentBalance`.
- [ ] `byCategory[]` aggregates balance data by product catalog category.
- [ ] `totals.currentBalance` matches sum of item balances for the merchant.
- [ ] Returns `404` for unknown merchant ID.

---

## 7. Test plan (backend)

### Dashboard inventory summary

1. Merchant with 5 products totalling 250 units → `totalProducts: 5`, `totalStockQuantity: 250`.
2. Products in 2 categories → `byCategory` has 2 entries with correct sums.
3. Merchant with empty inventory → `totalStockQuantity: 0`, `byCategory: []`.
4. Regression: existing `lowOrOutCount` still correct.

### Admin adjustment reasons

1. Merchant submits adjustment with reason → admin list returns same `reason` text.
2. Admin detail endpoint returns full reason (not truncated below 500 chars).
3. List includes `merchantUsername` and quantity fields for table display.
4. Approve/reject still works; `reason` preserved on resolved disputes.

### Admin stock balance

1. Merchant with 60 units allocated, 10 fulfilled → `currentBalance: 50` for that product.
2. Merchant with multiple products → `totals` sums match item rows.
3. `byCategory` totals match filtered items.
4. Unknown `merchantId` → `404`.
5. Optional list endpoint returns summary for all ACTIVE merchants.

---

## 8. Out of scope

- Partial checkout / declined-order behaviour (separate cart work)
- Admin FE implementation (admin app is a separate codebase)
- Changing merchant tier / `category-config` logic
- Merging allocation receipt disputes with inventory adjustment disputes

---

## 9. Changelog

| Date | Change |
|------|--------|
| 2026-07-13 | Initial request from User FE — merchant dashboard inventory summary, admin adjustment reasons, admin stock balance |
