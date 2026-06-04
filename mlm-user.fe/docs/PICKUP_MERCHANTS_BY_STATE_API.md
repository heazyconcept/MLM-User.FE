# Pickup merchants by state — API spec (backend)

> Superseded by `mlm-user.fe/PICKUP_MERCHANTS_BY_STATE_API.md` (shipped integration spec).

**Audience:** Backend team  
**Consumer:** User app — order fulfilment / pickup on checkout (`order-preview`)  
**Date:** 2026-06-03

---

## Summary

When a user chooses **Pickup** at checkout, they first select a **Nigerian state**, then pick an **ACTIVE merchant** in that state. The list must include **business name**, **physical address**, and **phone number** so the user knows where to collect the order.

The user frontend will call an extended **`GET /merchants/available`** (preferred). An optional dedicated route is documented below if you prefer a separate handler.

---

## Preferred: extend existing endpoint

### `GET /merchants/available`

| Item | Value |
|------|--------|
| **Auth** | `Authorization: Bearer <token>` + registration paid (recommended; aligns with `docs/project/API.md`). Public access is acceptable only if product policy allows unauthenticated discovery. |
| **Purpose** | List ACTIVE merchants available for pickup, optionally filtered by state and cart stock. |

### Query parameters

| Param | Required | Type | Description |
|-------|----------|------|-------------|
| `state` | **Yes** for pickup UX | string | Nigerian state name, e.g. `Lagos`, `FCT`. Match against merchant `serviceAreas` (trim, case-insensitive). |
| `location` | No | string | **Backward-compatible alias** for `state`. If both are sent, prefer `state`. |
| `productId` | No | uuid | When set with `quantity`, return only merchants with **enough stock** for this product (PICKUP orders validate stock at creation). |
| `quantity` | No | integer | Defaults to `1`. Used with `productId`. |

**Example**

```http
GET /merchants/available?state=Lagos&productId=550e8400-e29b-41d4-a716-446655440000&quantity=2
Authorization: Bearer <token>
```

### Response `200 OK`

```json
{
  "merchants": [
    {
      "id": "c9470d1e-fae5-4110-88a2-7b1b8f62bb66",
      "businessName": "Heazy concept2",
      "phoneNumber": "+2348101435990",
      "address": "16 Shoremekun Street Shasha Lagos State",
      "serviceAreas": ["Lagos"],
      "pickupAvailable": true,
      "products": [
        {
          "id": "product-uuid",
          "name": "Product Name",
          "sku": "SKU-001"
        }
      ]
    }
  ]
}
```

### Response fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | uuid | Yes | Merchant ID — frontend sends this as `selectedMerchantId` on `POST /orders`. |
| `businessName` | string | Yes | Display name for pickup list. |
| `phoneNumber` | string | Yes | Contact phone (E.164 or local format). |
| `address` | string | Yes | Physical store / pickup address. |
| `serviceAreas` | string[] | Yes | States/regions the merchant serves. |
| `pickupAvailable` | boolean | Yes | `true` only when merchant can accept pickup (see rules below). |
| `products` | array | No | Products this merchant carries (existing field; keep if already implemented). |
| `name` | string | No | Legacy/display fallback (e.g. user email); frontend prefers `businessName`. |

### Filtering rules (acceptance criteria)

1. **Status:** Only merchants with `status = ACTIVE`.
2. **State:** Include merchant if `serviceAreas` contains the requested state (case-insensitive) **or** contains `"*"`.
3. **Pickup eligibility:** Set `pickupAvailable: true` only when:
   - Merchant is ACTIVE,
   - `address` and `phoneNumber` are non-empty,
   - If `productId` + `quantity` are provided: merchant has sufficient **inventory stock** for that product (same rule as PICKUP order creation).
4. **Sort:** Optional `businessName` ascending.
5. **Empty result:** Return `200` with `{ "merchants": [] }` — not `404`.

### Errors

| Status | When |
|--------|------|
| `400` | `state` / `location` missing when required by contract version you ship. |
| `401` | Missing or invalid token (if auth required). |
| `403` | User registration not paid (if `RegistrationPaidGuard` applies). |

---

## Optional alternative route

If you prefer not to overload `/merchants/available`:

### `GET /merchants/pickup-locations`

Same query parameters, response body, and filtering rules as above.

```http
GET /merchants/pickup-locations?state=Lagos&productId=...&quantity=1
Authorization: Bearer <token>
```

Frontend can switch to this path in one place (`MerchantService`) once implemented.

---

## Integration with order creation

After the user selects a merchant, the frontend creates the order with:

```json
{
  "items": [{ "productId": "...", "quantity": 1 }],
  "fulfilmentMode": "PICKUP",
  "selectedMerchantId": "<merchant.id from this endpoint>",
  "paymentMethod": "WALLET"
}
```

Stock must be validated again on `POST /orders` (existing behaviour). The pickup-locations endpoint should use the **same stock check** so the list only shows merchants who can fulfil the cart.

---

## Related docs

- [MERCHANTS_API.md](../MERCHANTS_API.md) — current `/merchants/available` (needs `address`, `businessName`, `phoneNumber` in response)
- [merchant-flow-frontend.md](../merchant-flow-frontend.md) — PICKUP stock decremented at order creation
- Merchant profile fields: `businessName`, `phoneNumber`, `address`, `serviceAreas` from `POST /merchants/apply` / `GET /merchants/me`

---

## Frontend status

The user app will send `state` (+ `productId` / `quantity` when supported). Until `address` is returned by the API, the pickup list may show incomplete rows; **please add the three fields above to the available-merchants response.**
