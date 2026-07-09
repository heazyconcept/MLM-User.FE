# Backend Request — Merchant Inventory Adjustment Disputes

**Date:** 2026-07-09  
**From:** User FE (`mlm-user.fe`)  
**Related:** [frontend-integration-admin-product-stock.md](./frontend-integration-admin-product-stock.md), [frontend-integration-merchant-stock-dispatch.md](./frontend-integration-merchant-stock-dispatch.md), [MERCHANTS_API.md](./MERCHANTS_API.md)  
**Status:** Request for backend implementation  
**Priority:** High — fraud prevention for merchant manual stock edits

---

## 1. Problem

Today merchants can edit inventory quantity directly via:

`PUT /merchants/inventory/:productId/stock`

The backend applies the change **immediately** and logs `MANUAL_MERCHANT_ADJUST` in the stock movement ledger. There is:

- No **admin-recognized quantity** exposed to the merchant
- No **mandatory reason** for quantity changes
- No **dispute / approval workflow** when the merchant reports a quantity different from the system
- No **Product Disputes** list under Inventory (only allocation **receipt** disputes exist under Allocations)

**Business requirement:** Any inventory quantity edit that differs from what Admin recognizes must:

1. Create a **Product Dispute** (inventory adjustment dispute)
2. Require the merchant to state **why** (increase or decrease)
3. **Not** change sellable/recognized stock until admin resolves (approve/reject)

FE will implement against this contract. Until shipped, adjustment requests will return `404`/`501` and merchants can still use status-only updates where applicable.

---

## 2. Definitions

| Term | Meaning |
|------|---------|
| **Authorized quantity** | System-calculated stock the platform recognizes for this merchant + product (ledger-derived). Source of truth for fraud checks. |
| **Reported quantity** | `stockQuantity` on `MerchantProduct` — what the merchant (and checkout) currently see. |
| **Requested quantity** | Value merchant submits in an adjustment request. |
| **Allocation receipt dispute** | Existing flow when `quantityReceived < dispatched` on confirm-receipt. **Out of scope here** — keep separate. |
| **Inventory adjustment dispute** | New flow when merchant requests `requestedQuantity !== authorizedQuantity`. |

### Suggested formula for `authorizedQuantity`

Per merchant + product:

```
authorizedQuantity =
  SUM(credited allocations after RECEIVED)
  − SUM(ORDER_PICKUP + ORDER_MERCHANT_ASSIGN movements)
  ± resolved inventory adjustment disputes (approved deltas only)
```

Expose this on `GET /merchants/inventory` so FE can show “Admin recognized” vs “Your reported stock”.

---

## 3. Requested API changes

### 3.1 Extend `GET /merchants/inventory`

Add fields per item:

```json
{
  "items": [
    {
      "merchantProductId": "uuid",
      "productId": "uuid",
      "productName": "Red Wine",
      "productSku": "RW-001",
      "stockQuantity": 12,
      "authorizedQuantity": 10,
      "stockStatus": "IN_STOCK",
      "isActive": true,
      "hasOpenAdjustmentDispute": true,
      "pendingRequestedQuantity": 12
    }
  ]
}
```

| Field | Type | Description |
|-------|------|-------------|
| `authorizedQuantity` | number | Admin/system recognized qty (≥ 0) |
| `hasOpenAdjustmentDispute` | boolean | `true` if an `OPEN` adjustment exists for this product |
| `pendingRequestedQuantity` | number \| null | Requested qty on open dispute, if any |

**Backward compatibility:** If fields are omitted, FE falls back to `authorizedQuantity = stockQuantity`.

---

### 3.2 New — Submit inventory adjustment request

**`POST /merchants/inventory/:productId/adjustment-requests`**

**Auth:** Bearer + active merchant. Product must be in merchant inventory.

**Body:**

```json
{
  "requestedQuantity": 12,
  "adjustmentType": "INCREASE",
  "reason": "Physical count found 2 extra units in store after delivery."
}
```

| Field | Type | Required | Rules |
|-------|------|----------|-------|
| `requestedQuantity` | integer | Yes | ≥ 0 |
| `adjustmentType` | enum | Yes | `INCREASE` \| `DECREASE` — must match sign of `requestedQuantity - authorizedQuantity` |
| `reason` | string | Yes | Trimmed, min **10** chars, max **500** |

**Server rules:**

1. Load `authorizedQuantity` for merchant + product.
2. If `requestedQuantity === authorizedQuantity` → **400** `No adjustment needed; quantities match.`
3. If open adjustment dispute already exists for this product → **409** `An open adjustment dispute already exists for this product.`
4. Create dispute with status `OPEN`; **do not** update `stockQuantity` until admin approves.
5. Notify admins (`ADMIN_INVENTORY_ADJUSTMENT_DISPUTE_OPENED`).
6. Record movement only after approval (not on request).

**Response (201):**

```json
{
  "id": "dispute-uuid",
  "productId": "uuid",
  "productName": "Red Wine",
  "authorizedQuantity": 10,
  "requestedQuantity": 12,
  "adjustmentType": "INCREASE",
  "reason": "Physical count found 2 extra units in store after delivery.",
  "status": "OPEN",
  "createdAt": "2026-07-09T12:00:00.000Z"
}
```

---

### 3.3 New — List merchant inventory adjustment disputes

**`GET /merchants/me/inventory-adjustment-disputes`**

**Query (optional):** `status` (`OPEN` \| `ADMIN_APPROVED` \| `ADMIN_REJECTED` \| `CLOSED`), `limit`, `offset`

**Response (200):**

```json
{
  "disputes": [
    {
      "id": "uuid",
      "productId": "uuid",
      "productName": "Red Wine",
      "productSku": "RW-001",
      "authorizedQuantity": 10,
      "requestedQuantity": 12,
      "adjustmentType": "INCREASE",
      "reason": "Physical count found 2 extra units.",
      "status": "OPEN",
      "adminNotes": null,
      "createdAt": "2026-07-09T12:00:00.000Z",
      "resolvedAt": null
    }
  ],
  "total": 1
}
```

**Dispute statuses:**

| Status | Meaning |
|--------|---------|
| `OPEN` | Awaiting admin review |
| `ADMIN_APPROVED` | Admin approved; `stockQuantity` updated to `requestedQuantity` |
| `ADMIN_REJECTED` | Admin rejected; `stockQuantity` unchanged |
| `CLOSED` | Terminal state after resolution |

---

### 3.4 Restrict direct quantity updates

**`PUT /merchants/inventory/:productId/stock`**

Keep for **status-only** corrections and syncing quantity **to** `authorizedQuantity` without dispute.

**Proposed rules:**

| Request body | Allowed? |
|--------------|----------|
| `{ "stockStatus": "LOW_STOCK" }` only | Yes |
| `{ "stockQuantity": N }` where `N === authorizedQuantity` | Yes (correction sync) |
| `{ "stockQuantity": N }` where `N !== authorizedQuantity` | **400** — use adjustment request |
| Open adjustment dispute on product | **409** — block all stock updates until resolved |

**Error example (400):**

```json
{
  "statusCode": 400,
  "message": "Quantity differs from authorized stock. Submit an adjustment request with a reason.",
  "error": "INVENTORY_ADJUSTMENT_REQUIRED"
}
```

---

### 3.5 Admin endpoints (admin app)

Base: `/admin/merchants` — admin role + RBAC.

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/inventory-adjustment-disputes` | List all (filter `status`, `merchantId`, `productId`) |
| `GET` | `/inventory-adjustment-disputes/:id` | Detail |
| `POST` | `/inventory-adjustment-disputes/:id/approve` | Apply qty; log `MANUAL_MERCHANT_ADJUST`; notify merchant |
| `POST` | `/inventory-adjustment-disputes/:id/reject` | Reject with `adminNotes`; notify merchant |

**Approve body (optional):**

```json
{
  "adminNotes": "Verified with warehouse records."
}
```

**Reject body:**

```json
{
  "adminNotes": "No evidence of extra stock. Count matches dispatch ledger."
}
```

---

## 4. Notifications

| Type | Recipient | When |
|------|-----------|------|
| `MERCHANT_INVENTORY_ADJUSTMENT_SUBMITTED` | Merchant | Adjustment request created |
| `ADMIN_INVENTORY_ADJUSTMENT_DISPUTE_OPENED` | Admins | New dispute |
| `MERCHANT_INVENTORY_ADJUSTMENT_APPROVED` | Merchant | Admin approved |
| `MERCHANT_INVENTORY_ADJUSTMENT_REJECTED` | Merchant | Admin rejected |

Deep link metadata: `productId`, `disputeId`, `merchantId`.

---

## 5. Stock movement ledger

On **admin approve** only:

```json
{
  "type": "MANUAL_MERCHANT_ADJUST",
  "quantity": 2,
  "metadata": {
    "previousQuantity": 10,
    "newQuantity": 12,
    "authorizedQuantity": 10,
    "adjustmentDisputeId": "uuid",
    "adjustmentType": "INCREASE",
    "reason": "..."
  }
}
```

---

## 6. Frontend integration (implemented in `mlm-user.fe`)

| Area | Behaviour |
|------|-----------|
| Inventory list | Shows authorized qty, reported qty, open-dispute badge |
| Edit modal | If `requested !== authorized` → reason + type required → `POST .../adjustment-requests` |
| Edit modal | Status-only or sync-to-authorized → `PUT .../stock` |
| Product Disputes tab | Lists `GET /merchants/me/inventory-adjustment-disputes` |
| Block edit | When `hasOpenAdjustmentDispute` on product |

---

## 7. Acceptance criteria

- [ ] `GET /merchants/inventory` returns `authorizedQuantity` per item
- [ ] `POST .../adjustment-requests` creates dispute; does **not** change `stockQuantity`
- [ ] `PUT .../stock` rejects quantity changes that differ from `authorizedQuantity`
- [ ] `GET /merchants/me/inventory-adjustment-disputes` lists merchant disputes
- [ ] Admin approve/reject updates dispute status and stock only on approve
- [ ] Reason min length enforced server-side
- [ ] Cannot open second `OPEN` dispute for same product
- [ ] Notifications sent per table above

---

## 8. Distinction from allocation receipt disputes

| | Allocation receipt dispute | Inventory adjustment dispute |
|--|---------------------------|------------------------------|
| Trigger | Short receipt on `confirm-receipt` | Manual qty edit ≠ authorized |
| Endpoint prefix | `/merchants/me/stock-disputes` | `/merchants/me/inventory-adjustment-disputes` |
| UI location | Allocations page | Inventory → Product Disputes tab |
| Evidence | Required when short qty | Reason required; evidence optional future |

Do **not** merge into one table without a `disputeKind` discriminator.

---

## 9. Example flows

### Increase (fraud-sensitive)

1. Authorized = 10, merchant reports 12.
2. Merchant submits adjustment with `INCREASE` + reason.
3. Dispute `OPEN` → appears in Product Disputes.
4. Admin approves → `stockQuantity` = 12, movement logged.

### Decrease

1. Authorized = 10, merchant reports 7 (damage/theft).
2. Merchant submits `DECREASE` + reason.
3. Admin approves → `stockQuantity` = 7.

### Status-only (no dispute)

1. Authorized = 10, reported = 10, merchant sets `LOW_STOCK`.
2. `PUT` with `{ "stockStatus": "LOW_STOCK" }` only — succeeds.

---

## 10. Changelog

| Date | Change |
|------|--------|
| 2026-07-09 | Initial request from User FE for inventory adjustment dispute workflow |
