# Frontend Handover — Show Which Marketplace Each Order Came From

**Date:** 2026-10-03  
**From:** HerbApi  
**To:** Member app (`mlm-user.fe`), Admin app, Merchant screens  
**Status:** Backend shipped — frontend needs to show the new fields  
**Priority:** High (support disputes)

---

## 1. Why

Support could not prove to a member which purchases were paid from her **Legacy product voucher** and which from her **network Product Voucher**. She believed money was missing. Every order needs a visible **Source** so staff and members can see where each purchase came from.

Every order now comes back with the marketplace it was placed in and the wallet that pays for it.

---

## 2. New fields on every order

Returned by:

| Endpoint | Who |
|----------|-----|
| `GET /orders`, `GET /orders/:id` | Member (Network orders and Legacy orders) |
| `GET /admin/orders`, `GET /admin/orders/:id` | Admin |
| `GET /merchants/orders`, `GET /merchants/orders/:id` | Merchant |
| `GET /merchants/...` fulfilment history (each entry, and its nested `order`) | Merchant |

| Field | Type | Values / example |
|-------|------|------------------|
| `channel` | enum | `NETWORK` or `LEGACY` |
| `sourceLabel` | string | `"Network Marketplace"` or `"Legacy Marketplace"` — show as-is |
| `paidFromWalletType` | enum or `null` | `VOUCHER`, `LEGACY_VOUCHER`, or `null` for online (gateway) payments |
| `paidFromLabel` | string | `"Product Voucher"`, `"Legacy product voucher"`, or `"Online payment"` |

Example:

```json
{
  "id": "…",
  "reference": "ORD-REF-7KQ2…",
  "status": "PAID",
  "totalAmount": 58000,
  "currency": "NGN",
  "paymentMethod": "WALLET",
  "channel": "LEGACY",
  "sourceLabel": "Legacy Marketplace",
  "paidFromWalletType": "LEGACY_VOUCHER",
  "paidFromLabel": "Legacy product voucher",
  "items": [ … ]
}
```

Rules enforced by the backend (so the label is always accurate):

- A `LEGACY` order can only be paid from the Legacy product voucher.
- A `NETWORK` member order can only be paid from the Product Voucher.
- One order never mixes the two marketplaces.

---

## 3. New filter

All three order lists accept an optional `channel` query param:

```
GET /orders?channel=LEGACY
GET /admin/orders?channel=NETWORK&userId=<uuid>
GET /merchants/orders?channel=LEGACY
```

Omit it to get both.

---

## 4. What to change in the UI

| Screen | Change |
|--------|--------|
| Member — Network orders list + detail | Add a **Source** column/badge from `sourceLabel`, and **Paid from** from `paidFromLabel`. |
| Member — Legacy orders list + detail | Same. If this screen lists all orders today, pass `?channel=LEGACY`. |
| Admin — Orders list + order detail | Add **Source** and **Paid from** columns; add a Source filter (All / Network Marketplace / Legacy Marketplace) wired to `channel`. |
| Admin — User detail → Orders | Same columns; this is where support resolves disputes. |
| Merchant — Assigned orders + order detail + fulfilment history | Add a **Source** badge. |

Suggested badge styling: distinct colours for Network vs Legacy so they are obvious at a glance.

---

## 5. Wallet statements now name the marketplace and order

These descriptions changed on the Legacy voucher statement (`GET /legacy/voucher`), the Legacy cashout statement, the wallet activity log and dashboard recent transactions. No frontend change needed; they display as returned.

| Before | After |
|--------|-------|
| `DEBIT PRODUCT_PURCHASE · LEGACY_VOUCHER` / `Product purchase (order 1a2b3c4d…)` | `Legacy Marketplace purchase — ORD-REF-…` or `Network Marketplace purchase — ORD-REF-…` |
| `Order cancellation refund` | `Legacy Marketplace order cancellation refund — ORD-REF-…` (or Network) |
| `CREDIT LEGACY_JOIN · LEGACY_VOUCHER` | `Legacy membership voucher credit` |
| `DEBIT LEGACY_JOIN · REGISTRATION` | `Legacy membership payment` |

The `ORD-REF-…` in a statement line equals the order's `reference`, so support can match a wallet debit to the exact order.

---

## 6. Acceptance checklist

- [ ] Every order row (member, admin, merchant) shows **Source** and **Paid from**.
- [ ] Admin can filter orders by Source and by user together.
- [ ] Opening a Legacy voucher statement line's `ORD-REF-…` finds the same order in the orders list.
- [ ] Guest (non-member) orders show **Paid from: Online payment**.
