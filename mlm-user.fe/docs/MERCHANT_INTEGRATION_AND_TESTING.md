# Merchant integration order and step-by-step testing

This guide is for a developer building **both** frontend and backend (or integrating a frontend against the existing API). It recommends **which integrations to do first** and provides a **step-by-step testing checklist** so you can follow the exact documented flow and verify it works end-to-end.

**Related docs:** [merchant-flow-frontend.md](api/merchant-flow-frontend.md), [merchant-category-config.md](api/merchant-category-config.md), [MERCHANTS_API.md](api/MERCHANTS_API.md), [ADMIN_MERCHANTS_API.md](api/ADMIN_MERCHANTS_API.md).

---

## 1. Which to integrate first: admin or user?

**Recommendation: do admin-side setup first, then user-side flow, then admin actions, then merchant-only features.**

### Why this order

| Order | Side | What you do | Why first |
|-------|------|-------------|-----------|
| **1** | **Admin** | Category config, categories, products (with prices), optional: create one test merchant via approve | Without **merchant category config**, the user application flow has no fee or onboarding list to show. Without **products**, you cannot set `onboardingItems`. So admin setup unblocks the user flow. |
| **2** | **User** | Category config (read), apply, pay merchant fee, “my merchant” profile | User can see fees and “You will receive …”, submit application, and pay. This is the main conversion path. |
| **3** | **Admin** | List pending merchants, approve or reject | Admin must be able to approve so the merchant can move to ACTIVE and see allocations. |
| **4** | **Merchant (user)** | Allocations list, accept allocation, inventory, orders, deliveries | Only possible after approval; validates the full onboarding and stock flow. |
| **5** | **Admin + merchant** | Refill, assign merchant to OFFLINE_DELIVERY order | Optional; refill and order assignment depend on ACTIVE merchants and stock. |

So: **integrate admin setup first**, then user apply/pay, then admin approve/reject, then merchant allocations and inventory. Test in that order so each step has the data it needs.

---

## 2. Prerequisites for testing

Before following the steps below, ensure:

- [ ] **Backend** is running (e.g. `npm run start:dev`), DB migrated and (if needed) seeded.
- [ ] You have at least **one admin user** (role `ADMIN`) and can get a JWT for it (e.g. login endpoint).
- [ ] You have at least **one normal user** with **registration paid** (`isRegistrationPaid: true`) and a JWT. This user will apply as merchant and (optionally) pay the merchant fee.
- [ ] **Products** exist and at least one is **ACTIVE** with an active price (so you can add it to `onboardingItems` in category config).
- [ ] Tool to call APIs: **Swagger** (`/api/docs`), **Postman**, or your frontend app.

---

## 3. Step-by-step testing checklist

Use these checklists to test the **exact flow** described in the merchant docs. They are split into **admin-side** and **user/merchant-side** steps so you can focus on one role at a time.

---

## 3.1 Admin-side integration & testing

These steps are done with an **admin JWT**. They create and manage the configuration and merchant records that the user/merchant flows depend on.

### A. Admin setup (do this first)

These steps create the config and data the user flow needs (category config + products).

| Step | Action | How to verify |
|------|--------|----------------|
| 1.1 | **Get category config (admin)** — `GET /admin/merchant-category-config` with admin Bearer token. | Response: array of configs (one per merchant type: REGIONAL, NATIONAL, GLOBAL). Note current `onboardingItems` / `onboardingProductId` + `onboardingQuantity` per type. |
| 1.2 | **Update category config for one type** — e.g. `PUT /admin/merchant-category-config/REGIONAL` with body: `deliveryCommissionPct`, `productCommissionPct`, `registrationFeeUsd`, and `onboardingItems: [{ "productId": "<active-product-uuid>", "quantity": 10 }]`. | Response: `200`, `{ "message": "Merchant category config updated" }`. Then `GET /admin/merchant-category-config` again: REGIONAL shows the new fee and onboarding items. |
| 1.3 | **(Optional)** Ensure you have at least one **ACTIVE product** with an active price. Use `GET /admin/products` and/or `POST /admin/products/:id/price` if needed. | Products list shows the product with non-null price fields; you use this product’s `id` in `onboardingItems` in 1.2. |

**Exit condition:** Category config for at least one merchant type has a fee and at least one onboarding item (productId + quantity). User flow can now show “You will receive: …” and the correct fee.

---

### B. Admin — review, approve, reject

| Step | Action | How to verify |
|------|--------|----------------|
| 3.1 | **List merchants (pending)** — `GET /admin/merchants?status=PENDING`. | Response: list includes the merchant that the user created (see user checklist below). |
| 3.2 | **Get merchant by ID** — `GET /admin/merchants/:id` (use merchant id from user flow). | Response: merchant details; confirm status PENDING and (if applicable) fee-paid state. |
| 3.3a | **Approve** — `POST /admin/merchants/:id/approve` (no body). | Response: `200`, `{ "message": "Merchant approved successfully" }`. Backend creates one allocation per entry in category config `onboardingItems` for this merchant’s type. |
| 3.3b | **Or reject** — `POST /admin/merchants/:id/reject` with body `{ "reason": "Test reject" }`. | Response: `200`, `{ "message": "Merchant rejected" }`. Merchant status becomes SUSPENDED; if fee was paid, it is refunded to user’s CASH wallet. For full flow, prefer 3.3a (approve) so you can test allocations. |
| 3.4 | **Confirm merchant status** — `GET /admin/merchants/:id` again. | After approve: status `ACTIVE`. After reject: status `SUSPENDED`. |

**Exit condition:** Merchant is ACTIVE and has allocations (if you approved). You can now test merchant-side allocation accept and inventory.

---

### C. Admin — refill and assign (optional)

These steps are optional advanced admin flows (refill and OFFLINE_DELIVERY assignment).

| Step | Action | How to verify |
|------|--------|----------------|
| 5.1 | **Refill merchant** — `POST /admin/merchants/:merchantId/refill` (merchant must be ACTIVE). | Response: `200`, body with `message` and `allocationIds`. Backend uses the same `onboardingItems` for that merchant’s type to create new allocations. |
| 5.2 | **Assign merchant to OFFLINE_DELIVERY order** — Create an order with `fulfilmentMode: "OFFLINE_DELIVERY"` (user flow), pay for it; then `POST /admin/orders/:orderId/assign-merchant` with body `{ "merchantId": "<active-merchant-id>" }`. | Response: `200`, `{ "message": "Merchant assigned to order successfully" }`. Merchant’s stock for order items is decremented. If merchant has insufficient stock, API returns 400. |

**Exit condition:** Refill creates new allocations from category config; order assignment decrements merchant stock and returns an error when stock is insufficient.

---

## 3.2 User / merchant-side integration & testing

These steps are done with a **normal user JWT** (for apply/pay) and then as a **merchant** (same user after approval).

### D. User — apply and pay

Use the normal user JWT (registration paid). Do not use admin for apply/pay.

| Step | Action | How to verify |
|------|--------|----------------|
| 2.1 | **Get category config (public)** — `GET /merchants/category-config` (no auth). | Response: `{ "configs": [ ... ] }` with same structure as admin GET. Frontend will use this to show fee and “You will receive: …”. |
| 2.2 | **Apply as merchant** — `POST /merchants/apply` with body e.g. `{ "type": "REGIONAL", "serviceAreas": ["Lagos"] }`. | Response: `201`, merchant object with `status: "PENDING"`, `type`, `serviceAreas`. Store `merchant.id` for later. |
| 2.3 | **Get my merchant profile** — `GET /merchants/me`. | Response: same merchant with `status: "PENDING"`. |
| 2.4 | **Pay merchant fee** — `POST /merchants/merchant-fee/initiate` with body e.g. `{ "source": "REGISTRATION_WALLET" }` or `"CASH_WALLET"` (ensure user has enough balance). If using Paystack: `{ "source": "PAYSTACK", "callbackUrl": "https://..." }` and then redirect user to `response.gatewayUrl`. | Wallet: `200`, fee is marked paid immediately. Paystack: redirect and return to callbackUrl with `reference`. |
| 2.5 | **Gateway verify (Paystack only)** — `POST /merchants/merchant-fee/verify` with `{ "reference": "..." }` after redirect back from gateway. | `200` marks fee paid. If verify is skipped or payment failed/cancelled, fee is not considered paid. |
| 2.6 | **Confirm state** — Call `GET /merchants/me` again. | Merchant still `PENDING`; ready for admin to approve or reject; fee-paid state should now be visible for wallet or verified gateway payments. |

**Exit condition:** One merchant in status PENDING and (if your flow requires it) fee paid. Admin can now list pending merchants and approve/reject.

---

### E. Merchant — allocations and inventory

After admin approval, the same user becomes a merchant with `status: ACTIVE`. These steps use that user’s JWT; merchant-only endpoints require ACTIVE merchant.

| Step | Action | How to verify |
|------|--------|----------------|
| 4.1 | **Get my allocations** — `GET /merchants/me/allocations`. | Response: array of allocations (from approval/refill); each has e.g. `id`, `productId`, `quantity`, `status: "PENDING"`. Count should match number of entries in category config `onboardingItems` for that type (per refill or approve). |
| 4.2 | **Accept one allocation** — `POST /merchants/me/allocations/:allocationId/accept` (use one allocation `id` from 4.1). | Response: `200`, `{ "message": "Allocation accepted successfully" }`. |
| 4.3 | **Get allocations again** — `GET /merchants/me/allocations`. | Accepted allocation no longer pending (or removed from list, depending on API). |
| 4.4 | **Get my inventory** — `GET /merchants/inventory`. | Response: `{ "items": [ ... ] }` includes the product from the accepted allocation with updated stock (e.g. quantity 10 if that was the onboarding quantity). |
| 4.5 | **(Optional) Update stock** — `PUT /merchants/inventory/:productId/stock` with body `{ "stockQuantity": 15, "stockStatus": "IN_STOCK" }`. | Response: success. `GET /merchants/inventory` shows updated quantity/status. |

**Exit condition:** Allocations created by approve/refill are visible; accepting an allocation moves stock into merchant inventory; inventory and (optional) stock update work as documented.

---

## 4. Quick reference: flow vs phases

| Doc flow step | Testing phase | Main endpoints |
|---------------|----------------|-----------------|
| Config exists (fee, onboarding items) | Phase 1 | `GET/PUT /admin/merchant-category-config` |
| User applies | Phase 2 | `POST /merchants/apply`, `GET /merchants/me` |
| User pays fee | Phase 2 | `POST /merchants/merchant-fee/initiate` |
| Admin approves or rejects | Phase 3 | `GET /admin/merchants`, `POST .../approve` or `.../reject` |
| Merchant accepts allocations | Phase 4 | `GET /merchants/me/allocations`, `POST .../allocations/:id/accept` |
| Merchant inventory | Phase 4 | `GET /merchants/inventory`, `PUT .../inventory/:productId/stock` |
| Admin refill | Phase 5 | `POST /admin/merchants/:id/refill` |
| Admin assign merchant to order | Phase 5 | `POST /admin/orders/:id/assign-merchant` |

---

## 5. Frontend integration order (summary)

1. **Admin UI (minimal):** Category config (GET + PUT for one type), list merchants, approve/reject. Optionally: products and prices so you can set `onboardingItems`.
2. **User UI:** Public category config → “Apply as merchant” form (type + service areas) → apply → “Pay fee” (wallet or gateway) → “Pending approval” + `GET /merchants/me`.
3. **Admin UI:** Pending merchants list → merchant detail → Approve / Reject.
4. **Merchant UI:** “My allocations” → “I have received this stock” (accept) → “My inventory” and optional stock update. Then orders/deliveries/earnings as needed.
5. **Admin UI:** Refill button for ACTIVE merchant; order detail “Assign merchant” for OFFLINE_DELIVERY orders.

Testing in this order ensures each screen has the data and state it needs and matches the behaviour in [merchant-flow-frontend.md](api/merchant-flow-frontend.md) and [merchant-category-config.md](api/merchant-category-config.md).
