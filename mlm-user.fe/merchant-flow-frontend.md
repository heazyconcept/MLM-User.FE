# Merchant flow: frontend implementation guide

This document describes the **merchant application, payment, approval/reject, refill, and stock** flows for frontend integration. It aligns with the backend behaviour described in the merchant payment, reject refund, refill, and stock management plan.

---

## 1. Overview

| Step | Actor | Action |
|------|--------|--------|
| 1 | User | Apply as merchant (`POST /merchants/apply`) → status `PENDING` |
| 2 | User | Pay merchant category fee (`POST /merchants/merchant-fee/initiate`) — from registration wallet, cash wallet, or Paystack |
| 3 | Admin | Approve or reject application |
| 4a | — | If **reject**: fee is refunded to user's **withdrawal (CASH) wallet** |
| 4b | — | If **approve**: backend creates **allocations** (one per onboarding item from category config) |
| 5 | Merchant | **Accept** each allocation **after physically receiving** the stock |
| 6 | Admin | Can **refill** a merchant (same products/quantities as category config); merchant accepts again after receipt |
| 7 | System | **Stock**: decremented at order creation for PICKUP; for OFFLINE_DELIVERY, decremented when admin assigns merchant to order |

All amounts are in **main currency units** (NGN or USD). Fee is taken from category config (`registrationFeeUsd` or system default).

---

## 2. Endpoints reference

**Base:** All merchant endpoints under `/merchants` require `Authorization: Bearer <token>` unless marked public. Admin endpoints under `/admin/merchants` and `/admin/orders` require admin role.

### 2.1 User / merchant (authenticated)

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/merchants/apply` | Apply as merchant (creates PENDING; no payment yet) |
| `POST` | `/merchants/merchant-fee/initiate` | Pay merchant fee (wallet or gateway) |
| `GET` | `/merchants/category-config` | **Public.** Get tier config (fees, onboarding items) |
| `GET` | `/merchants/me` | Get my merchant profile |
| `GET` | `/merchants/me/allocations` | Get my pending allocations (onboarding/refill) |
| `POST` | `/merchants/me/allocations/:id/accept` | Accept allocation **after physical receipt** |

### 2.2 Admin

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/admin/merchants` | List merchants (optional filters) |
| `GET` | `/admin/merchants/:id` | Get merchant by ID (includes fee-paid info when present) |
| `POST` | `/admin/merchants/:id/approve` | Approve → creates allocations from category config |
| `POST` | `/admin/merchants/:id/reject` | Reject → refund fee to user's CASH wallet |
| `POST` | `/admin/merchants/:id/refill` | Refill merchant (same products/quantities as category) |
| `POST` | `/admin/orders/:id/assign-merchant` | Assign merchant to OFFLINE_DELIVERY order (validates & decrements stock) |

---

## 3. Request / response shapes

### 3.1 Apply as merchant

**`POST /merchants/apply`**

- **Request body:** As defined by `ApplyMerchantDto` (e.g. `merchantType`, `serviceAreas`, etc.).
- **Response:** Created merchant (e.g. `id`, `status: 'PENDING'`, `type`, …).

---

### 3.2 Initiate merchant fee payment

**`POST /merchants/merchant-fee/initiate`**

- **Request body:**

```json
{
  "source": "REGISTRATION_WALLET" | "CASH_WALLET" | "PAYSTACK",
  "merchantId": "uuid (optional if user has only one PENDING merchant)",
  "callbackUrl": "https://... (optional, for gateway redirect)"
}
```

- **Response (wallet):** Payment recorded; no redirect. Show success and e.g. redirect to "pending approval" or call `GET /merchants/me` to confirm fee paid.
- **Response (Paystack):** Includes `gatewayUrl`. Redirect user to `gatewayUrl`; after payment, user returns to `callbackUrl`. Backend verifies via payment callback; then `GET /merchants/me` or merchant detail will show fee paid (e.g. `merchantFeePaidAt`).

**Validation:** If paying from wallet, balance must be ≥ fee (in user's base currency). If merchant is not PENDING or fee already paid, API returns an error.

---

### 3.3 Get category config (for application flow)

**`GET /merchants/category-config`** (public)

- **Response:**

```json
{
  "configs": [
    {
      "id": "uuid",
      "merchantType": "REGIONAL",
      "deliveryCommissionPct": 4,
      "productCommissionPct": 3.5,
      "registrationFeeUsd": 600,
      "onboardingItems": [
        { "productId": "uuid-bible", "quantity": 40 },
        { "productId": "uuid-books", "quantity": 50 },
        { "productId": "uuid-pads", "quantity": 30 }
      ]
    }
  ]
}
```

Use `registrationFeeUsd` (or system default when null) to show the fee. Use `onboardingItems` to show "You will receive: 40× Product A, 50× Product B, …" (resolve product names from product API if needed).

---

### 3.4 Admin: Approve merchant

**`POST /admin/merchants/:id/approve`**

- **Response:** `200 OK`, `{ "message": "Merchant approved successfully" }`.
- **Backend:** Creates one allocation per entry in the merchant's category `onboardingItems`. Merchant sees them under `GET /merchants/me/allocations`.

---

### 3.5 Admin: Reject merchant

**`POST /admin/merchants/:id/reject`**

- **Request body:** `{ "reason": "string" }`.
- **Response:** `200 OK`, `{ "message": "Merchant rejected" }`.
- **Backend:** If the merchant had paid the fee, the fee is **refunded to the user's withdrawal (CASH) wallet**. Merchant status set to SUSPENDED.

---

### 3.6 Get my allocations (merchant)

**`GET /merchants/me/allocations`**

- **Response:** List of pending allocations (from approval or refill). Each has e.g. `id`, `productId`, `quantity`, status.

---

### 3.7 Accept allocation (merchant)

**`POST /merchants/me/allocations/:id/accept`**

- **Path:** `:id` = allocation ID.
- **When to call:** **Only after the merchant has physically received** the stock. Frontend should label the button e.g. "I have received this stock" or "Accept".
- **Response:** Allocation accepted; stock moves from admin pool to merchant (backend handles this).

---

### 3.8 Admin: Refill merchant

**`POST /admin/merchants/:id/refill`**

- **Path:** `:id` = merchant ID (merchant must be **ACTIVE**).
- **Response:**

```json
{
  "message": "Refill allocations created. Merchant must accept each after receiving stock.",
  "allocationIds": ["uuid1", "uuid2", ...]
}
```

- **Backend:** Creates one allocation per item in the merchant's category `onboardingItems` (same products/quantities as onboarding). Merchant must **accept** each allocation after physical receipt (same flow as initial onboarding).

---

### 3.9 Admin: Assign merchant to order (OFFLINE_DELIVERY)

**`POST /admin/orders/:id/assign-merchant`**

- **Request body:** `{ "merchantId": "uuid" }`.
- **Response:** `200 OK`, `{ "message": "Merchant assigned to order successfully" }`.
- **Backend:** Validates merchant has sufficient stock for all order items; if not, returns **400**. On success, **decrements that merchant's stock** for each order item (same behaviour as PICKUP at order creation).

---

## 4. Stock behaviour (for frontend clarity)

| Scenario | When stock is decremented |
|----------|----------------------------|
| **PICKUP** order with `selectedMerchantId` | At **order creation**. Insufficient merchant stock blocks order creation. |
| **OFFLINE_DELIVERY** order | When **admin assigns** a merchant to the order (`POST /admin/orders/:id/assign-merchant`). If stock is insufficient, assignment returns 400. |
| **Allocations** (onboarding / refill) | Stock moves from admin pool to merchant only when the merchant **accepts** the allocation (after physical receipt). |

For OFFLINE_DELIVERY, the frontend should only allow assigning a merchant when that merchant has enough stock; the API enforces it and returns an error if not.

---

## 5. Suggested frontend flows

### 5.1 User: Apply and pay fee

1. Show category config: `GET /merchants/category-config` → display fee and "You will receive: …" from `onboardingItems`.
2. User submits application: `POST /merchants/apply`.
3. User chooses payment: `POST /merchants/merchant-fee/initiate` with `source` (and optional `callbackUrl` for Paystack).
   - If **REGISTRATION_WALLET** or **CASH_WALLET**: show success and "Pending admin approval".
   - If **PAYSTACK**: redirect to `response.gatewayUrl`; on return to `callbackUrl`, show success and "Pending admin approval".
4. Optional: poll or refetch `GET /merchants/me` to show "Fee paid" and status PENDING.

### 5.2 Admin: Approve / reject

1. List merchants: `GET /admin/merchants` (filter by `status=PENDING` if needed).
2. Merchant detail: `GET /admin/merchants/:id` (can show fee-paid state if present).
3. **Approve:** `POST /admin/merchants/:id/approve` → merchant gets allocations; show "Merchant must accept each allocation after receiving stock."
4. **Reject:** `POST /admin/merchants/:id/reject` with `{ "reason": "..." }` → fee refunded to user's CASH wallet; show "Merchant rejected; fee refunded to withdrawal wallet."

### 5.3 Merchant: Accept allocations (onboarding / refill)

1. List pending allocations: `GET /merchants/me/allocations`.
2. For each allocation, show a button: **"I have received this stock"** (or "Accept").
3. On click: `POST /merchants/me/allocations/:id/accept`. Then refresh list.

### 5.4 Admin: Refill merchant

1. From merchant detail (or list), show **Refill** button (only for ACTIVE merchants).
2. Call `POST /admin/merchants/:id/refill`.
3. Show message: "Refill requested; merchant must accept each allocation after receiving stock." Optionally show `allocationIds` for reference.

### 5.5 Admin: Assign merchant to OFFLINE_DELIVERY order

1. On order detail (order with `fulfilmentMode: OFFLINE_DELIVERY` and status PAID or ASSIGNED_TO_MERCHANT), show "Assign merchant" with a merchant picker.
2. Call `POST /admin/orders/:orderId/assign-merchant` with `{ "merchantId": "..." }`.
3. If **400** (e.g. "Insufficient merchant stock"): show error and do not assign. Otherwise show success.

---

## 6. TypeScript (frontend)

```ts
type MerchantFeePaymentSource = 'REGISTRATION_WALLET' | 'CASH_WALLET' | 'PAYSTACK';

interface InitiateMerchantFeeBody {
  source: MerchantFeePaymentSource;
  merchantId?: string;
  callbackUrl?: string;
}

interface RefillMerchantResponse {
  message: string;
  allocationIds: string[];
}

interface AssignMerchantToOrderBody {
  merchantId: string;
}
```

---

## 7. Related docs

- [Merchant category config (admin & frontend)](./merchant-category-config.md) — config structure, onboarding items, fee.
- [Feature 14 – Merchant operations](../features/14-merchant-operations.md) — high-level merchant lifecycle and fulfilment.
