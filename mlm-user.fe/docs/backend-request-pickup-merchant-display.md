# Backend Request — Pickup Merchant Display Data

**Date:** 2026-07-03  
**From:** User FE (`mlm-user.fe`)  
**Related:** [frontend-integration-customer-checkout-pickup.md](./frontend-integration-customer-checkout-pickup.md)  
**Status:** Request for backend change

---

## 1. Problem

The customer app shows pickup location text such as **“Pickup at {merchantName}”** in two places:

| Screen | Example copy | Where data comes from today |
|--------|----------------|-----------------------------|
| Checkout — split-order conflict UI | `Pickup at Merchant B` | **Partially API** — name taken from `POST /merchants/checkout/availability` → `missingItems[].merchantsWithStock[].username`, then stored in **client state** only |
| Order detail — pickup handoff banner | `Pickup at: Merchant Center` | **Mostly missing** — `GET /orders/:id` often returns only `selectedMerchantId`; FE falls back to generic `"Merchant Center"` |

`OrderService.pickupHandoffMessage()` is **static FE copy** (not from an endpoint). It is fine to keep on the client, but it must reference **reliable merchant contact fields from the API** (name, address, phone).

---

## 2. Current frontend behaviour (for context)

### 2a. Checkout split assignment label

File: `order-preview.component.ts`

```typescript
// User picks alternate merchant for a missing line item
assignMissingToMerchant(item, alt.merchantId, alt.username);

// Display
assignmentLabel() → `Pickup at ${assignment.merchantName}`;
```

- `alt.username` is the **only** merchant field used from `merchantsWithStock`.
- `businessName`, `address`, and `phoneNumber` are **not** returned in `merchantsWithStock`, so the FE cannot show a proper pickup card for alternate merchants without cross-referencing the separate `merchants[]` array (fragile if lists diverge).

### 2b. Order detail pickup location

File: `order.service.ts` → `mapOrder()`

```typescript
pickupLocationName =
  merchant?.businessName ??
  merchant?.username ??
  (o.selectedMerchantId ? 'Merchant Center' : undefined);
```

- FE expects `selectedMerchant` or `merchant` embedded on the order payload.
- If absent, users see the useless placeholder **“Merchant Center”**.

---

## 3. Gaps in current API contracts

### Gap A — `merchantsWithStock` is too thin

**Endpoint:** `POST /merchants/checkout/availability`

**Current shape (per alternate merchant):**

```json
{
  "merchantId": "uuid",
  "username": "Merchant B",
  "stockQuantity": 5
}
```

**Missing for pickup UI:**

- `businessName` (display name)
- `address`
- `phoneNumber`
- `pickupAvailable` (address + phone present)

### Gap B — Order responses lack embedded pickup merchant

**Endpoints:** `GET /orders`, `GET /orders/:id`

**Current:** Often only `selectedMerchantId` (UUID).

**FE needs** a stable embedded object so post-checkout screens do not depend on checkout-session state.

### Gap C — Checkout batch response lacks merchant labels per group

**Endpoint:** `POST /orders/checkout`

**Current:** Each order in `orders[]` has `selectedMerchantId` but no merchant display fields.

**FE needs** the same pickup merchant summary on each PICKUP child order (and optionally on the batch root) for thank-you / order list / order detail.

---

## 4. Proposed shared type: `PickupMerchantSummary`

Use the **same shape** everywhere pickup merchant info is shown:

```json
{
  "id": "uuid",
  "businessName": "Segulah Store Lagos",
  "username": "merchant_lagos",
  "displayName": "Segulah Store Lagos",
  "phoneNumber": "08012345678",
  "address": "12 Example Road, Ikeja, Lagos",
  "pickupAvailable": true
}
```

**Rules:**

- `displayName` = `businessName` if set, else `username` (server-computed preferred so all clients match).
- `pickupAvailable` = `true` when `address` and `phoneNumber` are both non-empty (same rule as `GET /merchants/available`).

---

## 5. Requested API changes

### 5a. Enrich `POST /merchants/checkout/availability`

**Change `missingItems[].merchantsWithStock[]`** to:

```json
{
  "merchantId": "uuid",
  "username": "merchant_b",
  "businessName": "Merchant B Stores",
  "displayName": "Merchant B Stores",
  "phoneNumber": "080...",
  "address": "...",
  "stockQuantity": 5,
  "pickupAvailable": true
}
```

**Optional:** Add `productName` on each `missingItems[]` entry so the FE does not rely on cart cache:

```json
{
  "productId": "uuid",
  "productName": "Wine",
  "quantityNeeded": 1,
  "merchantsWithStock": [ /* PickupMerchantSummary + stockQuantity */ ]
}
```

### 5b. Embed merchant on order reads

**Endpoints:** `GET /orders`, `GET /orders/:id`

For every order where `fulfilmentMode === "PICKUP"` and `selectedMerchantId` is set, include:

```json
{
  "id": "order-uuid",
  "reference": "ORD-REF-...",
  "fulfilmentMode": "PICKUP",
  "selectedMerchantId": "merchant-uuid",
  "selectedMerchant": {
    "id": "merchant-uuid",
    "businessName": "Segulah Store Lagos",
    "username": "merchant_lagos",
    "displayName": "Segulah Store Lagos",
    "phoneNumber": "08012345678",
    "address": "12 Example Road, Ikeja, Lagos",
    "pickupAvailable": true
  }
}
```

Acceptable alias: top-level `merchant` if that already exists — but **document one canonical field** (`selectedMerchant` preferred).

### 5c. Enrich `POST /orders/checkout` response

Each entry in `orders[]` with `fulfilmentMode: "PICKUP"` should include `selectedMerchant` (same shape as §5b):

```json
{
  "checkoutId": "batch-uuid",
  "orders": [
    {
      "id": "order-uuid",
      "fulfilmentMode": "PICKUP",
      "selectedMerchantId": "merchant-a",
      "selectedMerchant": { /* PickupMerchantSummary */ },
      "totalAmount": 120,
      "items": [ /* ... */ ]
    }
  ],
  "grandTotal": 200
}
```

### 5d. (Optional) Pickup handoff copy fields

If the backend wants to own customer-facing guidance text, add read-only fields on `GET /orders/:id`:

```json
{
  "pickupHandoff": {
    "status": "READY_FOR_PICKUP",
    "customerMessage": "Your order is ready for pickup. Visit the merchant below...",
    "canConfirmReceived": false,
    "canOpenDispute": false
  }
}
```

Not required for v1 — FE can keep static messages once `selectedMerchant` is populated.

---

## 6. Acceptance criteria

1. After checkout, `GET /orders/:id` shows real merchant name + address + phone (no `"Merchant Center"` fallback needed).
2. Split checkout alternate-merchant buttons can use `merchantsWithStock[].displayName` (and show address/phone) without merging two response arrays on the client.
3. `POST /orders/checkout` returns enough data for thank-you / order list for multi-merchant splits.
4. Field names are consistent across:
   - `GET /merchants/available`
   - `POST /merchants/checkout/availability`
   - `POST /orders/checkout`
   - `GET /orders` / `GET /orders/:id`

---

## 7. FE follow-up after backend ships

Once the API is updated, the user app will:

1. Map `selectedMerchant.displayName` → `pickupLocationName` / `selectedMerchantName` on orders.
2. Store full `PickupMerchantSummary` in split-assignment state instead of only `username`.
3. Show address + phone on order detail pickup banner and checkout split summary.
4. Remove the `"Merchant Center"` fallback when `selectedMerchant` is present.

---

## 8. References (current FE files)

| File | Usage |
|------|--------|
| `src/app/pages/orders/order-preview/order-preview.component.ts` | `assignmentLabel`, `groupLabel`, split checkout |
| `src/app/services/merchant.service.ts` | `MerchantWithStock`, `checkCheckoutAvailability` |
| `src/app/services/order.service.ts` | `mapOrder`, `pickupHandoffMessage` |
| `src/app/pages/orders/order-detail/order-detail.component.html` | Pickup banner + location display |
