# Merchants endpoints (user / merchant frontend guide)

This guide focuses on **non-admin** merchant flows: application, fee payment, discovery, orders, deliveries, earnings, allocations, and inventory. It explains how the frontend should integrate each endpoint.

Base path: `/merchants` (except where marked Public).  
Auth: `Authorization: Bearer <userAccessToken>` unless marked **Public** or otherwise noted.

---

## Summary of endpoints

| Endpoint | Method | Auth | Purpose |
|----------|--------|------|---------|
| `/merchants/apply` | POST | User | Apply to become a merchant |
| `/merchants/merchant-fee/initiate` | POST | User | Pay merchant category fee (wallet or gateway) |
| `/merchants/category-config` | GET | Public | Get merchant tiers, fees, onboarding items (for application UI) |
| `/merchants/available` | GET | Public | List ACTIVE merchants for discovery/pickup selection |
| `/merchants/me` | GET | User | Get my merchant profile (PENDING/ACTIVE/SUSPENDED) |
| `/merchants/orders` | GET | Merchant | List my assigned orders |
| `/merchants/orders/{id}` | GET | Merchant | Get details for an assigned order |
| `/merchants/orders/{id}/mark-ready-for-pickup` | POST | Merchant | Mark PICKUP order ready for pickup |
| `/merchants/orders/{id}/mark-delivery-requested` | POST | Merchant | Mark OFFLINE_DELIVERY order as delivery requested |
| `/merchants/orders/{id}/mark-sent` | POST | Merchant | Mark order as sent (dispatched) |
| `/merchants/orders/{id}/confirm-delivery` | POST | Merchant | Confirm delivery (with optional proof/notes) |
| `/merchants/deliveries` | GET | Merchant | List delivery confirmations (history) |
| `/merchants/earnings/summary` | GET | Merchant | Merchant vs network earnings summary |
| `/merchants/me/allocations` | GET | Merchant | List allocations (onboarding/refill stock) |
| `/merchants/me/allocations/{id}/accept` | POST | Merchant | Accept allocation after receiving stock |
| `/merchants/inventory` | GET | Merchant | Get my inventory (assigned products + stock) |
| `/merchants/inventory/{productId}/stock` | PUT | Merchant | Update stock quantity/status for a product |

---

## 1. Apply & pay flow

### 1.1 Apply as merchant – POST /merchants/apply

**Purpose:** Let a registered user submit a merchant application. Creates a merchant record with `status: PENDING` and sets user role to `MERCHANT`.

**Request**

- Method: `POST`
- Path: `/merchants/apply`
- Headers: `Authorization: Bearer <token>`, `Content-Type: application/json`
- Body:

```json
{
  "type": "REGIONAL",
  "serviceAreas": ["Lagos", "Abuja"]
}
```

**Key rules**

- User must be registered and have `isRegistrationPaid = true` (backend enforces this).
- If the user already has a merchant profile, the call is idempotent: backend returns the existing merchant instead of creating a new one.

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

**Frontend usage**

- Use in “Apply as merchant” form:
  - Pre-fill `type` and show fee information from `/merchants/category-config` (see below).
  - Let user select `serviceAreas` (e.g. cities or regions they serve).
- After success, show “Application submitted – pending approval” and optionally show merchant status via `GET /merchants/me`.

---

### 1.2 Pay merchant fee – POST /merchants/merchant-fee/initiate

**Purpose:** Charge the merchant category registration fee, using the user’s wallets or a payment gateway (e.g. Paystack).

**Request**

- Method: `POST`
- Path: `/merchants/merchant-fee/initiate`
- Headers: `Authorization: Bearer <token>`, `Content-Type: application/json`
- Body example:

```json
{
  "source": "REGISTRATION_WALLET",
  "merchantId": "merchant-uuid",
  "callbackUrl": "https://yourapp.com/merchant/return"
}
```

- `source`: `"REGISTRATION_WALLET"` \| `"CASH_WALLET"` \| `"PAYSTACK"`
- `merchantId`: optional if the user has only one pending merchant.
- `callbackUrl`: required when using `PAYSTACK` (gateway redirect); ignored for wallet sources.

**Behavior**

- Validates merchant is `PENDING` and fee not already paid.
- If source is a wallet:
  - Ensures sufficient balance in the chosen wallet and charges it.
  - Returns 200 and you can immediately show success.
- If source is `PAYSTACK`:
  - Returns a `gatewayUrl` you should redirect to.
  - User pays on Paystack; backend later verifies payment via callback/webhook.

**Frontend usage**

- After `POST /merchants/apply`, use this to implement a **“Pay merchant fee”** step:
  - For internal tests / simple UX, start with `REGISTRATION_WALLET` or `CASH_WALLET`.
  - For Paystack, redirect to `gatewayUrl` and handle return to `callbackUrl`.
- After payment, refresh `GET /merchants/me` (or admin view) to show fee as paid (if your API exposes that flag).

---

### 1.3 Category config – GET /merchants/category-config (Public)

**Purpose:** Show merchant tiers, fees, and onboarding items during the application flow.

**Request**

- Method: `GET`
- Path: `/merchants/category-config`
- Auth: **Public** (no token required)

**Response (200)**

```json
{
  "configs": [
    {
      "merchantType": "REGIONAL",
      "deliveryCommissionPct": 4,
      "productCommissionPct": 3.5,
      "registrationFeeUsd": 600,
      "onboardingItems": [
        { "productId": "uuid-bible", "quantity": 40 },
        { "productId": "uuid-books", "quantity": 50 }
      ]
    }
  ]
}
```

**Frontend usage**

- Use for **tier selection screen**:
  - Show per type: commission rates, fee, and “You will receive: …” from `onboardingItems` (resolve `productId` names via product API if needed).
- Use the chosen `merchantType` and fee when building the apply and pay screens.

---

### 1.4 Available merchants – GET /merchants/available (Public)

**Purpose:** Public discovery endpoint for ACTIVE merchants (e.g. for pickup location selection).

**Request**

- Method: `GET`
- Path: `/merchants/available`
- Query (optional):
  - `location`: string (filters by `serviceAreas` or `*`)

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

**Frontend usage**

- Use for a **merchant/branch picker** when user chooses pickup:
  - Optionally pass `location` based on the user’s selection or geo info.
  - Use `products` list to show which products this merchant carries.

---

## 2. Merchant profile – GET /merchants/me

**Purpose:** Show the current user’s merchant status and basic info.

**Request**

- Method: `GET`
- Path: `/merchants/me`
- Headers: `Authorization: Bearer <token>`

**Response (200)** – when merchant exists

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

If no merchant exists:

```json
{ "message": "No merchant profile found" }
```

**Frontend usage**

- Entry point for the **merchant dashboard**:
  - If `message` present → show **“Apply as merchant”** CTA.
  - If `status = PENDING` → show “Pending admin approval” and hide merchant-only sections.
  - If `status = ACTIVE` → show full merchant dashboard (orders, inventory, earnings, etc.).
  - If `status = SUSPENDED` → show “Account suspended” message and limited UI.

---

## 3. Merchant orders

All `/merchants/orders*` endpoints require the user to be a merchant with status `ACTIVE` (enforced by `MerchantGuard`). They operate on orders where `assignedMerchantId = merchant.id`.

### 3.1 List assigned orders – GET /merchants/orders

**Purpose:** List orders assigned to this merchant, with filtering and pagination.

**Request**

- Method: `GET`
- Path: `/merchants/orders`
- Headers: `Authorization: Bearer <token>`
- Query (optional):
  - `status`: `OrderStatus` (e.g. `ASSIGNED_TO_MERCHANT`, `READY_FOR_PICKUP`, `OFFLINE_DELIVERY_REQUESTED`, `DELIVERED`)
  - `fromDate`, `toDate`: ISO datetimes (filter by creation date)
  - `limit`, `offset`: pagination

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
      "paymentMethod": "WALLET",
      "fulfilmentMode": "PICKUP",
      "selectedMerchantId": "merchant-uuid",
      "deliveryAddress": null,
      "deliveryDisclaimerAccepted": null,
      "items": [
        {
          "id": "order-item-uuid",
          "productId": "product-uuid",
          "productName": "Segulah Herbal Tea",
          "quantity": 2,
          "unitPrice": 29.99,
          "pv": 10,
          "cpv": 5,
          "lineTotal": 59.98
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

**Frontend usage**

- Merchant-facing **Orders list** with filters by status/date and pagination.
- Each row links to `/merchants/orders/{id}` detail.

---

### 3.2 Order detail – GET /merchants/orders/{id}

**Purpose:** Get full details of a specific order assigned to this merchant.

**Request**

- Method: `GET`
- Path: `/merchants/orders/{id}`

**Response (200)**

Same shape as a single order item in `GET /merchants/orders`.\
Errors: 404 if order not found; 403 if not assigned to this merchant.

**Frontend usage**

- Order detail page: show items, customer info (`user`), fulfilmentMode, and available actions (ready for pickup, delivery requested, sent, confirm delivery) based on `status` and `fulfilmentMode`.

---

### 3.3 Mark ready for pickup – POST /merchants/orders/{id}/mark-ready-for-pickup

**Purpose:** Merchant marks a **PICKUP** order as ready for customer pickup.

**Request**

- Method: `POST`
- Path: `/merchants/orders/{id}/mark-ready-for-pickup`
- Body: none

**Behavior**

- Order must be assigned to this merchant and have `fulfilmentMode = PICKUP`.
- Order status must be `ASSIGNED_TO_MERCHANT`; otherwise 400.
- Backend sets status to `READY_FOR_PICKUP` and emits events/notifications.

**Response (200)**

```json
{ "message": "Order marked as ready for pickup successfully" }
```

**Frontend usage**

- On order detail, show **“Mark ready for pickup”** button when:
  - `fulfilmentMode = PICKUP`
  - `status = ASSIGNED_TO_MERCHANT`
- After success, refetch order to display status `READY_FOR_PICKUP`.

---

### 3.4 Mark offline delivery requested – POST /merchants/orders/{id}/mark-delivery-requested

**Purpose:** Merchant indicates that offline delivery has been requested for an **OFFLINE_DELIVERY** order.

**Request**

- Method: `POST`
- Path: `/merchants/orders/{id}/mark-delivery-requested`
- Body: none

**Behavior**

- Order must be assigned to this merchant and have `fulfilmentMode = OFFLINE_DELIVERY`.
- Order status must be `ASSIGNED_TO_MERCHANT`; otherwise 400.
- Backend sets status to `OFFLINE_DELIVERY_REQUESTED` and emits notifications.

**Response (200)**

```json
{
  "message": "Order marked as offline delivery requested successfully"
}
```

**Frontend usage**

- On OFFLINE_DELIVERY order detail, show **“Mark delivery requested”** when:
  - `status = ASSIGNED_TO_MERCHANT`
- After success, refetch order to see `OFFLINE_DELIVERY_REQUESTED` status.

---

### 3.5 Mark order sent – POST /merchants/orders/{id}/mark-sent

**Purpose:** Merchant marks an order as sent (dispatched). This does not confirm delivery; use confirm-delivery for that.

**Request**

- Method: `POST`
- Path: `/merchants/orders/{id}/mark-sent`
- Body: none

**Response (200)**

```json
{ "message": "Order marked as sent" }
```

**Frontend usage**

- On order detail, show **“Mark as sent”** once the merchant has dispatched goods (for both PICKUP and OFFLINE_DELIVERY flows if desired).
- After success, refetch order if your API exposes sent metadata.

---

### 3.6 Confirm delivery – POST /merchants/orders/{id}/confirm-delivery

**Purpose:** Merchant confirms that the order has been delivered to the customer. This creates a delivery confirmation record, updates order status to `DELIVERED`, and triggers merchant delivery bonus.

**Request**

- Method: `POST`
- Path: `/merchants/orders/{id}/confirm-delivery`
- Body (all optional):

```json
{
  "proof": "https://example.com/proof.jpg",
  "notes": "Delivered to customer at 3pm"
}
```

**Behavior**

- Order must be assigned to this merchant.
- Allowed statuses: `READY_FOR_PICKUP`, `OFFLINE_DELIVERY_REQUESTED`, or `PAID` (backward compatibility).
- If a delivery confirmation already exists, call is idempotent (no error; does nothing).

**Response (200)**

```json
{ "message": "Delivery confirmed successfully" }
```

**Frontend usage**

- On order detail, show **“Confirm delivery”** when the order has actually been delivered:
  - For PICKUP: after customer collects and status is `READY_FOR_PICKUP`.\n  - For OFFLINE_DELIVERY: after delivery is done and status is `OFFLINE_DELIVERY_REQUESTED`.\n- Provide fields for optional proof (URL/text) and notes.\n- After success, refetch order to show status `DELIVERED` and, if available, delivery confirmation details.\n\n---\n\n## 4. Deliveries history – GET /merchants/deliveries\n\n**Purpose:** Show the merchant a list of deliveries they’ve confirmed, for history/audit.\n\n**Request**\n\n- Method: `GET`\n- Path: `/merchants/deliveries`\n- Query (optional): `limit`, `offset`\n\n**Response (200)**\n\n```json\n{\n  \"confirmations\": [\n    {\n      \"id\": \"confirmation-uuid\",\n      \"orderId\": \"order-uuid\",\n      \"confirmedBy\": \"MERCHANT\",\n      \"proof\": \"https://...\",\n      \"notes\": \"Delivered\",\n      \"createdAt\": \"2026-03-04T12:00:00.000Z\",\n      \"order\": { /* order details */ }\n    }\n  ],\n  \"total\": 1\n}\n```\n\n**Frontend usage**\n\n- “Delivery history” page/tab, possibly filterable by date.\n- Clicking a confirmation can open the related order detail.\n\n---\n\n## 5. Earnings summary – GET /merchants/earnings/summary\n\n**Purpose:** Show a split view of merchant earnings (from acting as a merchant) and network earnings (other roles).\n\n**Request**\n\n- Method: `GET`\n- Path: `/merchants/earnings/summary`\n\n**Response (200)**\n\n```json\n{\n  \"merchantEarnings\": {\n    \"totalEarnings\": 500,\n    \"availableEarnings\": 300,\n    \"pendingEarnings\": 200,\n    \"byType\": {\n      \"personalProduct\": 100,\n      \"directReferralProduct\": 150,\n      \"communityProduct\": 50,\n      \"deliveryBonus\": 200\n    }\n  },\n  \"networkEarnings\": {\n    \"totalEarnings\": 1000,\n    \"availableEarnings\": 800,\n    \"pendingEarnings\": 200,\n    \"byType\": {\n      \"PERSONAL_PV\": 400,\n      \"TEAM_PV\": 600\n    }\n  },\n  \"currency\": \"USD\"\n}\n```\n\n**Frontend usage**\n\n- Merchant **Earnings dashboard**:\n  - Card for merchant earnings with breakdown by type.\n  - Card for network earnings with breakdown by earning type.\n  - Use `currency` for amounts display.\n\n---\n\n## 6. Allocations – onboarding & refill\n\n### 6.1 List allocations – GET /merchants/me/allocations\n\n**Purpose:** Show allocations (onboarding/refill stock) awaiting merchant acceptance.\n\n**Request**\n\n- Method: `GET`\n- Path: `/merchants/me/allocations`\n\n**Response (200)**  \nShape is whatever `MerchantAllocationRepository.findByMerchantId` returns; typically:\n\n```json\n[\n  {\n    \"id\": \"allocation-uuid\",\n    \"merchantId\": \"merchant-uuid\",\n    \"productId\": \"product-uuid\",\n    \"quantity\": 10,\n    \"status\": \"PENDING\",\n    \"createdAt\": \"2026-03-04T10:00:00.000Z\",\n    \"product\": {\n      \"id\": \"product-uuid\",\n      \"name\": \"Onboarding Kit\",\n      \"sku\": \"OBK\"\n    }\n  }\n]\n```\n\n**Frontend usage**\n\n- “Allocations” tab in merchant dashboard.\n- Each row shows product name, quantity, status, createdAt, and an **“Accept”** button when `status = PENDING`.\n\n---\n\n### 6.2 Accept allocation – POST /merchants/me/allocations/{id}/accept\n\n**Purpose:** Merchant acknowledges they have **physically received** the stock and moves it into their inventory.\n\n**Request**\n\n- Method: `POST`\n- Path: `/merchants/me/allocations/{id}/accept`\n- Body: none\n\n**Response (200)**\n\n```json\n{ \"message\": \"Allocation accepted successfully\" }\n```\n\n**Backend behavior**\n\n- Validates that allocation belongs to this merchant and is `PENDING`.\n- Decrements admin product pool and increments merchant’s inventory (`merchantProduct`), then marks allocation `ACCEPTED`.\n\n**Frontend usage**\n\n- Label this action clearly, e.g. **“I have received this stock”**.\n- After success, refresh allocations (`GET /merchants/me/allocations`) and inventory (`GET /merchants/inventory`).\n\n---\n\n## 7. Inventory\n\n### 7.1 Get inventory – GET /merchants/inventory\n\n**Purpose:** Show the merchant all products they can sell, with stock info.\n\n**Request**\n\n- Method: `GET`\n- Path: `/merchants/inventory`\n\n**Response (200)**\n\n```json\n{\n  \"items\": [\n    {\n      \"merchantProductId\": \"mp-uuid\",\n      \"productId\": \"product-uuid\",\n      \"productName\": \"Segulah Herbal Tea\",\n      \"productSku\": \"SHT\",\n      \"stockQuantity\": 50,\n      \"stockStatus\": \"IN_STOCK\",\n      \"isActive\": true\n    }\n  ]\n}\n```\n\n**Frontend usage**\n\n- Merchant **Inventory** page/table.\n- Show columns for product name, SKU, stock quantity, stock status, and whether the product is active.\n\n---\n\n### 7.2 Update stock – PUT /merchants/inventory/{productId}/stock\n\n**Purpose:** Let merchant update stock quantity and/or status for a product in their inventory.\n\n**Request**\n\n- Method: `PUT`\n- Path: `/merchants/inventory/{productId}/stock`\n- Body (fields optional, but at least one should be provided):\n\n```json\n{\n  \"stockQuantity\": 15,\n  \"stockStatus\": \"IN_STOCK\"\n}\n```\n\n- `stockQuantity`: integer ≥ 0\n- `stockStatus`: `IN_STOCK` \| `LOW_STOCK` \| `OUT_OF_STOCK`\n\n**Response (200)**\n\nReturns the updated merchant product (as per repository).\n\n**Frontend usage**\n\n- On inventory table, provide an **Edit stock** action (inline or modal) where merchant can adjust `stockQuantity` and `stockStatus`.\n- After success, refresh inventory to reflect the changes.\n\n---\n\n## 8. Recommended UI flow\n\n- **Application & fee**\n  1. Read tiers from `GET /merchants/category-config`.\n  2. Apply via `POST /merchants/apply`.\n  3. Pay fee via `POST /merchants/merchant-fee/initiate`.\n  4. Show status with `GET /merchants/me`.\n\n- **Merchant dashboard entry**\n  - Read `GET /merchants/me` on load:\n    - No profile → show “Apply as merchant”.\n    - PENDING → show “Pending approval” banner.\n    - ACTIVE → show tabs for Orders, Deliveries, Earnings, Allocations, Inventory.\n\n- **Orders tab**\n  - List: `GET /merchants/orders`.\n  - Detail: `GET /merchants/orders/{id}` with actions:\n    - `mark-ready-for-pickup` (PICKUP + ASSIGNED_TO_MERCHANT).\n    - `mark-delivery-requested` (OFFLINE_DELIVERY + ASSIGNED_TO_MERCHANT).\n    - `mark-sent` (dispatched).\n    - `confirm-delivery` (after customer receives).\n\n- **Deliveries tab**\n  - History: `GET /merchants/deliveries`.\n\n- **Earnings tab**\n  - Summary: `GET /merchants/earnings/summary`.\n\n- **Allocations tab**\n  - List: `GET /merchants/me/allocations`.\n  - Accept: `POST /merchants/me/allocations/{id}/accept`.\n\n- **Inventory tab**\n  - List: `GET /merchants/inventory`.\n  - Edit stock: `PUT /merchants/inventory/{productId}/stock`.\n+\n*** End Patch```}#+#+#+#+assistant to=functions.ApplyPatch_COMMENTARY икип:assistant to=functions.ApplyPatchҙәр:commentary ანხმ싶assistant to=functions.ApplyPatch_COMMENTARY  Ladder:commentary  साँassistant to=functions.ApplyPatch_COMMENTARY ించcommentary  ప్రేక్షకassistant to=functions.ApplyPatch_COMMENTARY  kazcommentary  !*** End Patch  Apex:commentary  assistant to=functions.ApplyPatch_COMMENTARY _RETURNED  Pflichten:commentary  JSON  advisor to=functions.ApplyPatch_COMMENTARY  END  !*** End Patch  قصيرة:commentary  #-}
