# Products & Orders API (User-facing)

This doc covers the **logged-in user** endpoints for products and orders:

- **Products:** `GET /products`, `GET /products/{id}`  
- **Orders:** `POST /orders`, `GET /orders`, `POST /orders/{id}/pay-wallet`, `GET /orders/{id}`, `POST /orders/{id}/cancel`, `POST /orders/{id}/confirm-received`

For fully public product browsing (no auth), also see the **Public - Products** endpoints (`/public/products`, `/public/products/{id}`) described briefly below.

**Auth:** Unless stated as *Public*, send `Authorization: Bearer <userAccessToken>`.

---

## Summary

| Endpoint | Method | Auth | Purpose |
|----------|--------|------|---------|
| `/products` | GET | User | Get product catalog with member/non-member pricing |
| `/products/{id}` | GET | User | Get product details with current price and images |
| `/orders` | POST | User (registration paid) | Create a new order (unpaid) |
| `/orders` | GET | User | List my orders |
| `/orders/{id}` | GET | User | Get my order details |
| `/orders/{id}/pay-wallet` | POST | User | Pay for order using CASH wallet |
| `/orders/{id}/cancel` | POST | User | Cancel an unpaid order (CREATED/PENDING) |
| `/orders/{id}/confirm-received` | POST | User | Mark order as received |

Public (no auth):

| Endpoint | Method | Auth | Purpose |
|----------|--------|------|---------|
| `/public/products` | GET | Public | Public catalog view (non-member pricing) |
| `/public/products/{id}` | GET | Public | Public product details (non-member pricing) |

---

## Products

### GET /products

**Purpose:** Get product catalog for the logged-in user, including **current price** (member & non-member), PV/CPV, category, and images. Visibility respects user role and package.\
Internally uses `ProductRepository.listForUser` with `user.registrationPackage` and `user.role`.

**Request**

- **Method:** `GET`
- **Path:** `/products`
- **Headers:** `Authorization: Bearer <token>`
- **Query (all optional):**

| Param | Type | Description |
|-------|------|-------------|
| `categoryId` | string | Filter by category UUID |
| `limit` | number | Page size (default 20) |
| `offset` | number | Offset for pagination (default 0) |

**Response (200)**

```json
{
  "items": [
    {
      "id": "product-uuid",
      "name": "Segulah Herbal Tea",
      "description": "Herbal tea description",
      "sku": "SHT",
      "category": {
        "id": "category-uuid",
        "name": "Herbal Teas",
        "slug": "herbal-teas",
        "description": "",
        "isActive": true
      },
      "status": "ACTIVE",
      "currentPrice": {
        "id": "price-uuid",
        "basePrice": 500,
        "nonMemberBasePrice": 2000,
        "pv": 10,
        "cpv": 5,
        "effectiveFrom": "2026-03-04T00:00:00.000Z"
      },
      "images": [
        {
          "id": "image-uuid",
          "url": "https://...",
          "altText": null,
          "position": 0
        }
      ]
    }
  ],
  "total": 1,
  "limit": 20,
  "offset": 0
}
```

- `currentPrice` may be `null` if product has no active price (such products should generally not appear for purchase).
- `basePrice`: member price in USD; `nonMemberBasePrice`: non-member price (falls back to basePrice when not set).

**Frontend:** Use for the logged-in catalog. Combine with `/public/products` when you need an unauthenticated landing page.

---

### GET /products/{id}

**Purpose:** Get **one product** with current price and images, applying visibility rules and requiring an active price.\
If product is not ACTIVE or not visible to the user, it returns 404.

**Request**

- **Method:** `GET`
- **Path:** `/products/{id}` — `id` = product UUID
- **Headers:** `Authorization: Bearer <token>`

**Response (200)**

```json
{
  "id": "product-uuid",
  "categoryId": "category-uuid",
  "name": "Segulah Herbal Tea",
  "description": "Herbal tea description",
  "sku": "SHT",
  "status": "ACTIVE",
  "currentPrice": {
    "id": "price-uuid",
    "basePrice": 500,
    "nonMemberBasePrice": 2000,
    "pv": 10,
    "cpv": 5,
    "effectiveFrom": "2026-03-04T00:00:00.000Z"
  },
  "images": [
    {
      "id": "image-uuid",
      "url": "https://...",
      "altText": null,
      "position": 0
    }
  ]
}
```

**Errors:** 404 if product does not exist or is not ACTIVE/visible; 400 if product has no active price.\
**Frontend:** Product detail page used when adding to cart or order builder.

---

### Public product endpoints (no auth)

These are **read-only** views of the catalog for unauthenticated users.\
They reuse the same service but with a synthetic “public” user configured as lowest package, so visibility rules are conservative and pricing uses non-member base price.

- `GET /public/products` — same shape as `/products`, but for a synthetic public user.
- `GET /public/products/{id}` — same as `/products/{id}`, but for a public user.

Use these for marketing pages and pre-login browsing; switch to `/products` after login for member-specific pricing/visibility.\
\n---\n\n## Orders\n\nAll `/orders` endpoints require a logged-in user (`Authorization: Bearer <token>`).\n\n### POST /orders\n\n**Purpose:** Create a new **unpaid** order from a list of products and quantities. The user must have **paid registration** and their autoship wallet must not be in overdraft.\n\n**Request**\n\n- **Method:** `POST`\n- **Path:** `/orders`\n- **Headers:** `Authorization: Bearer <token>`, `Content-Type: application/json`\n- **Body:**\n\n```json\n{\n  \"items\": [\n    { \"productId\": \"product-uuid-1\", \"quantity\": 2 },\n    { \"productId\": \"product-uuid-2\", \"quantity\": 1 }\n  ],\n  \"paymentMethod\": \"WALLET_FUNDING\",  // see PaymentMethod enum\n  \"fulfilmentMode\": \"PICKUP\",          // or \"OFFLINE_DELIVERY\"\n  \"selectedMerchantId\": \"merchant-uuid\", // required for PICKUP\n  \"deliveryAddress\": \"123 Main St, Lagos\", // required for OFFLINE_DELIVERY\n  \"deliveryDisclaimerAccepted\": true,        // required for OFFLINE_DELIVERY\n  \"idempotencyKey\": \"optional-unique-key\"  // optional, for retry safety\n}\n```\n\nKey rules:\n\n- **Items**: at least one item; each with `productId` and `quantity >= 1`.\n- **Products**: must exist, be `ACTIVE`, and have an active price.\n- **Autoship wallet**: user’s AUTOSHIP wallet must not be negative (no overdraft) or order is rejected.\n- **FulfilmentMode:**\n  - `PICKUP` → `selectedMerchantId` is **required** and must refer to an ACTIVE merchant that has enough stock (`merchantProduct.stockQuantity`) for each item.\n  - `OFFLINE_DELIVERY` → `deliveryAddress` (min length 10) and `deliveryDisclaimerAccepted: true` are **required**.\n- **Idempotency:** if you send `idempotencyKey` and an order with that key already exists, the existing order is returned instead of creating a new one.\n\n**Response (201)**\n\n```json\n{\n  \"id\": \"order-uuid\",\n  \"status\": \"PENDING\",\n  \"totalAmount\": 99.99,\n  \"baseAmount\": 89.99,\n  \"currency\": \"USD\",\n  \"paymentMethod\": \"WALLET_FUNDING\",\n  \"fulfilmentMode\": \"PICKUP\",\n  \"customerType\": \"MEMBER\",\n  \"merchantRoute\": null,\n  \"selectedMerchantId\": \"merchant-uuid\",\n  \"deliveryAddress\": null,\n  \"deliveryDisclaimerAccepted\": null,\n  \"sentAt\": null,\n  \"sentBy\": null,\n  \"receivedAt\": null,\n  \"items\": [\n    {\n      \"id\": \"order-item-uuid\",\n      \"productId\": \"product-uuid-1\",\n      \"productName\": \"Segulah Herbal Tea\",\n      \"quantity\": 2,\n      \"unitPrice\": 29.99,\n      \"pv\": 10,\n      \"cpv\": 5,\n      \"lineTotal\": 59.98\n    }\n  ],\n  \"createdAt\": \"2026-03-04T10:00:00.000Z\"\n}\n```\n\n**Frontend:**\n\n- Build order payload from cart: `items`, `fulfilmentMode`, and either `selectedMerchantId` (PICKUP) or `deliveryAddress` + `deliveryDisclaimerAccepted` (OFFLINE_DELIVERY).\n- Show validation errors back to user (e.g. missing address, inactive product, insufficient merchant stock, autoship overdraft).\n\n---\n\n### GET /orders\n\n**Purpose:** Get the current user’s orders with optional filters and pagination.\n\n**Request**\n\n- **Method:** `GET`\n- **Path:** `/orders`\n- **Headers:** `Authorization: Bearer <token>`\n- **Query (all optional):**\n\n| Param | Type | Description |\n|-------|------|-------------|\n| `status` | OrderStatus | Filter by order status (e.g. `PENDING`, `PAID`, `DELIVERED`) |\n| `fromDate` | ISO date-time | Orders created on or after this date |\n| `toDate` | ISO date-time | Orders created on or before this date |\n| `limit` | number | Page size (default 20) |\n| `offset` | number | Offset (default 0) |\n\n**Response (200)**\n\n```json\n{\n  \"orders\": [\n    {\n      \"id\": \"order-uuid\",\n      \"status\": \"PAID\",\n      \"totalAmount\": 99.99,\n      \"baseAmount\": 89.99,\n      \"currency\": \"USD\",\n      \"paymentMethod\": \"WALLET_FUNDING\",\n      \"fulfilmentMode\": \"PICKUP\",\n      \"customerType\": \"MEMBER\",\n      \"selectedMerchantId\": \"merchant-uuid\",\n      \"deliveryAddress\": null,\n      \"deliveryDisclaimerAccepted\": null,\n      \"sentAt\": null,\n      \"sentBy\": null,\n      \"receivedAt\": null,\n      \"items\": [\n        {\n          \"id\": \"order-item-uuid\",\n          \"productId\": \"product-uuid\",\n          \"productName\": \"Segulah Herbal Tea\",\n          \"quantity\": 2,\n          \"unitPrice\": 29.99,\n          \"pv\": 10,\n          \"cpv\": 5,\n          \"lineTotal\": 59.98\n        }\n      ],\n      \"createdAt\": \"2026-03-04T10:00:00.000Z\"\n    }\n  ],\n  \"total\": 1,\n  \"limit\": 20,\n  \"offset\": 0\n}\n```\n\n**Frontend:** Use for order history list; filter by `status` and date range.\n\n---\n\n### GET /orders/{id}\n\n**Purpose:** Get a single order belonging to the current user. If the order is not the user’s, it returns 403.\n\n**Request**\n\n- **Method:** `GET`\n- **Path:** `/orders/{id}` — `id` = order UUID\n\n**Response (200)**\n\nSame shape as a single item in `GET /orders`.\n\n**Errors:** 404 if order not found; 403 if order belongs to another user.\n\n**Frontend:** Order detail page; show fulfilment info, items, and actions (pay, cancel, confirmReceived) depending on `status`.\n\n---\n\n### POST /orders/{id}/pay-wallet\n\n**Purpose:** Pay for an **unpaid** order using the user’s **CASH wallet**. Allowed only when order status is `CREATED` or `PENDING`.\n\n**Request**\n\n- **Method:** `POST`\n- **Path:** `/orders/{id}/pay-wallet`\n- **Headers:** `Authorization: Bearer <token>`\n- **Body:** none\n\n**Behavior (from service):**\n\n- Order must exist and belong to the current user.\n- Status must be `CREATED` or `PENDING`; otherwise 400.\n- Finds user’s CASH wallet; validates wallet currency matches order currency.\n- Debits the wallet by `baseAmount` in order currency, with ledger source `PRODUCT_PURCHASE`.\n- Uses order totals (item count, total PV, total CPV) as metadata.\n\n**Response (200)**\n\n```json\n{\n  \"message\": \"Payment successful\"\n}\n```\n\n**Frontend:** After a successful call, refresh the order via `GET /orders/{id}` to show updated `status` (e.g. `PAID`). Display wallet errors (insufficient funds, wrong currency, missing wallet) from 400 responses.\n\n---\n\n### POST /orders/{id}/cancel\n\n**Purpose:** Cancel an **unpaid** order (status `CREATED` or `PENDING`).\n\n**Request**\n\n- **Method:** `POST`\n- **Path:** `/orders/{id}/cancel`\n- **Headers:** `Authorization: Bearer <token>`\n- **Body:** none\n\n**Behavior:**\n\n- Order must exist and belong to the user.\n- Status must be `CREATED` or `PENDING`; otherwise 400 \"Only unpaid orders can be cancelled\".\n- Sets status to `CANCELLED` and emits audit/notification events.\n\n**Response (200)**\n\nReturns the updated order object (same shape as `GET /orders/{id}`) with `status: \"CANCELLED\"`.\n\n**Frontend:** Show \"Cancel\" button only for `CREATED`/`PENDING` orders; after success, update list/detail to show `CANCELLED`.\n\n---\n\n### POST /orders/{id}/confirm-received\n\n**Purpose:** Customer confirms they have received the order. This updates internal state via `orderRepo.updateReceived` (exact status transitions may be handled elsewhere), and can trigger downstream flows (e.g. completion, earnings release).\n\n**Request**\n\n- **Method:** `POST`\n- **Path:** `/orders/{id}/confirm-received`\n- **Headers:** `Authorization: Bearer <token>`\n- **Body:** none\n\n**Behavior:**\n\n- Order must exist and belong to the user; otherwise 404/403.\n- Calls `confirmReceived(orderId, userId)`, which marks the order as received in the repository.\n\n**Response (200)**\n\n```json\n{\n  \"message\": \"Order marked as received\"\n}\n```\n\n**Frontend:** Show \"Confirm received\" once the order is delivered (e.g. after merchant/admin delivery confirmation) and hide it after success.\n\n---\n\n## Frontend guidelines\n\n- **Products catalog & details**\n  - Use `/public/products` and `/public/products/{id}` for unauthenticated browsing.\n  - Use `/products` and `/products/{id}` after login; they respect user package, role, and visibility and return `currentPrice` with member vs non-member price.\n- **Order creation**\n  - Always validate client-side that cart has at least one item and that fulfilment fields (selected merchant or address/disclaimer) are present before calling `POST /orders`.\n  - Use `idempotencyKey` when you need safe retries (e.g. unstable network).\n- **Order lifecycle**\n  - Newly created orders start as `PENDING` (or `CREATED` for legacy). Then:\n    - `POST /orders/{id}/pay-wallet` → pays and moves to a paid status (e.g. `PAID`).\n    - `POST /orders/{id}/cancel` → allowed only before payment.\n    - `POST /orders/{id}/confirm-received` → called after delivery; use `status` and merchant/admin flows to decide when to show this.\n- **History & detail**\n  - Use `GET /orders` with `status`, `fromDate`, `toDate` for history.\n  - Use `GET /orders/{id}` for detail; enforce that users only see their own orders (backend already enforces this with 403).\n*** End Patch】"}>>
