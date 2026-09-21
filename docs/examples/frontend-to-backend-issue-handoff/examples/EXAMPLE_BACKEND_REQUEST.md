# Backend Request — Profile Complete Flag + Checkout Guard

**Date:** 2026-09-01  
**From:** Frontend (`your-frontend-app`)  
**Status:** Open  
**Severity:** High  
**Area:** User profile and checkout  
**Endpoints:** `GET /users/me`, `PUT /users/me`, `PUT /users/me/bank`, `POST /orders/checkout`

**Related FE:**

- [`profile.page.ts`](../src/app/pages/profile/profile.page.ts)
- [`auth.service.ts`](../src/app/services/auth.service.ts)
- [`checkout.service.ts`](../src/app/services/checkout.service.ts)

---

## 1. Summary

New users can register and place orders without saving phone or address. Merchants then see blank buyer contact. Frontend will prompt incomplete users and block checkout in the UI, but backend must own completeness — users can skip prompts or call checkout directly.

## 2. Current behavior (reproduction)

1. Register a new user. Do not open profile or save phone / address / bank.
2. Place an order.
3. Open the order as the fulfilment role.

**Observed:** Buyer phone is blank.  
**Root cause:**

| Layer / endpoint | Current behavior | Problem |
|------------------|------------------|---------|
| `POST /auth/register` | No phone collected | Expected |
| `PUT /users/me` | Phone/address optional | Never required before checkout |
| `POST /orders/checkout` | No profile completeness check | Incomplete users can order |

## 3. Required API changes

### 3.1 `GET /users/me` — add `isProfileComplete`

**Change type:** additive field

```json
{
  "id": "user_123",
  "email": "user@example.com",
  "firstName": "Ada",
  "lastName": "Okafor",
  "phone": "08012345678",
  "address": "12 Example Street",
  "isProfileComplete": true,
  "profileMissingFields": []
}
```

| Field | Type | Required | Meaning |
|-------|------|----------|---------|
| `isProfileComplete` | boolean | yes | `true` only when required profile + bank fields are present |
| `profileMissingFields` | string[] | recommended when false | e.g. `phone`, `address`, `bankName` |

Compute from stored fields on every read. Do not accept a client-supplied boolean.

### 3.2 `POST /orders/checkout` — reject incomplete profiles

**Change type:** validation

```json
{
  "statusCode": 400,
  "code": "PROFILE_INCOMPLETE",
  "message": "Complete your profile before placing an order.",
  "missingFields": ["phone", "address"]
}
```

| Field | Required |
|-------|----------|
| `code` | `"PROFILE_INCOMPLETE"` (exact) |

Do not create the order or debit wallets when incomplete.

## 4. Ownership / business rules

- Backend must own: completeness flag + checkout rejection
- Frontend will own: login prompt and pre-checkout redirect UX

## 5. What the frontend will do after this ships

| Moment / screen | FE behavior |
|-----------------|-------------|
| Login | If `isProfileComplete === false`, prompt to finish profile |
| Checkout | Block confirm when flag is false; handle `PROFILE_INCOMPLETE` if bypassed |

Until the API ships, FE will: show a soft prompt only (not enforceable).

## 6. Acceptance criteria

- [ ] `GET /users/me` always includes `isProfileComplete`
- [ ] Flag is `false` for a new user who has not saved profile + bank
- [ ] Checkout with incomplete profile returns `400` + `code: "PROFILE_INCOMPLETE"` and creates no order
- [ ] Completeness is derived from stored fields, not a client boolean
- [ ] API docs updated with the new fields

## 7. Out of scope

- Collecting phone at registration
- KYC / identity documents
- Transaction PIN

## 8. Changelog

| Date | Author | Change |
|------|--------|--------|
| 2026-09-01 | Frontend | Initial request |
