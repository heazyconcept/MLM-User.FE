# Merchant flow: frontend implementation guide

This document describes the **merchant application, payment, approval/reject, refill, and stock** flows for frontend integration. Synced from backend `HerbApi/docs/api/merchant-flow-frontend.md`.

---

## 1. Overview

| Step | Actor | Action |
|------|--------|--------|
| 1 | User | Apply as merchant (`POST /merchants/apply`) → status **`DRAFT`** (hidden from admin until fee paid) |
| 1a | User | Optional: update tier or apply fields before payment (`PATCH /merchants/me`) while `merchantFeePaidAt` is null and status is `DRAFT` or unpaid `PENDING` |
| 2 | User | Pay merchant category fee (`POST /merchants/merchant-fee/initiate`) — fee amount is resolved from **stored** `merchant.type` in the DB |
| 2a | User / Frontend | **Third-party only:** After redirect from gateway, call `POST /merchants/merchant-fee/verify` with `reference` so the backend verifies with the gateway and marks fee paid. Until then the fee is **not** considered paid. |
| 3 | Admin | Approve or reject application |
| 4a | — | If **reject**: fee is refunded to user's **withdrawal (CASH) wallet** |
| 4b | — | If **approve**: backend creates **allocations** (one per onboarding item from category config) in `PENDING` |
| 5 | Admin | **Dispatches** stock → marks **in transit** → **delivered** |
| 6 | Merchant | **Confirms receipt** on `DELIVERED` allocations (full or short qty with evidence) |
| 7 | Admin / Merchant | Short-qty disputes: admin accepts/rejects; merchant **acknowledges** if rejected |
| 8 | Admin | Can **refill** a merchant; remainder allocations may follow accepted disputes |
| 9 | System | **Stock**: PICKUP decrements merchant stock at order create; OFFLINE_DELIVERY decrements merchant stock when admin assigns merchant; **admin home delivery approve** decrements **warehouse** (admin pool) |

All amounts are in **main currency units** (NGN or USD). Fee is taken from category config (`registrationFeeUsd` or system default).

---

## 2. Endpoints reference

**Base:** All merchant endpoints under `/merchants` require `Authorization: Bearer <token>` unless marked public. Admin endpoints under `/admin/merchants` and `/admin/orders` require admin role.

### 2.1 User / merchant (authenticated)

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/merchants/apply` | Apply as merchant (creates **DRAFT**; no payment yet; not visible in admin list) |
| `PATCH` | `/merchants/me` | Update merchant profile. **Before fee paid:** may change `type`, `phoneNumber`, `address`, `serviceAreas`. **After fee paid / ACTIVE:** `phoneNumber`, `address`, `serviceAreas` only (tier locked). |
| `GET` | `/merchants/available` | **Public.** Merchant dropdown/discovery list (includes business + phone details) |
| `POST` | `/merchants/merchant-fee/initiate` | Pay merchant fee (wallet or gateway) |
| `POST` | `/merchants/merchant-fee/verify` | **Third-party only.** Verify gateway payment by reference; backend marks fee paid only after this. |
| `GET` | `/merchants/category-config` | **Public.** Get tier config (fees, onboarding items) |
| `GET` | `/merchants/me` | Get my merchant profile |
| `GET` | `/merchants/me/allocations` | List allocations with dispatch status + dispute summary |
| `POST` | `/merchants/me/allocations/:id/confirm-receipt` | Confirm qty received (`multipart/form-data`; evidence if short) |
| `GET` | `/merchants/me/stock-disputes` | List my stock receipt disputes |
| `POST` | `/merchants/me/stock-disputes/:id/acknowledge` | Acknowledge after admin **rejects** a dispute |

**Deprecated:** `POST /merchants/me/allocations/:id/accept` → `410 Gone`. Use confirm-receipt after `DELIVERED`.

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

- **Request body:**

```json
{
  "phoneNumber": "+2348012345678",
  "type": "REGIONAL",
  "serviceAreas": ["Lagos"],
  "address": "12 Market Road, Lagos"
}
```

Note: the live API does **not** accept `businessName` on apply (validation rejects it). Business name may be derived server-side or set elsewhere.

- **Response:** Created merchant with status **`DRAFT`**, `merchantFeePaidAt: null`, plus existing fields (`id`, `type`, `phoneNumber`, `serviceAreas`, etc.).

---

### 3.1b Update merchant profile before payment (tier change)

**`PATCH /merchants/me`**

Use this when the user changes tier or edits apply fields **after** `POST /merchants/apply` but **before** paying the merchant fee.

- **Allowed when:** `merchantFeePaidAt === null` and `status` is `DRAFT` or unpaid `PENDING`.
- **Request body (all fields optional; send at least one):**

```json
{
  "type": "NATIONAL",
  "phoneNumber": "+2348012345678",
  "address": "12 Market Road, Lagos",
  "serviceAreas": ["Lagos", "Abuja"]
}
```

- **After fee paid** (`merchantFeePaidAt` set) or when **ACTIVE:** only `phoneNumber`, `address`, and `serviceAreas` may be updated. **`type` returns `403`** — tier is locked after payment.
- **Suggested flow:** `POST /merchants/apply` → (optional) `PATCH /merchants/me` with final tier → `POST /merchants/merchant-fee/initiate`. The fee amount always comes from the **current** `merchant.type` stored in the database, not from the client at initiate time.

**Frontend implementation:** `MerchantApplyComponent.onApplyAndPay()` calls `PATCH /merchants/me` with `{ type, phoneNumber, address, serviceAreas }` before `merchant-fee/initiate` when `needsPayment()` is true.

---

### 3.1a Available merchants (dropdown/discovery)

**`GET /merchants/available`** (public)

- Use `businessName` as primary display label in dropdowns.
- Optionally show `phoneNumber` as secondary text for faster identification.

---

### 3.2 Initiate merchant fee payment

**`POST /merchants/merchant-fee/initiate`**

- **Response (wallet):** Fee marked paid immediately.
- **Response (Paystack):** Includes `gatewayUrl`. **Fee is not paid until verify succeeds.**

**Validation:** Fee is looked up from category config using **`merchant.type`** from the DB. Merchant must be unpaid (`DRAFT` or unpaid `PENDING`).

---

### 3.2a Verify merchant fee payment (third-party gateway only)

**`POST /merchants/merchant-fee/verify`**

- Call when user returns from Paystack with `?reference=...` on `/merchant/apply`.
- On success: `DRAFT` → `PENDING`, `merchantFeePaidAt` set.
- On cancel/failure: merchant stays **`DRAFT`**, fee not paid.

---

## 4. Stock behaviour (for frontend clarity)

| Scenario | When stock is decremented |
|----------|----------------------------|
| **PICKUP** order with `selectedMerchantId` | At **order creation** |
| **OFFLINE_DELIVERY** order | When **admin assigns** a merchant (`POST /admin/orders/:id/assign-merchant`) |
| **OFFLINE_DELIVERY** (admin fulfilment, no merchant) | When admin **approves** home delivery: **warehouse** decremented |
| **Allocations** (onboarding / refill) | When merchant **confirms receipt** on `DELIVERED` (full qty), or after dispute resolution / acknowledge |

See [frontend-integration-merchant-stock-dispatch.md](./frontend-integration-merchant-stock-dispatch.md) for dispatch lifecycle and dispute flows.

---

## 5. Suggested frontend flows

### 5.1 User: Apply and pay fee

1. `GET /merchants/category-config` → display fee and onboarding items.
2. `POST /merchants/apply` → status **`DRAFT`**.
3. If user changes tier before paying: `PATCH /merchants/me`.
4. `POST /merchants/merchant-fee/initiate` (fee from stored `type`).
5. Paystack: redirect → return to callback → `POST /merchants/merchant-fee/verify`.
6. Refetch `GET /merchants/me` → `PENDING` + fee paid.

---

## 6. TypeScript (frontend)

See `src/app/services/merchant.service.ts`:

- `ApplyMerchantBody` — `phoneNumber`, `type`, `serviceAreas`, optional `address` (no `businessName` on apply)
- `UpdateMerchantProfileBody` — optional `type`, `phoneNumber`, `address`, `serviceAreas`
- `InitiateMerchantFeeBody`, `VerifyMerchantFeeBody`, `AvailableMerchant`
- `ConfirmAllocationReceiptBody`, `MerchantAllocation`, `MerchantStockDispute`

---

## 7. Related docs

- [frontend-integration-merchant-stock-dispatch.md](./frontend-integration-merchant-stock-dispatch.md)
- [MERCHANTS_FRONTEND_GUIDE.md](./MERCHANTS_FRONTEND_GUIDE.md)
- [MERCHANTS_API.md](./MERCHANTS_API.md)
- [BACKEND_BUG_MERCHANT_PENDING_BEFORE_PAYMENT.md](./BACKEND_BUG_MERCHANT_PENDING_BEFORE_PAYMENT.md)
