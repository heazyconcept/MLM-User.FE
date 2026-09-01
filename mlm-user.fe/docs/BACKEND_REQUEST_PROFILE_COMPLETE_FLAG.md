# Backend Request — Profile Complete Flag + Checkout Guard

**Date:** 2026-09-01  
**From:** User FE (`mlm-user.fe`)  
**Status:** Implemented (backend + frontend)  
**Severity:** High  
**Area:** User profile (`GET/PUT /users/me`, `PUT /users/me/bank`) and checkout (`POST /orders/checkout`)

**Related FE:**

- Profile: [`profile.component.ts`](../src/app/pages/profile/profile.component.ts)
- Login already loads profile: [`auth.service.ts`](../src/app/services/auth.service.ts) (`login()` → `GET /users/me`)
- Checkout: [`cart-checkout.service.ts`](../src/app/services/cart-checkout.service.ts)
- Merchant phone display: [`merchant-orders.component.ts`](../src/app/pages/merchant/merchant-orders/merchant-orders.component.ts) (`buyerPhone ?? user.phone`)

---

## 1. Summary

New users can register, activate, and place orders **without saving a profile**. Registration does not collect phone or address. Checkout does not send a buyer phone.

On the merchant side, buyer contact is `order.buyerPhone ?? order.user.phone`. When those are empty, the merchant cannot call the customer.

The frontend will:

1. After login, read a backend flag and **strongly prompt** incomplete users to finish profile.
2. Block / intercept **placing an order** until the flag is true.

The backend must own completeness. A client-only check is not enough — users can skip the prompt or call checkout directly.

---

## 2. Current behavior (reproduction)

1. Register a new user. Do **not** open `/profile` or save phone / address / bank.
2. Complete activation if required.
3. Place an order (shop → checkout → pay with voucher).
4. Log in as the assigned merchant and open the order.

**Observed:** Buyer phone is blank. Merchant cannot contact the customer.

**Root cause:**

| Layer | Behavior |
|-------|----------|
| `POST /auth/register` | Collects email, password, package, currency, referral. No phone. |
| `PUT /users/me` | Optional `phone`, `address`, names. Never required before checkout. |
| `POST /orders/checkout` | Does not require a complete profile. Does not reliably snapshot buyer phone onto the order. |
| Merchant order payload | Reads `buyerPhone` / `user.phone` — both empty for these users. |

`profileCompletionPercentage` already exists on some profile responses but is not a boolean gate, and it is not enforced on checkout.

---

## 3. Required API: `isProfileComplete` on `GET /users/me`

Add a boolean that is the **single source of truth** for “this user has finished profile setup.”

### 3.1 Response (additive)

```json
{
  "id": "user_123",
  "email": "user@example.com",
  "firstName": "Ada",
  "lastName": "Okafor",
  "phone": "08012345678",
  "address": "12 Example Street, Ikeja",
  "isProfileComplete": true,
  "profileCompletionPercentage": 100
}
```

| Field | Type | Required | Meaning |
|-------|------|----------|---------|
| `isProfileComplete` | boolean | **yes** | `true` only when every required profile field below is present and valid. |
| `profileCompletionPercentage` | number | keep if already returned | Must stay consistent with the flag: `100` iff `isProfileComplete === true`. |

Do **not** persist a manual toggle the user can set. Compute the flag from stored fields on every read (and after every profile/bank update). A stored column that can drift from real data is worse than no flag.

Login already calls `GET /users/me` immediately after `POST /auth/login`. No new login endpoint is required.

---

## 4. Completeness rules (“full profile”)

`isProfileComplete` is `true` only when **all** of the following are non-empty after trim.

### 4.1 Account profile (`PUT /users/me`)

| Field | Rule |
|-------|------|
| `firstName` | Required, non-empty |
| `lastName` | Required, non-empty |
| `phone` | Required, non-empty. Accept Nigerian 11-digit local (`08012345678`) or E.164 (`+2348012345678`). |
| `address` | Required, non-empty |

`email` is always present from registration; do not use it as a completeness gap.

### 4.2 Bank details (`PUT /users/me/bank`)

The live profile page collects bank details as part of profile setup. Include them in this flag:

| Field | Rule |
|-------|------|
| `bankName` | Required, non-empty |
| `accountNumber` | Required, numeric, 10 digits (NGN accounts) |
| `accountName` | Required, non-empty |

Bank payload is **not** on `GET /users/me` today (FE loads `GET /users/me/bank` separately). Completeness must still consider bank rows. Returning `isProfileComplete` from `GET /users/me` is enough; do not require the FE to join two endpoints to decide.

### 4.3 Explicitly out of scope for this flag

Do **not** require these to flip `isProfileComplete` to `true`:

- Profile photo
- Date of birth, gender, city, state, country (unless you already require them on `PUT /users/me`)
- KYC / identity documents
- Transaction PIN (`hasTransactionPin` stays a separate flag)
- Merchant business profile (`GET/PATCH /merchants/me`)

Those have their own flows. This flag is the **member profile** the buyer must finish so merchants can fulfil orders and payouts are ready.

### 4.4 Missing-fields helper (recommended)

When `isProfileComplete` is `false`, also return:

```json
{
  "isProfileComplete": false,
  "profileMissingFields": ["phone", "address", "bankName", "accountNumber", "accountName"]
}
```

Allowed values: `firstName` | `lastName` | `phone` | `address` | `bankName` | `accountNumber` | `accountName`.

Frontend uses this for the login prompt and checkout blocker copy.

---

## 5. Checkout must refuse incomplete profiles

`POST /orders/checkout` (and any other create-order path) must reject when `isProfileComplete` is `false`.

### 5.1 Error contract

**HTTP 400** (or 403 if you prefer a dedicated guard). Body must be stable so FE can branch on it:

```json
{
  "statusCode": 400,
  "error": "Bad Request",
  "code": "PROFILE_INCOMPLETE",
  "message": "Complete your profile before placing an order.",
  "missingFields": ["phone", "address"]
}
```

| Field | Required |
|-------|----------|
| `code` | `"PROFILE_INCOMPLETE"` (exact string) |
| `missingFields` | Same enum as `profileMissingFields` |

Do not place the order, do not debit wallets, do not create a checkout id that can be paid.

### 5.2 Snapshot buyer contact onto the order

When checkout **succeeds**, copy the buyer’s current profile onto the order so the merchant payload does not depend on a later join:

| Order field | Source |
|-------------|--------|
| `buyerPhone` | User `phone` |
| `buyerUsername` | User `username` (already used) |

Merchant list/detail already reads `buyerPhone ?? user.phone`. Snapshoting `buyerPhone` at checkout is what fixes the blank number even if `user.phone` mapping is inconsistent.

---

## 6. `PUT /users/me` and `PUT /users/me/bank`

After a successful update, recompute `isProfileComplete` and return it on the update response **or** document that FE must refetch `GET /users/me`.

Preferred: both `PUT /users/me` and `PUT /users/me/bank` return the updated user (or at least `{ isProfileComplete, profileMissingFields }`) so the login/checkout prompt can close immediately after save.

---

## 7. Existing orders (optional backfill)

Orders already placed without a phone stay blank unless backend backfills.

Optional, recommended once:

- For orders where `buyerPhone` is null/empty and the user now has `phone`, set `buyerPhone` from current `phone`.
- Do not overwrite a non-empty `buyerPhone`.

Frontend cannot fix historical merchant rows.

---

## 8. Frontend consumption (after this ships)

| Moment | FE behavior |
|--------|-------------|
| Login | `AuthService.login()` already fetches `GET /users/me`. If `isProfileComplete === false`, show a strong prompt to `/profile` (edit mode). |
| Checkout | Before `POST /orders/checkout`, if flag is false, send user to profile instead of confirming. If they bypass, handle `PROFILE_INCOMPLETE`. |
| Profile save | Refetch `GET /users/me` (or use PUT response) and clear the prompt when the flag becomes `true`. |

FE work starts when `isProfileComplete` is live on `GET /users/me` and checkout returns `PROFILE_INCOMPLETE`.

---

## 9. Acceptance checklist

- [ ] `GET /users/me` always includes `isProfileComplete` (boolean).
- [ ] Flag is `false` for a newly registered user who has not saved profile + bank.
- [ ] Flag becomes `true` only after first name, last name, phone, address, and bank name / account number / account name are saved.
- [ ] `POST /orders/checkout` with an incomplete profile returns `400` + `code: "PROFILE_INCOMPLETE"` and creates no order.
- [ ] Successful checkout persists `buyerPhone` from the user’s `phone`.
- [ ] Merchant order list/detail shows that phone.
- [ ] Completeness is derived from stored fields, not a client-supplied boolean.
- [ ] `profileCompletionPercentage` is `100` iff `isProfileComplete` is `true` (if percentage remains in the payload).

---

## 10. Out of scope for this request

- Changing registration to collect phone (nice later, not required if this flag + checkout guard exist).
- Merchant business profile completeness.
- KYC verification.
- Transaction PIN.

---

## 11. OpenAPI

Please add `isProfileComplete` (and `profileMissingFields` if implemented) to the user schema and publish via `/api/docs-json` so FE can regenerate `src/app/core/api-types.ts`.
