# Backend Request — Merchant Delivery History Incomplete

**Date:** 2026-07-03  
**From:** User FE (`mlm-user.fe`)  
**Related:** [MERCHANTS_API.md](./MERCHANTS_API.md), [frontend-integration-customer-checkout-pickup.md](./frontend-integration-customer-checkout-pickup.md)  
**Status:** Request for backend change  
**Reported issue:** Merchant Center → **Delivery History** does not return all orders the merchant has fulfilled / delivered.

---

## 1. Problem

On **Merchant Center → Delivery History** (`/merchant/deliveries`), merchants expect to see **every order they have completed fulfilment for**. In practice, many fulfilled orders are **missing** from the list.

The page subtitle is: *"Orders you've confirmed as delivered"*.

---

## 2. Current frontend behaviour

### 2a. Page and API

| Item | Value |
|------|--------|
| Route | `/merchant/deliveries` |
| Component | `merchant-deliveries.component.ts` |
| API call | `GET /merchants/deliveries` |
| Service | `MerchantService.fetchDeliveries()` |

**Request today:** no query params (no `limit`, `offset`, filters).

```typescript
// merchant-deliveries.component.ts
ngOnInit(): void {
  this.merchantService.fetchDeliveries();
}
```

**Response shape consumed:**

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
      "order": { /* optional embedded order */ }
    }
  ],
  "total": 1
}
```

The UI renders `confirmations[]` only. If an order was fulfilled but **no confirmation row exists**, it never appears.

### 2b. How a row gets created today

A delivery history row is created only when the merchant calls:

```
POST /merchants/orders/:id/confirm-delivery
```

That flow is documented for **OFFLINE_DELIVERY** orders after `OFFLINE_DELIVERY_REQUESTED`.

It is **not** used for the new **PICKUP** handoff flow (Requirement 4).

---

## 3. Root causes (why orders are missing)

### Cause A — PICKUP orders excluded by design

Per [frontend-integration-customer-checkout-pickup.md](./frontend-integration-customer-checkout-pickup.md):

| Fulfilment | Merchant completes via | Customer completes via | Creates `delivery_confirmation` row? |
|------------|------------------------|----------------------|----------------------------------------|
| **PICKUP** | `POST /merchants/orders/:id/mark-picked-up` | `POST /orders/:id/confirm-received` → `COMPLETED` | **No** — `confirm-delivery` is **rejected** for PICKUP |
| **OFFLINE_DELIVERY** | `POST /merchants/orders/:id/confirm-delivery` | (optional / varies) | **Yes** (when merchant confirms) |

**Result:** All pickup orders the merchant has handed off (`PICKED_UP` / `COMPLETED`) are **absent** from `GET /merchants/deliveries`.

### Cause B — Orders fulfilled without a confirmation audit record

Even for delivery orders, a merchant may:

- Mark **sent** (`POST .../mark-sent`) but never call `confirm-delivery`
- Have the order reach `COMPLETED` through another path (customer confirm, admin action)
- Have `confirm-delivery` succeed but the list endpoint not return the linked row

If `GET /merchants/deliveries` only reads the `delivery_confirmations` table and that insert failed or was skipped, the order is missing from history.

### Cause C — Pagination / total mismatch

- FE calls `GET /merchants/deliveries` **without** `limit` / `offset`.
- If the backend applies a **default limit** (e.g. 20) but `total` is wrong, or the FE does not paginate, merchants with many confirmations only see the first page.
- FE has **no pagination UI** on Delivery History today — backend must return complete data or a reliable `total` + paging contract.

### Cause D — Status / fulfilment filters on related endpoints

`GET /merchants/orders` supports `status` filter, but merchant FE `OrderStatus` does not include newer lifecycle values (`PICKED_UP`, `COMPLETED`, `SENT` vs backend `OrderStatus` in API.md).

Merchants cannot reliably cross-check missing delivery history via **Orders** → filter **DELIVERED** because completed pickup orders may be `COMPLETED`, not `DELIVERED`.

---

## 4. Expected product behaviour

**Delivery History** should list **all orders assigned to the authenticated merchant** where the merchant has **completed their fulfilment responsibility**, including:

| Fulfilment mode | Include when status is |
|-----------------|------------------------|
| `OFFLINE_DELIVERY` | Merchant called `confirm-delivery` **OR** order is `DELIVERED` / `COMPLETED` with this merchant as `selectedMerchantId` |
| `PICKUP` | Merchant called `mark-picked-up` (`PICKED_UP`) **OR** customer confirmed (`COMPLETED`) |

Each row should be identifiable by **order reference**, fulfilment type, final status, customer email (optional), amount, and completion timestamp.

---

## 5. Requested API changes

### Option A (preferred) — Extend `GET /merchants/deliveries`

Keep the same path but return a **unified fulfilment history** (not only `delivery_confirmations` rows).

**Suggested response item** (`FulfilmentHistoryEntry`):

```json
{
  "id": "entry-uuid",
  "orderId": "order-uuid",
  "orderReference": "ORD-REF-ABC123",
  "fulfilmentMode": "PICKUP",
  "orderStatus": "COMPLETED",
  "completedAt": "2026-07-02T17:41:00.000Z",
  "completionType": "CUSTOMER_CONFIRMED",
  "confirmedBy": "CUSTOMER",
  "proof": null,
  "notes": null,
  "customerEmail": "buyer@example.com",
  "totalAmount": 43000,
  "currency": "NGN",
  "order": { /* optional full order embed */ }
}
```

**`completionType` enum (suggested):**

| Value | Meaning |
|-------|---------|
| `MERCHANT_CONFIRM_DELIVERY` | Legacy `POST confirm-delivery` (OFFLINE_DELIVERY) |
| `MERCHANT_MARK_PICKED_UP` | `POST mark-picked-up` (PICKUP handoff) |
| `CUSTOMER_CONFIRMED` | Customer `confirm-received` → `COMPLETED` |
| `ADMIN_RESOLVED` | Dispute resolution |

**Query params (add):**

| Param | Type | Notes |
|-------|------|-------|
| `limit` | number | Default 20 |
| `offset` | number | Default 0 |
| `fulfilmentMode` | `PICKUP` \| `OFFLINE_DELIVERY` | Optional filter |
| `fromDate` | ISO date | Optional |
| `toDate` | ISO date | Optional |

**`total`:** Must equal the count of all matching rows for the merchant (for pagination).

### Option B — New endpoint

If changing `GET /merchants/deliveries` is breaking, add:

```
GET /merchants/fulfilment-history
```

Same response as Option A. Deprecate old deliveries-only behaviour with a migration note.

### Option C — Minimum fix (pickup only)

On `POST /merchants/orders/:id/mark-picked-up`, also insert a row into the same store that backs `GET /merchants/deliveries` (with `fulfilmentMode: PICKUP`, `confirmedBy: MERCHANT`).

This fixes pickup gaps but still misses customer-completed orders and unpaginated lists.

---

## 6. Backend implementation notes

1. **Scope by merchant:** Only orders where `selectedMerchantId` = authenticated merchant profile id.
2. **Deduplicate:** One history row per order (latest completion event wins).
3. **PICKUP + confirm-delivery:** Continue rejecting `confirm-delivery` on PICKUP orders; history must come from `mark-picked-up` / `COMPLETED` instead.
4. **Embed `order`:** Include at least `reference`, `fulfilmentMode`, `status`, `totalAmount`, `currency`, `user.email` so FE does not need N+1 calls.
5. **Backfill:** One-time migration to populate history for existing `PICKED_UP` / `COMPLETED` merchant orders currently missing from confirmations.

---

## 7. Acceptance criteria

1. Merchant who fulfilled 5 pickup orders and 3 delivery orders sees **8 rows** on Delivery History (subject to pagination).
2. Pickup order after `mark-picked-up` appears in history **before** customer confirms.
3. Pickup order after customer `confirm-received` (`COMPLETED`) remains in history (updated status / `completionType`).
4. `total` matches the full filtered count; `limit`/`offset` return consistent pages.
5. OFFLINE_DELIVERY orders confirmed via `confirm-delivery` still appear (no regression).

---

## 8. FE follow-up after backend ships

1. Pass `limit` / `offset` and add pagination to `/merchant/deliveries`.
2. Display `fulfilmentMode`, `orderReference`, and `completionType` (not only "Delivered" badge).
3. Link each row to `/merchant/orders/:id`.
4. Update copy from *"confirmed as delivered"* to *"fulfilment history"* if pickup rows are included.
5. Extend merchant `OrderStatus` type with `PICKED_UP`, `COMPLETED` for Orders list filters.

---

## 9. References (current FE files)

| File | Role |
|------|------|
| `src/app/pages/merchant/merchant-deliveries/merchant-deliveries.component.ts` | Delivery History page |
| `src/app/pages/merchant/merchant-deliveries/merchant-deliveries.component.html` | Renders `confirmations[]` |
| `src/app/services/merchant.service.ts` | `fetchDeliveries()`, `DeliveryConfirmation`, `confirmDelivery()` |
| `src/app/pages/merchant/merchant-order-detail/merchant-order-detail.component.ts` | `markPickedUp()`, `confirmDelivery()` actions |
| `docs/MERCHANTS_API.md` | Current deliveries API contract |

---

## 10. Reproduction checklist (for QA)

1. As merchant, fulfil an **OFFLINE_DELIVERY** order via `confirm-delivery` → row appears on Delivery History.
2. As merchant, fulfil a **PICKUP** order via `mark-picked-up` (+ customer confirm) → **currently missing**; should appear after fix.
3. Create **> 20** fulfilled orders → verify whether list truncates without pagination (pagination bug).
4. Compare `GET /merchants/deliveries` `total` vs actual fulfilled order count in DB for the merchant.
