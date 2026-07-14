# Backend Request — Receiver Allocation Missing Stock Handover State

**Date:** 2026-07-14  
**From:** User FE (`mlm-user.fe`)  
**Status:** Blocked by incomplete backend response  
**Severity:** High  
**Area:** Merchant-to-merchant stock handover

**Related:**

- [frontend-integration-merchant-stock-handover.md](./frontend-integration-merchant-stock-handover.md)
- [frontend-integration-merchant-locations.md](./frontend-integration-merchant-locations.md)

---

## Summary

The supplier and admin workflow reaches `READY_FOR_PICKUP`, but the receiving merchant's
`GET /merchants/me/allocations` response omits all handover fields.

The receiver frontend therefore cannot:

- know that a handover is already active;
- stop offering **Pick from merchant** again;
- show the supplier's pickup address and phone number;
- show **Confirm handover** at `READY_FOR_PICKUP`.

This is not an admin UI request. The required change is limited to the merchant/user API response.

---

## Reproduction evidence

Allocation:

```text
699dc923-f35a-4666-b217-25677b24bc38
```

Receiver:

```text
a3c4216f-e3ad-4b2a-8024-28990009c4d1 (Lumi Ventures, REGIONAL)
```

Supplier:

```text
4647a085-5b6c-45db-a8c5-1b2eccf558c9
```

### Supplier-side response

`GET /merchants/me/handover-requests` correctly reports:

```json
{
  "id": "699dc923-f35a-4666-b217-25677b24bc38",
  "status": "PENDING",
  "handoverStatus": "READY_FOR_PICKUP",
  "sourceMerchantId": "4647a085-5b6c-45db-a8c5-1b2eccf558c9",
  "supplierApprovedAt": "2026-07-14T13:12:12.423Z",
  "adminApprovedAt": "2026-07-14T13:12:24.367Z",
  "handoverReadyAt": "2026-07-14T13:12:55.523Z"
}
```

### Receiver-side response

For the same allocation, `GET /merchants/me/allocations` returns only:

```json
{
  "id": "699dc923-f35a-4666-b217-25677b24bc38",
  "merchantId": "a3c4216f-e3ad-4b2a-8024-28990009c4d1",
  "productId": "359e95be-1c5b-46c3-a568-af136074ed3b",
  "productName": "Segulah Herbal Tea (INFECTION KILLER)",
  "quantity": 10,
  "status": "PENDING",
  "quantityReceived": null,
  "dispatchedAt": null,
  "inTransitAt": null,
  "deliveredAt": null,
  "receivedAt": null,
  "trackingReference": null,
  "parentAllocationId": null,
  "dispute": null,
  "createdAt": "2026-07-09T11:19:57.420Z"
}
```

All handover state is missing despite the handover already being ready.

---

## Requested backend change

Extend every allocation returned by:

```http
GET /merchants/me/allocations
```

with the current handover relation and supplier details:

```json
{
  "id": "699dc923-f35a-4666-b217-25677b24bc38",
  "status": "PENDING",
  "handoverStatus": "READY_FOR_PICKUP",
  "sourceMerchantId": "4647a085-5b6c-45db-a8c5-1b2eccf558c9",
  "sourceMerchant": {
    "id": "4647a085-5b6c-45db-a8c5-1b2eccf558c9",
    "businessName": "Supplier business name",
    "type": "NATIONAL",
    "phoneNumber": "Supplier pickup phone",
    "address": "Supplier pickup address",
    "locations": []
  },
  "supplierApprovedAt": "2026-07-14T13:12:12.423Z",
  "adminApprovedAt": "2026-07-14T13:12:24.367Z",
  "handoverReadyAt": "2026-07-14T13:12:55.523Z",
  "handoverRejectedAt": null,
  "handoverRejectedBy": null,
  "handoverRejectReason": null
}
```

### Required behavior

1. Join the current handover relation by allocation ID.
2. Return `handoverStatus: "NONE"` only when no handover exists.
3. Return the real status for active and completed handovers:
   `REQUESTED | SUPPLIER_APPROVED | ADMIN_APPROVED | READY_FOR_PICKUP | COMPLETED | REJECTED`.
4. Include `sourceMerchant` for the receiver, especially at `READY_FOR_PICKUP`.
5. Resolve pickup contact from the supplier's matching/primary location where applicable; do not
   expose the receiver as `sourceMerchant`.
6. Keep the response current after supplier/admin actions without requiring the receiver to submit a
   duplicate handover request.

---

## Why the frontend cannot safely work around this

The receiver is not authorized to infer state from the supplier inbox or admin queue. Allocation
`status: "PENDING"` alone is ambiguous: it can mean warehouse dispatch is pending, a handover is
awaiting approval, or stock is ready for pickup.

The frontend must not fabricate `READY_FOR_PICKUP` or supplier contact details. The receiver's
allocation endpoint must be the source of truth.

---

## Backend acceptance tests

1. Create a PENDING allocation and request a supplier.
2. Assert receiver `GET /merchants/me/allocations` returns `handoverStatus: "REQUESTED"`.
3. Supplier approves; assert receiver response returns `SUPPLIER_APPROVED`.
4. Admin approves; assert receiver response returns `ADMIN_APPROVED`.
5. Supplier marks ready; assert receiver response returns:
   - `handoverStatus: "READY_FOR_PICKUP"`;
   - populated `sourceMerchantId`;
   - populated `sourceMerchant.address` and `sourceMerchant.phoneNumber`;
   - populated `handoverReadyAt`.
6. Receiver confirms receipt; assert response returns `COMPLETED` and allocation becomes `RECEIVED`.
7. Reject a request; assert receiver response returns `REJECTED` and the rejection metadata.

---

## Frontend readiness

The user frontend already supports the flattened fields above (and nested `handover` payloads for
compatibility). Once this endpoint ships, it will automatically:

- hide **Pick from merchant** while the handover is active;
- show the current handover stage;
- show pickup contact details at `READY_FOR_PICKUP`;
- show **Confirm handover** to the receiver.
