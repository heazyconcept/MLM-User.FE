# Backend Request — Merchant Inventory Movement Log

**Date:** 2026-10-07  
**From:** User FE (`mlm-user.fe`)  
**To:** HerbApi / merchant inventory  
**Status:** Open — merchant Movement Log tab wired; awaiting API  
**Priority:** High  
**Area:** `GET /merchants/inventory/movements`  
**Admin screen:** Merchant Center → Inventory → Movement Log

**Related docs:**

- [backend-request-inventory-adjustment-disputes.md](./backend-request-inventory-adjustment-disputes.md) — §5 stock movement ledger
- [frontend-integration-merchant-stock-dispatch.md](./frontend-integration-merchant-stock-dispatch.md)
- [frontend-integration-merchant-stock-handover.md](./frontend-integration-merchant-stock-handover.md)
- [frontend-integration-merchant-stock-request.md](./frontend-integration-merchant-stock-request.md)
- [MERCHANTS_API.md](./MERCHANTS_API.md)

---

## 1. Summary

Merchants need a **unified stock movement ledger** — a chronological audit of every unit in and out of their inventory, with enough detail to reconcile counts, trace orders, and review restocks.

Today, stock changes are scattered across allocations, handovers, top-ups, orders, deliveries, and adjustment disputes. The platform already conceptually maintains a movement ledger (`MANUAL_MERCHANT_ADJUST`, `ORDER_PICKUP`, allocation credits) but **no merchant GET endpoint** exposes it.

User FE implements **Movement Log** (Inventory tab + dashboard preview) against the contract below.

---

## 2. Primary endpoint

```http
GET /merchants/inventory/movements
Authorization: Bearer <merchant_token>
```

### Query parameters

| Param | Type | Description |
|-------|------|-------------|
| `productId` | uuid | Filter to one product |
| `movementType` | string | Single type or comma-separated list |
| `direction` | `IN` \| `OUT` \| `NONE` | Movement direction |
| `referenceType` | string | e.g. `ORDER`, `ALLOCATION`, `HANDOVER` |
| `from` | ISO datetime | Range start (inclusive) |
| `to` | ISO datetime | Range end (inclusive) |
| `search` | string | Match reference label, order ref, SKU, description |
| `limit` | number | Default 50, max 100 |
| `offset` | number | Pagination offset |

### Response (200)

```json
{
  "items": [
    {
      "id": "mov-uuid",
      "occurredAt": "2026-10-07T09:15:00.000Z",
      "productId": "prod-uuid",
      "productName": "Red Wine",
      "productSku": "RW-001",
      "movementType": "ORDER_DELIVERY_CONFIRMED",
      "direction": "OUT",
      "quantityDelta": -2,
      "balanceAfter": 48,
      "referenceType": "ORDER",
      "referenceId": "order-uuid",
      "referenceLabel": "ORD-2026-1042",
      "orderedBy": "@member_username",
      "actor": "SYSTEM",
      "description": "2 units delivered for order ORD-2026-1042",
      "metadata": {
        "fulfilmentMethod": "DELIVERY",
        "lineItems": [{ "productId": "prod-uuid", "quantity": 2 }]
      }
    }
  ],
  "total": 142
}
```

### Errors

| Status | When |
|--------|------|
| 404 / 501 | Endpoint not yet deployed (FE shows graceful empty state) |
| 403 | Non-merchant or inactive merchant |

---

## 3. Movement types

### Stock in (`direction: IN`, positive `quantityDelta`)

| Type | When to write |
|------|----------------|
| `ALLOCATION_RECEIVED` | Merchant confirms allocation receipt |
| `HANDOVER_RECEIVED` | Inbound M2M handover completed |
| `RESTOCK_APPROVED` | Admin fulfils merchant stock request |
| `ADJUSTMENT_APPROVED_INCREASE` | Admin approves inventory adjustment dispute (increase) |

### Stock out (`direction: OUT`, negative `quantityDelta`)

| Type | When to write |
|------|----------------|
| `ORDER_ASSIGNED` | Order assigned to merchant (if platform reserves stock at assignment) |
| `ORDER_PICKUP_CONFIRMED` | Pickup fulfilment confirmed |
| `ORDER_DELIVERY_CONFIRMED` | Delivery fulfilment confirmed |
| `ADJUSTMENT_APPROVED_DECREASE` | Admin approves adjustment dispute (decrease) |

### Pending / audit (`direction: NONE`, `quantityDelta: 0`)

| Type | When to write |
|------|----------------|
| `RESTOCK_REQUESTED` | Merchant submits top-up request |
| `ADJUSTMENT_SUBMITTED` | Merchant submits adjustment dispute |
| `ALLOCATION_DISPUTED` | Short-receipt dispute opened |
| `HANDOVER_PENDING` | Inbound handover awaiting merchant action |
| `HANDOVER_REJECTED` | Merchant rejects handover |

### Ledger formula alignment

Per merchant + product, `balanceAfter` on the latest row must match `authorizedQuantity` on `GET /merchants/inventory`:

```
authorizedQuantity =
  SUM(allocation credits after RECEIVED)
  − SUM(ORDER_PICKUP + ORDER_MERCHANT_ASSIGN movements)
  ± approved adjustment deltas
```

Document clearly whether `ORDER_ASSIGNED` and fulfilment events both deduct, or only fulfilment — merchants must not see double deductions.

---

## 4. Optional summary endpoint

```http
GET /merchants/inventory/:productId/movement-summary
```

```json
{
  "productId": "prod-uuid",
  "totalAllocated": 250,
  "totalFulfilled": 202,
  "currentBalance": 48,
  "lastMovementAt": "2026-10-07T09:15:00.000Z"
}
```

---

## 5. Dashboard extension (optional)

Extend `GET /merchants/dashboard/summary` with:

```json
{
  "recentMovements": [ /* same item shape as movements endpoint, max 5 */ ]
}
```

If omitted, FE calls `GET /merchants/inventory/movements?limit=5` on dashboard load.

---

## 6. Write rules

1. **One row per stock-changing action** — idempotent on retry (use unique constraint on source event id).
2. **Reference IDs** must match entities merchants can navigate to (order, allocation, handover, dispute, stock-request).
3. **Merchant scope** — merchants see only their own movements.
4. **Immutable** — no edits or deletes; corrections via reversing entries.
5. **Metadata** — include fulfilment method, line qty breakdown, dispute reason, allocation dispatched vs received, handover sender where applicable.

---

## 7. Acceptance criteria

- [ ] Every allocation receipt, handover completion, restock approval, order fulfilment, and approved adjustment creates a ledger row.
- [ ] `balanceAfter` on latest row matches `authorizedQuantity` for same product on inventory list.
- [ ] Filters (`productId`, `movementType`, `direction`, date range, search) work correctly.
- [ ] Pagination is stable (`total` accurate).
- [ ] Merchant cannot see other merchants' movements.
- [ ] Pending events appear with `direction: NONE` and `quantityDelta: 0`.

---

## 8. Frontend references

**Frontend integration (UI, routes, tests):** [frontend-integration-merchant-inventory-movements.md](./frontend-integration-merchant-inventory-movements.md)

**Code:**

- Service: `src/app/services/merchant.service.ts` → `loadInventoryMovements()`
- Inventory UI: `src/app/pages/merchant/merchant-inventory/`
- Dashboard preview: `src/app/pages/merchant/merchant-dashboard/`
