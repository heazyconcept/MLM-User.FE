# Backend Request — Allow Cancelling Paid Orders Before Fulfilment



**Date:** 2026-08-19  

**From:** User FE (`mlm-user.fe`)  

**Status:** Backend shipped — FE integrated (2026-08-20)  

**Severity:** High  

**Area:** Orders, checkout, wallet refunds, merchant stock  



**Related docs:**



- [frontend-integration-customer-checkout-pickup.md](./frontend-integration-customer-checkout-pickup.md) — checkout batch + wallet pay-at-checkout flow

- [project/API.md](./project/API.md) — `POST /orders/:id/cancel`

- [pages-doc/11-orders-fulfilment.md](./pages-doc/11-orders-fulfilment.md) — order actions UI



**Related frontend:**



- Checkout: `cart-checkout.service.ts` — `checkoutBatch` then `payCheckoutWithWallet` (order is **paid on placement**)

- Order detail cancel: `order-detail.component.ts` → `POST /orders/:id/cancel`

- Cancel eligibility (UI): `OrderService.canCancelOrder()` — pre-fulfilment, not completed/picked up



---



## 1. Summary



The customer app exposes **Cancel Order** on the order detail page for orders that are placed but not yet fulfilled (Processing, Ready for Pickup, Out for Delivery, etc.).



**Backend shipped:** `POST /orders/:id/cancel` now allows cancellation for **paid pre-fulfilment** orders (not only unpaid). Refunds go to the **Product Voucher** wallet; CPV/earnings are reversed and merchant/warehouse stock is restored where applicable.



---



## 2. Shipped backend behaviour



| Step | Behaviour |

|------|-----------|

| User confirms fulfilment | `POST /orders/checkout` creates order(s) |

| Payment | `POST /orders/checkout/:id/pay-wallet` runs immediately |

| User opens order detail | Order is **paid** |

| User taps **Cancel Order** | `200`, order → `CANCELLED` |

| Wallet | Refund to **Product Voucher** wallet |

| Pickup stock | Merchant / warehouse stock restored |

| Commissions | CPV and earnings allocations reversed |



---



## 3. API — `POST /orders/:id/cancel`



**Allowed when (customer-owned order):**



1. Not `CANCELLED`, `COMPLETED`, or `DELIVERED`.

2. Not `PICKED_UP` (use dispute or confirm-received after handoff).

3. No open dispute.

4. Pre-fulfilment status, e.g. `PENDING`, `CREATED`, `PAID`, `PROCESSING`, `ASSIGNED_TO_MERCHANT`, `READY_FOR_PICKUP`, delivery-in-progress statuses.



**On success:**



1. Order status → `CANCELLED`.

2. Refund to Product Voucher wallet.

3. Reverse CPV / earnings allocations.

4. Restore stock (pickup / warehouse as applicable).

5. Emit `ORDER_CANCELLED` notification.



**Typical rejections:**



- After pickup handoff (`PICKED_UP` or later)

- Already cancelled

- Open dispute



---



## 4. Eligibility matrix



| Status | Cancel allowed? | Notes |

|--------|-----------------|-------|

| `PENDING`, `CREATED` | Yes | Unpaid edge cases |

| `PAID`, `PROCESSING`, `ASSIGNED_TO_MERCHANT`, `READY_FOR_PICKUP` | Yes | Main case after wallet checkout |

| `OFFLINE_DELIVERY_REQUESTED`, `OUT_FOR_DELIVERY`, … | Yes | Pre-delivery |

| `PICKED_UP` | No | Dispute or confirm-received |

| `COMPLETED`, `DELIVERED`, `CANCELLED` | No | Terminal |



---



## 5. Frontend integration



- Calls `POST /orders/:id/cancel` from order detail with confirmation dialog.

- Success toast: refund to Product Voucher wallet.

- `OrderService.canCancelOrder()` mirrors pre-fulfilment rules; terminal / picked-up / disputed orders hide the button.



---



## 6. Acceptance criteria



- [x] Paid order in `PAID` / `PROCESSING` / `READY_FOR_PICKUP` can be cancelled by the customer.

- [x] Wallet refund to Product Voucher wallet.

- [x] Pickup / warehouse stock restored on cancel.

- [x] `PICKED_UP` and later orders reject cancel.

- [x] `ORDER_CANCELLED` notification sent.

- [x] Integration docs updated.


