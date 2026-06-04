# Pickup merchants by state — frontend integration

**Audience:** User app (checkout / order-preview pickup flow)  
**Status:** **Shipped** on `GET /merchants/available` (2026-06-04)  
**Backend reference:** [docs/API.md](../API.md), implementation plan [pickup_merchants_api_916fed0a.plan.md](../api/pickup_merchants_api_916fed0a.plan.md)

---

## Summary

When a user chooses **Pickup** at checkout, they select a **Nigerian state**, then an **ACTIVE merchant** in that state. The list must show **business name**, **physical address**, and **phone number** so the user knows where to collect the order.

Call **`GET /merchants/available`** with a required `state` (or legacy `location`) query param. There is **no** separate `/merchants/pickup-locations` route — wire everything through this endpoint.

---

## Endpoint

### `GET /merchants/available`

| Item | Value |
|------|--------|
| **Auth** | `Authorization: Bearer <token>` — user must be **registration paid** (`RegistrationPaidGuard`). Unauthenticated calls receive `401`; unpaid registration receives `403`. |
| **Purpose** | List ACTIVE merchants for pickup, filtered by state and optionally by cart product stock. |

### Query parameters

| Param | Required | Type | Description |
|-------|----------|------|-------------|
| `state` | **Yes** (pickup UX) | string | Nigerian state, e.g. `Lagos`, `FCT`. Matched against merchant `serviceAreas` (trim, case-insensitive). |
| `location` | No | string | Alias for `state`. Resolved as `state ?? location`; if both are sent, **`state` wins** when non-empty after trim. |
| `productId` | No | uuid | When set, **only merchants with enough stock** for this product are returned (see stock rules below). |
| `quantity` | No | integer (≥ 1) | Defaults to `1`. Used with `productId`. |

**Example**

```http
GET /merchants/available?state=Lagos&productId=550e8400-e29b-41d4-a716-446655440000&quantity=2
Authorization: Bearer <token>
```

**Missing state**

```http
GET /merchants/available
```

→ `400 Bad Request` with message: `state or location query parameter is required`

### Response `200 OK`

```json
{
  "merchants": [
    {
      "id": "c9470d1e-fae5-4110-88a2-7b1b8f62bb66",
      "businessName": "Heazy concept2",
      "name": "Heazy concept2",
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

| Field | Type | Notes |
|-------|------|--------|
| `id` | uuid | Send as `selectedMerchantId` on `POST /orders` with `fulfilmentMode: "PICKUP"`. |
| `businessName` | string | **Primary display name** for the pickup list. |
| `phoneNumber` | string | Merchant phone, or user account phone if merchant phone is empty. |
| `address` | string | Physical pickup address (`""` if not set). Merchants set this via `PATCH /merchants/me`. |
| `serviceAreas` | string[] | States/regions served; `"*"` means all states. |
| `pickupAvailable` | boolean | `true` only when phone and address are both non-empty (after trim). |
| `products` | array | Active products the merchant carries (`id`, `name`, `sku`). |
| `name` | string | Legacy display fallback (same as `businessName` in practice). Prefer `businessName` in new UI. |

### Errors

| Status | When |
|--------|------|
| `400` | `state` and `location` both missing or blank after trim. |
| `401` | Missing or invalid Bearer token. |
| `403` | User registration not paid. |

Empty matches always return **`200`** with `{ "merchants": [] }` — not `404`.

---

## Behaviour the UI should rely on

### 1. State filter

- Only merchants with `status = ACTIVE` are considered.
- A merchant is included if `serviceAreas` contains the requested state (**case-insensitive**) or contains `"*"`.
- Results are sorted **`businessName` ascending**.

### 2. `pickupAvailable`

Set to `true` only when:

- `phoneNumber` is non-empty after trim, **and**
- `address` is non-empty after trim.

Merchants **without** contact info may still appear in the list when you do **not** pass `productId` (e.g. browsing by state only). In that case, show them as **not selectable** (`pickupAvailable: false`) or hide them — product policy is up to UX, but do not allow checkout with `selectedMerchantId` unless the user can actually pick up there.

### 3. Stock filter (`productId` + `quantity`)

When both are sent:

- Merchants **without** sufficient active inventory are **omitted from the array entirely** (not returned with `pickupAvailable: false`).
- Stock rule matches order creation: active `MerchantProduct` with `stockQuantity >= quantity` (no separate `stockStatus` gate).

When `productId` is **omitted**:

- All state-matching ACTIVE merchants are returned regardless of stock (useful before the cart line is fixed).

**Recommended checkout flow:** Once the user has a product and quantity on the order preview, call with `productId` and `quantity` so the list only shows merchants who can fulfil the cart.

### 4. Order creation (unchanged)

After selection:

```json
{
  "items": [{ "productId": "...", "quantity": 1 }],
  "fulfilmentMode": "PICKUP",
  "selectedMerchantId": "<merchant.id from this endpoint>",
  "paymentMethod": "WALLET"
}
```

`POST /orders` still re-validates stock at creation — treat this endpoint as a **preview filter**, not a guarantee.

---

## Suggested frontend wiring

### Service call

Centralise in `MerchantService` (or equivalent):

```typescript
type AvailableMerchant = {
  id: string;
  businessName: string;
  name: string;
  phoneNumber: string;
  address: string;
  serviceAreas: string[];
  pickupAvailable: boolean;
  products: { id: string; name: string; sku: string }[];
};

async function getPickupMerchants(params: {
  state: string;
  productId?: string;
  quantity?: number;
}): Promise<AvailableMerchant[]> {
  const search = new URLSearchParams({ state: params.state });
  if (params.productId) {
    search.set('productId', params.productId);
    search.set('quantity', String(params.quantity ?? 1));
  }
  const res = await api.get<{ merchants: AvailableMerchant[] }>(
    `/merchants/available?${search}`,
  );
  return res.merchants;
}
```

### Pickup step UX

1. User selects **Pickup** and a **state** (from your Nigerian states list).
2. Call `getPickupMerchants({ state, productId, quantity })` when cart line items are known.
3. Render each row: `businessName`, `address`, `phoneNumber`.
4. Enable selection only when `pickupAvailable === true` (and optionally confirm `id` is set).
5. On confirm, pass `selectedMerchantId` into order create / preview payload.

### Empty states

| Situation | Suggested copy / action |
|-----------|-------------------------|
| `merchants.length === 0` with `productId` | No merchants in this state with enough stock for this product. |
| `merchants.length === 0` without `productId` | No active merchants in this state. |
| Rows with `pickupAvailable: false` | Merchant has not completed pickup contact details (address/phone). |

---

## Merchant-side prerequisite

Pickup addresses come from the merchant profile **`address`** field:

- Set after approval via **`PATCH /merchants/me`** (ACTIVE merchants only).
- Read via **`GET /merchants/me`**.

Until merchants update their profile, `pickupAvailable` may be `false` even when they are ACTIVE in the state.

---

## Related docs

- [docs/API.md](../API.md) — full merchants route table
- [merchant-flow-frontend.md](../api/merchant-flow-frontend.md) — PICKUP fulfilment and stock at order creation
- [merchant-profile-update-requirements.md](./merchant-profile-update-requirements.md) — `PATCH /merchants/me` including `address`

---

## Changelog

| Date | Change |
|------|--------|
| 2026-06-03 | Initial backend spec (Febugs). |
| 2026-06-04 | **Implemented** on `GET /merchants/available`; doc updated for frontend integration (auth, query, response, `pickupAvailable`, stock filter). |
