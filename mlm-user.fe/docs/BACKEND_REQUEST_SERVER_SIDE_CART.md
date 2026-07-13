# Backend Request — Server-Side Cart (Per-User, Cross-Device Sync)

**Date:** 2026-07-13  
**From:** User FE (`mlm-user.fe`)  
**Status:** Shipped — backend live; FE hardened per [frontend-integration-server-side-cart.md](./frontend-integration-server-side-cart.md)  
**Severity:** High  
**Area:** Shopping cart (`GET/PUT/POST/DELETE /cart`)

**Related docs:**

- Cart service: [`cart.service.ts`](../src/app/services/cart.service.ts)
- Cart page: [`cart-page.component.ts`](../src/app/pages/shop/cart-page/cart-page.component.ts)
- Checkout flow: [`cart-checkout.service.ts`](../src/app/services/cart-checkout.service.ts)
- Order placement: [`order.service.ts`](../src/app/services/order.service.ts)
- Integration guide: [frontend-integration-server-side-cart.md](./frontend-integration-server-side-cart.md)

---

## 1. Summary

The cart is currently stored only in the browser (`localStorage` key `mlm_cart_v1`). There is **no backend cart API**, so the same user sees **different cart contents on different devices**.

A client (`DELE1`) reported three different cart states across three devices after logging in with the same username — e.g. 14 items on laptop, 3 on one phone, empty on another phone. Refreshing did not reconcile them because each device keeps its own local copy.

The frontend will sync cart state to the server once these endpoints exist. Until then, it falls back to per-user `localStorage` (no cross-device sync).

---

## 2. Current behavior (reproduction)

### Client observation

1. User `DELE1` added 14 products to cart on a laptop.
2. User logged in as `DELE1` on phone A → cart showed **3 products**.
3. User logged in as `DELE1` on phone B → cart was **empty**.
4. Refreshing laptop and both phones did not align the counts.

### Root cause (frontend)

| Item | Current behavior |
|------|------------------|
| Storage | Browser `localStorage` only (`mlm_cart_v1`) |
| Scope | Per **device/browser**, not per user account |
| API calls | None for cart read/write |
| Cross-device | No sync — each device has its own cart |

### Example: what should happen after backend ships

1. User `DELE1` adds items on laptop → `PUT /cart/items/{productId}` persists to server.
2. User logs in on phone → `GET /cart` returns the same lines as laptop.
3. User clears cart after checkout → `DELETE /cart` clears server cart; all devices see empty cart on next load.

---

## 3. Required business rules

| Rule | Detail |
|------|--------|
| Cart owner | One cart per **authenticated user** (not per device/session) |
| Persistence | Survives logout, browser close, and device change |
| Product reference | Lines store `productId` + `quantity`; response includes a **product snapshot** for display |
| Unavailable products | Accept lines for out-of-stock or unpurchasable products; snapshot flags `inStock` / `purchasable` (FE shows unavailable state) |
| Stock | Cart does **not** reserve inventory |
| Merge on login | When a device has local lines, merge into server cart (see `POST /cart/merge`) |
| Checkout | Existing `POST /orders/checkout` flow unchanged; FE calls `DELETE /cart` after successful wallet payment |

---

## 4. Backend changes requested

### 4.1 `GET /cart`

Returns the authenticated user's cart.

**Response `200`:**

```json
{
  "items": [
    {
      "productId": "uuid-product-1",
      "quantity": 2,
      "product": {
        "id": "uuid-product-1",
        "name": "Herbal Tea",
        "description": "...",
        "memberPriceNGN": 5000,
        "nonMemberPriceNGN": 6000,
        "price": 5000,
        "currency": "NGN",
        "pv": 10,
        "directReferralPv": 5,
        "cpv": 2,
        "category": "health",
        "images": ["/products/tea.png"],
        "inStock": true,
        "eligibleWallets": ["cash", "voucher"],
        "purchasable": true,
        "availableFrom": null,
        "nextPriceEffectiveFrom": null,
        "priceStatus": "active"
      }
    }
  ]
}
```

- Empty cart: `{ "items": [] }`
- Unknown `productId` in DB: omit line or return with `purchasable: false` (FE handles either)

### 4.2 `PUT /cart/items/{productId}`

Upsert a single line. **Quantity is absolute** (not a delta).

**Request body:**

```json
{
  "quantity": 3
}
```

| `quantity` | Behavior |
|------------|----------|
| `> 0` | Set line quantity to value (create or update) |
| `0` | Remove line from cart |

**Response `200`:** full cart (same shape as `GET /cart`).

**Errors:**

| Case | Suggested status |
|------|------------------|
| Invalid `productId` | `404` or accept with unavailable snapshot |
| Unauthenticated | `401` |

### 4.3 `POST /cart/merge`

Merge device-local lines into the server cart after login. Used once per session when FE detects local items.

**Request body:**

```json
{
  "items": [
    { "productId": "uuid-product-1", "quantity": 14 },
    { "productId": "uuid-product-2", "quantity": 3 }
  ]
}
```

**Merge rule:** for each `productId`, server quantity = `max(serverQuantity, incomingQuantity)`.

**Response `200`:** full merged cart (same shape as `GET /cart`).

### 4.4 `DELETE /cart`

Clear all lines for the authenticated user.

**Response `204`** or `{ "items": [] }`.

Called by FE after successful cart checkout (`cart-checkout.service.ts`).

---

## 5. Frontend status

| Item | Status |
|------|--------|
| Per-user `localStorage` key (`mlm_cart_v1:{userId}`) | Done |
| Legacy `mlm_cart_v1` migration on login | Done |
| `GET /cart` feature detection (404/501 → local-only fallback) | Done |
| `POST /cart/merge` on login when local lines exist | Done |
| Optimistic `PUT /cart/items/{productId}` on add/update/remove | Done |
| `PUT` response hydrates cart; failure reverts optimistic update | Done |
| `normalizeCartSnapshot()` for flattened + catalog-nested API shapes | Done |
| `refreshFromServer()` on cart page enter | Done |
| `DELETE /cart` on clear / post-checkout | Done |
| Reset in-memory cart on logout | Done |

Frontend auto-enables server sync when `GET /cart` returns `200`.

---

## 6. Acceptance criteria

- [x] `GET /cart` returns the same cart for user `DELE1` regardless of device.
- [x] `PUT /cart/items/{productId}` with `quantity: 5` sets absolute quantity to 5 (not increment by 5).
- [x] `PUT /cart/items/{productId}` with `quantity: 0` removes the line.
- [x] `POST /cart/merge` uses max quantity per `productId` and returns full cart.
- [x] `DELETE /cart` empties cart; subsequent `GET /cart` returns `{ "items": [] }`.
- [x] Cart is scoped to authenticated user only (`401` when not logged in).
- [x] Product snapshot in responses includes `price`, `pv`, `inStock`, `purchasable`, `images` for cart UI.

---

## 7. Test plan (backend)

1. User A: `PUT` three products → `GET /cart` shows 3 lines on any simulated client.
2. User A on device 1: 14 × product X; device 2: `POST /cart/merge` with 3 × product X → server has 14.
3. User A: `PUT` product Y `quantity: 0` → line removed.
4. User A: `DELETE /cart` → empty; User B cart unchanged.
5. User A checks out (existing order flow) → FE `DELETE /cart` → cart empty on next `GET`.
6. Unauthenticated `GET /cart` → `401`.
