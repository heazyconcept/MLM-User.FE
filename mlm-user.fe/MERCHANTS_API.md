# Merchants API (Merchant-facing)

This document describes the **merchant** endpoints under `/merchants`: application, profile, orders, fulfillment, deliveries, earnings, allocations, and inventory. These are used by the merchant dashboard (logged-in user with merchant role).

**Auth:** Unless marked *Public*, send `Authorization: Bearer <userAccessToken>`.

**Merchant-only endpoints** use `MerchantGuard`: the user must have role `MERCHANT` and the merchant record must exist and have status `ACTIVE`. If the user is not a merchant or the merchant is `PENDING`/`SUSPENDED`, the API returns 403.

---

## Summary

| Endpoint | Method | Auth | Purpose |
|----------|--------|------|---------|
| `/merchants/apply` | POST | User (registration paid) | Apply to become a merchant |
| `/merchants/category-config` | GET | Public | Get merchant tiers/fees for application |
| `/merchants/available` | GET | Public | List available (ACTIVE) merchants for discovery |
| `/merchants/me` | GET | User | Get my merchant profile |
| `/merchants/orders` | GET | Merchant | List my assigned orders |
| `/merchants/orders/:id` | GET | Merchant | Get order details |
| `/merchants/orders/:id/mark-ready-for-pickup` | POST | Merchant | Mark PICKUP order ready |
| `/merchants/orders/:id/mark-delivery-requested` | POST | Merchant | Mark OFFLINE_DELIVERY requested |
| `/merchants/orders/:id/mark-sent` | POST | Merchant | Mark order as sent |
| `/merchants/orders/:id/confirm-delivery` | POST | Merchant | Confirm delivery (with optional proof/notes) |
| `/merchants/deliveries` | GET | Merchant | List my delivery confirmations |
| `/merchants/earnings/summary` | GET | Merchant | Merchant vs network earnings summary |
| `/merchants/me/allocations` | GET | Merchant | List my allocations |
| `/merchants/me/allocations/:id/accept` | POST | Merchant | Accept a pending allocation |
| `/merchants/inventory` | GET | Merchant | Get my inventory (products + stock) |
| `/merchants/inventory/:productId/stock` | PUT | Merchant | Update stock for a product |

---

## Application & discovery

### POST /merchants/apply

**Purpose:** Apply to become a merchant. Creates a merchant record with status `PENDING` and sets the user’s role to `MERCHANT`. Admin later approves via `POST /admin/merchants/:id/approve`.

**Auth:** Logged-in user; **registration must be paid** (`RegistrationPaidGuard`). If the user already has a merchant, the same application is returned (idempotent).

**Request**

- **Method:** `POST`
- **Path:** `/merchants/apply`
- **Headers:** `Authorization: Bearer <token>`, `Content-Type: application/json`
- **Body:**

```json
{
  "type": "REGIONAL",
  "serviceAreas": ["Lagos", "Abuja"]
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `type` | string | Yes | `REGIONAL` \| `NATIONAL` \| `GLOBAL` (MerchantType enum) |
| `serviceAreas` | string[] | Yes | At least one area (e.g. cities/regions) |

**Response (201)**

```json
{
  "id": "merchant-uuid",
  "userId": "user-uuid",
  "type": "REGIONAL",
  "status": "PENDING",
  "serviceAreas": ["Lagos", "Abuja"],
  "createdAt": "2026-03-04T10:00:00.000Z"
}
```

**Errors:** 400 if user not registered (registration not paid). 404 if user not found.

**Frontend:** Show application form with type and service areas; after submit, show “Pending approval” and optionally `GET /merchants/me` to reflect status.

---

### GET /merchants/category-config

**Purpose:** Get merchant category config (tiers, commissions, registration fees, onboarding product) for the application flow. **Public** — no auth.

**Request**

- **Method:** `GET`
- **Path:** `/merchants/category-config`
- **Body:** none

**Response (200)**

```json
{
  "configs": [
    {
      "merchantType": "REGIONAL",
      "deliveryCommissionPct": 5,
      "productCommissionPct": 10,
      "registrationFeeUsd": 100,
      "onboardingProductId": "product-uuid-or-null",
      "onboardingQuantity": 10
    }
  ]
}
```

**Frontend:** Use to display fees and tiers before the user applies.

---

### GET /merchants/available

**Purpose:** List **ACTIVE** merchants for discovery (e.g. pickup selection). **Public** — no auth. Optional location filter.

**Request**

- **Method:** `GET`
- **Path:** `/merchants/available`
- **Query:**

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `location` | string | No | Filter by service area (e.g. "Lagos"); merchants with that area or "*" are returned |

**Response (200)**

```json
{
  "merchants": [
    {
      "id": "merchant-uuid",
      "name": "merchant@example.com",
      "serviceAreas": ["Lagos", "Abuja"],
      "products": [
        { "id": "product-uuid", "name": "Segulah Herbal Tea", "sku": "SHT" }
      ],
      "pickupAvailable": true
    }
  ]
}
```

**Frontend:** Use for “Choose pickup location” or similar; optionally pass user’s location as `location`.

---

### GET /merchants/me

**Purpose:** Get the current user’s merchant profile. If the user has no merchant, returns a message object instead of profile.

**Auth:** Logged-in user (any role).

**Request**

- **Method:** `GET`
- **Path:** `/merchants/me`
- **Body:** none

**Response (200) — has merchant**

```json
{
  "id": "merchant-uuid",
  "userId": "user-uuid",
  "type": "REGIONAL",
  "status": "PENDING",
  "serviceAreas": ["Lagos", "Abuja"],
  "createdAt": "2026-03-04T10:00:00.000Z"
}
```

**Response (200) — no merchant**

```json
{
  "message": "No merchant profile found"
}
```

**Frontend:** If `message` is present, show “Apply to become a merchant”; otherwise show dashboard and use `status` (PENDING / ACTIVE / SUSPENDED) for UI state.

---

## Orders (merchant-only)

All order endpoints require **MerchantGuard**: user must be a merchant with status `ACTIVE`. Orders returned are only those assigned to this merchant (`assignedMerchantId = merchant.id`).

---

### GET /merchants/orders

**Purpose:** List orders assigned to the merchant with optional filters and pagination.

**Request**

- **Method:** `GET`
- **Path:** `/merchants/orders`
- **Headers:** `Authorization: Bearer <token>`
- **Query (all optional):**

| Param | Type | Description |
|-------|------|-------------|
| `status` | OrderStatus | Filter by order status (e.g. `ASSIGNED_TO_MERCHANT`, `READY_FOR_PICKUP`, `DELIVERED`) |
| `fromDate` | ISO date string | Orders created on or after this date |
| `toDate` | ISO date string | Orders created on or before this date |
| `limit` | number | Page size (default 20) |
| `offset` | number | Offset (default 0) |

**Response (200)**

```json
{
  "orders": [
    {
      "id": "order-uuid",
      "userId": "user-uuid",
      "status": "ASSIGNED_TO_MERCHANT",
      "totalAmount": 99.99,
      "baseAmount": 89.99,
      "currency": "USD",
      "paymentMethod": "REGISTRATION_WALLET",
      "fulfilmentMode": "PICKUP",
      "selectedMerchantId": "merchant-uuid",
      "deliveryAddress": null,
      "items": [
        {
          "id": "order-item-uuid",
          "productId": "product-uuid",
          "productName": "Segulah Herbal Tea",
          "quantity": 2,
          "unitPrice": 29.99,
          "pv": 10,
          "cpv": 5
        }
      ],
      "user": { "id": "user-uuid", "email": "customer@example.com" },
      "deliveryConfirmation": null,
      "createdAt": "2026-03-04T10:00:00.000Z",
      "updatedAt": "2026-03-04T10:00:00.000Z"
    }
  ],
  "total": 1,
  "limit": 20,
  "offset": 0
}
```

**Order statuses (relevant to merchants):** `ASSIGNED_TO_MERCHANT`, `READY_FOR_PICKUP`, `OFFLINE_DELIVERY_REQUESTED`, `DELIVERED`, etc. **FulfilmentMode:** `PICKUP` or `OFFLINE_DELIVERY`.

**Frontend:** Orders list with filters; link each order to detail page.

---

### GET /merchants/orders/:id

**Purpose:** Get a single order’s details. Order must be assigned to this merchant.

**Request**

- **Method:** `GET`
- **Path:** `/merchants/orders/{id}` — `id` = order UUID
- **Body:** none

**Response (200)**  
Same order object shape as in the list above (single object, not wrapped in `orders` array).

**Errors:** 404 order not found; 403 if order is not assigned to this merchant.

---

### POST /merchants/orders/:id/mark-ready-for-pickup

**Purpose:** Mark a **PICKUP** order as ready for pickup. Order must be in `ASSIGNED_TO_MERCHANT`. Transitions status to `READY_FOR_PICKUP`.

**Request**

- **Method:** `POST`
- **Path:** `/merchants/orders/{id}/mark-ready-for-pickup`
- **Body:** none

**Response (200)**

```json
{
  "message": "Order marked as ready for pickup successfully"
}
```

**Errors:** 404 merchant/order not found; 403 order not assigned to merchant; 400 if order status is not `ASSIGNED_TO_MERCHANT` or fulfilment mode is not `PICKUP`.

**Frontend:** Show “Mark ready for pickup” only for PICKUP orders in `ASSIGNED_TO_MERCHANT`.

---

### POST /merchants/orders/:id/mark-delivery-requested

**Purpose:** Mark an **OFFLINE_DELIVERY** order as “delivery requested”. Order must be in `ASSIGNED_TO_MERCHANT`. Transitions status to `OFFLINE_DELIVERY_REQUESTED`.

**Request**

- **Method:** `POST`
- **Path:** `/merchants/orders/{id}/mark-delivery-requested`
- **Body:** none

**Response (200)**

```json
{
  "message": "Order marked as offline delivery requested successfully"
}
```

**Errors:** 404/403 as above; 400 if status not `ASSIGNED_TO_MERCHANT` or fulfilment mode not `OFFLINE_DELIVERY`.

**Frontend:** Show “Mark delivery requested” only for OFFLINE_DELIVERY orders in `ASSIGNED_TO_MERCHANT`.

---

### POST /merchants/orders/:id/mark-sent

**Purpose:** Mark the order as “sent” (dispatched). Used by merchant to indicate shipment. Does not change order status to DELIVERED; use confirm-delivery for that.

**Request**

- **Method:** `POST`
- **Path:** `/merchants/orders/{id}/mark-sent`
- **Body:** none

**Response (200)**

```json
{
  "message": "Order marked as sent"
}
```

**Errors:** 404 order not found; 403 if not assigned to this merchant.

**Frontend:** “Mark as sent” button; then later “Confirm delivery” when customer receives.

---

### POST /merchants/orders/:id/confirm-delivery

**Purpose:** Confirm that the order has been delivered. Creates a delivery confirmation record, sets order status to `DELIVERED`, and triggers merchant delivery bonus. Optional proof URL and notes.

**Request**

- **Method:** `POST`
- **Path:** `/merchants/orders/{id}/confirm-delivery`
- **Headers:** `Content-Type: application/json`
- **Body (all optional):**

```json
{
  "proof": "https://example.com/proof.jpg",
  "notes": "Delivered to customer at 3pm"
}
```

Order must be in one of: `READY_FOR_PICKUP`, `OFFLINE_DELIVERY_REQUESTED`, or `PAID` (backward compatibility). If delivery was already confirmed, the call is idempotent (no error).

**Response (200)**

```json
{
  "message": "Delivery confirmed successfully"
}
```

**Errors:** 404/403 as above; 400 if order status not allowed for confirmation.

**Frontend:** “Confirm delivery” with optional proof link and notes; then refresh order to see `deliveryConfirmation` and status `DELIVERED`.

---

## Deliveries

### GET /merchants/deliveries

**Purpose:** List delivery confirmations for this merchant (orders they confirmed as delivered). **Merchant-only.**

**Request**

- **Method:** `GET`
- **Path:** `/merchants/deliveries`
- **Query (optional):** `limit`, `offset` (query params; type number)

**Response (200)**

```json
{
  "confirmations": [
    {
      "id": "confirmation-uuid",
      "orderId": "order-uuid",
      "confirmedBy": "MERCHANT",
      "proof": "https://...",
      "notes": "Delivered",
      "createdAt": "2026-03-04T12:00:00.000Z",
      "order": { ... }
    }
  ],
  "total": 1
}
```

**Frontend:** “Delivery history” or similar list.

---

## Earnings

### GET /merchants/earnings/summary

**Purpose:** Get earnings summary split into **merchant earnings** (from selling/fulfilling as merchant) and **network earnings** (other earning types for the same user). **Merchant-only.**

**Request**

- **Method:** `GET`
- **Path:** `/merchants/earnings/summary`
- **Body:** none

**Response (200)**

```json
{
  "merchantEarnings": {
    "totalEarnings": 500,
    "availableEarnings": 300,
    "pendingEarnings": 200,
    "byType": {
      "personalProduct": 100,
      "directReferralProduct": 150,
      "communityProduct": 50,
      "deliveryBonus": 200
    }
  },
  "networkEarnings": {
    "totalEarnings": 1000,
    "availableEarnings": 800,
    "pendingEarnings": 200,
    "byType": {
      "PERSONAL_PV": 400,
      "TEAM_PV": 600
    }
  },
  "currency": "USD"
}
```

**Frontend:** Two cards/sections: “Merchant earnings” (personal/direct/community product + delivery bonus) and “Network earnings” (other types). Use `currency` for display.

---

## Allocations

**Purpose:** Allocations are pending stock assigned to the merchant (e.g. onboarding). Merchant can list and accept them; accepting moves stock from admin pool into merchant inventory.

---

### GET /merchants/me/allocations

**Purpose:** List allocations for this merchant (pending onboarding or other allocations). **Merchant-only.**

**Request**

- **Method:** `GET`
- **Path:** `/merchants/me/allocations`
- **Body:** none

**Response (200)**  
Array of allocation objects (from repository: `MerchantAllocation` with `product` included). Typical shape:

```json
[
  {
    "id": "allocation-uuid",
    "merchantId": "merchant-uuid",
    "productId": "product-uuid",
    "quantity": 10,
    "status": "PENDING",
    "createdAt": "2026-03-04T10:00:00.000Z",
    "product": {
      "id": "product-uuid",
      "name": "Onboarding Kit",
      "sku": "OBK"
    }
  }
]
```

**Frontend:** “Pending allocations” list with “Accept” per allocation.

---

### POST /merchants/me/allocations/:id/accept

**Purpose:** Accept a **PENDING** allocation. Decrements admin product pool, upserts merchant product (adds or increments stock), and sets allocation status to `ACCEPTED`. **Merchant-only.**

**Request**

- **Method:** `POST`
- **Path:** `/merchants/me/allocations/{id}/accept` — `id` = allocation UUID
- **Body:** none

**Response (200)**

```json
{
  "message": "Allocation accepted successfully"
}
```

**Errors:** 404 allocation not found; 400 if allocation not for this merchant or already not PENDING.

**Frontend:** After accept, refresh allocations list and inventory.

---

## Inventory

### GET /merchants/inventory

**Purpose:** Get the merchant’s inventory: products assigned to them with stock quantity and status. **Merchant-only.**

**Request**

- **Method:** `GET`
- **Path:** `/merchants/inventory`
- **Body:** none

**Response (200)**

```json
{
  "items": [
    {
      "merchantProductId": "mp-uuid",
      "productId": "product-uuid",
      "productName": "Segulah Herbal Tea",
      "productSku": "SHT",
      "stockQuantity": 50,
      "stockStatus": "IN_STOCK",
      "isActive": true
    }
  ]
}
```

**StockStatus:** `IN_STOCK` \| `LOW_STOCK` \| `OUT_OF_STOCK` (optional; can be null).

**Frontend:** Inventory table; use `stockQuantity` and `stockStatus` for alerts; link to update stock.

---

### PUT /merchants/inventory/:productId/stock

**Purpose:** Update stock quantity and/or stock status for a product in the merchant’s inventory. **Merchant-only.** Product must already be assigned to the merchant.

**Request**

- **Method:** `PUT`
- **Path:** `/merchants/inventory/{productId}/stock` — `productId` = product UUID
- **Headers:** `Content-Type: application/json`
- **Body (both optional; send at least one):**

```json
{
  "stockQuantity": 50,
  "stockStatus": "IN_STOCK"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `stockQuantity` | number | No | Integer ≥ 0 |
| `stockStatus` | string | No | `IN_STOCK` \| `LOW_STOCK` \| `OUT_OF_STOCK` |

**Response (200)**  
Returns the result of the repository update (e.g. updated merchant product).

**Errors:** 404 if product not in merchant’s inventory or not assigned.

**Frontend:** Edit stock form for a product; submit quantity and/or status; refresh inventory list.

---

## Guidelines for frontend

1. **Auth and role**
   - Use the same user JWT for all authenticated merchant endpoints.
   - If the user has no merchant or status is not ACTIVE, merchant-only routes return 403; show “Apply to become a merchant” or “Account pending/suspended” as appropriate.

2. **Application flow**
   - `GET /merchants/category-config` (public) → show fees/tiers.
   - `POST /merchants/apply` with `type` + `serviceAreas` (user must be registered/paid).
   - `GET /merchants/me` to show status (PENDING / ACTIVE / SUSPENDED); only show full dashboard when ACTIVE.

3. **Orders**
   - List with `GET /merchants/orders` (optional `status`, `fromDate`, `toDate`, `limit`, `offset`).
   - Detail with `GET /merchants/orders/:id`.
   - Fulfillment actions depend on `fulfilmentMode` and `status`:
     - PICKUP + `ASSIGNED_TO_MERCHANT` → “Mark ready for pickup”.
     - OFFLINE_DELIVERY + `ASSIGNED_TO_MERCHANT` → “Mark delivery requested”.
     - Then “Mark sent” (optional) and “Confirm delivery” (with optional proof/notes).

4. **Earnings and deliveries**
   - Use `GET /merchants/earnings/summary` for merchant vs network breakdown and `GET /merchants/deliveries` for delivery history.

5. **Allocations and inventory**
   - Show pending allocations with `GET /merchants/me/allocations`; accept with `POST /merchants/me/allocations/:id/accept`.
   - Show inventory with `GET /merchants/inventory`; update stock with `PUT /merchants/inventory/:productId/stock`.

6. **Public discovery**
   - Use `GET /merchants/available` (optional `location`) for pickup/discovery; no auth.
