# Frontend Integration — Merchant-to-Merchant Stock Handover

**Feature:** Observation 2 — hierarchical stock pickup between merchants  
**Status:** Shipped (commission earnings stubbed)  
**Audience:** Merchant app + admin app  

Related:

- [merchant-flow-frontend.md](./merchant-flow-frontend.md) — onboarding / allocations overview
- [frontend-integration-merchant-stock-dispatch.md](./frontend-integration-merchant-stock-dispatch.md) — admin warehouse dispatch (still available)
- [frontend-integration-merchant-locations.md](./frontend-integration-merchant-locations.md) — location overlap used for eligibility  

---

## 1. Summary

Instead of waiting for **admin warehouse dispatch**, a receiving merchant with a **PENDING** onboarding/refill allocation may choose a **higher-tier** merchant in a shared coverage area and pick stock from them.

| Receiver | May request from |
|----------|------------------|
| REGIONAL | NATIONAL, GLOBAL |
| NATIONAL | GLOBAL |
| GLOBAL | *(not allowed)* |

**Approvals (both required):**

1. Receiver requests supplier  
2. **Supplier** approves  
3. **Admin** approves (company must always approve)  
4. Supplier marks ready → supplier inventory decremented  
5. Receiver confirms full receipt → receiver inventory credited  

Commission for this handover is **not paid yet** — awaiting client name + %. Do **not** reuse `MERCHANT_DELIVERY_BONUS` (that is for member/customer fulfilment only).

---

## 2. State machine

```text
PENDING + handover NONE
  → request → REQUESTED
  → supplier approve → SUPPLIER_APPROVED
  → admin approve → ADMIN_APPROVED
  → supplier mark-ready → READY_FOR_PICKUP  (stock leaves supplier)
  → receiver confirm → COMPLETED + allocation RECEIVED

Reject (supplier at REQUESTED, or admin before READY) → REJECTED
  (receiver may request again)
```

Warehouse `POST .../dispatch` is **blocked** while handover is `REQUESTED | SUPPLIER_APPROVED | ADMIN_APPROVED | READY_FOR_PICKUP`.

---

## 3. Receiver endpoints

Auth: Bearer + `MerchantGuard`.

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/merchants/me/allocations/:id/eligible-suppliers` | Higher-tier ACTIVE merchants sharing coverage with enough stock |
| `POST` | `/merchants/me/allocations/:id/handover-request` | Body `{ "supplierMerchantId": "uuid" }` |
| `POST` | `/merchants/me/allocations/:id/confirm-handover-receipt` | After `READY_FOR_PICKUP`; full qty only (v1) |

### Eligible suppliers response

```json
{
  "suppliers": [
    {
      "id": "uuid",
      "businessName": "National Hub",
      "type": "NATIONAL",
      "phoneNumber": "+234...",
      "address": "...",
      "serviceAreas": ["Lagos", "Abuja"],
      "stockQuantity": 50,
      "locations": []
    }
  ]
}
```

---

## 4. Supplier endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/merchants/me/handover-requests` | Inbound active requests |
| `POST` | `/merchants/me/handover-requests/:allocationId/approve` | From `REQUESTED` |
| `POST` | `/merchants/me/handover-requests/:allocationId/reject` | Body `{ "reason"?: string }` — `REQUESTED` only |
| `POST` | `/merchants/me/handover-requests/:allocationId/mark-ready` | After `ADMIN_APPROVED`; decrements supplier stock |

---

## 5. Admin endpoints

Auth: admin + RBAC. List uses `merchants.view`; approve/reject use `merchants.dispatch_stock`.

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/admin/merchants/handover-requests` | Query: `status`, `merchantId`, `limit`, `offset` |
| `POST` | `/admin/merchants/handover-requests/:allocationId/approve` | From `SUPPLIER_APPROVED` |
| `POST` | `/admin/merchants/handover-requests/:allocationId/reject` | Body `{ "reason"?: string }` — before `READY_FOR_PICKUP` |

---

## 6. Allocation payload (handover fields)

```json
{
  "id": "uuid",
  "merchantId": "receiver-uuid",
  "productId": "uuid",
  "productName": "Wine",
  "quantity": 10,
  "status": "PENDING",
  "handoverStatus": "ADMIN_APPROVED",
  "sourceMerchantId": "supplier-uuid",
  "sourceMerchant": {
    "id": "uuid",
    "businessName": "National Hub",
    "type": "NATIONAL",
    "phoneNumber": "...",
    "address": "..."
  },
  "receiverMerchant": { "...": "..." },
  "supplierApprovedAt": "...",
  "adminApprovedAt": "...",
  "handoverReadyAt": null,
  "handoverRejectedAt": null,
  "handoverRejectedBy": null,
  "handoverRejectReason": null
}
```

`handoverStatus` enum: `NONE | REQUESTED | SUPPLIER_APPROVED | ADMIN_APPROVED | READY_FOR_PICKUP | COMPLETED | REJECTED`.

---

## 7. UI checklist

- [x] On PENDING allocations, show “Pick from merchant” when eligible suppliers exist  
- [x] Supplier inbox for inbound handover requests + approve/reject/mark-ready  
- [ ] Admin queue for dual approval transparency *(admin app)*  
- [x] Disable warehouse-dispatch CTA when handover is active *(receiver shows handover status; warehouse confirm remains only for DELIVERED)*  
- [x] After ready, show supplier address (Observation 1 locations) for pickup  
- [x] Do not display a handover delivery commission until backend ships earnings  

---

## 8. Earnings stub (future)

When the client provides the commission **name** and **%**:

1. Add field on `MerchantCategoryConfig` (or dedicated config)  
2. Add `LedgerEarningType` (do not overload `MERCHANT_DELIVERY_BONUS`)  
3. Credit **supplying** merchant on `COMPLETED` in `confirmHandoverReceipt` (see TODO in service)

Until then, handover completes inventory only.
