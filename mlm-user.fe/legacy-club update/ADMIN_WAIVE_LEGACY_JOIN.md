# Admin — Waive & activate Legacy pending join

**Date:** 2026-09-25  
**Audience:** Backend + admin FE  
**Status:** Admin FE wired; **backend not implemented**

---

## 1. Purpose

Allow an admin to **complimentary-activate** a user's in-progress Legacy Club join when membership status is `PENDING_JOIN` — same intent as user management `POST /admin/users/:id/activate-registration` with `mode: WAIVE_PAYMENT`.

Use cases:

- Support-approved complimentary Legacy membership
- User stuck in pending join without manual payment on file
- VIP / partner enrollment without marketplace checkout

This is **not** the same as:

- **Seed enroll** (`POST /admin/legacy/enroll`) — creates a new ACTIVE member from admin; does not complete an existing pending join
- **Approve manual payment** (`POST /admin/legacy/payments/:id/approve`) — requires submitted payment proof
- **Cancel join** (`POST /admin/legacy/members/:userId/cancel-join`) — removes pending membership

**Out of scope:** waive upgrade/reactivate purchase (per Phase 3 docs).

---

## 2. Admin API

### 2.1 Waive & activate join

```
POST /admin/legacy/members/:userId/waive-join
```

**Permission:** `legacy.waive_join` (recommended). Until seeded, allow users with `legacy.enroll_seed` for Super Admin parity.

**Request body:**

```json
{
  "reason": "Support ticket #1234 — complimentary VIP join approved."
}
```

| Field | Type | Required | Rules |
|---|---|---|---|
| `reason` | string | yes | Trimmed, min 10 chars, max 500 |

**Success `200`:**

```json
{
  "data": {
    "userId": "uuid",
    "username": "Eze1",
    "previousStatus": "PENDING_JOIN",
    "status": "ACTIVE",
    "package": "VIP",
    "joinedAt": "2026-09-25T19:00:00.000Z",
    "waivedAt": "2026-09-25T19:00:00.000Z",
    "waivedByAdminId": "uuid",
    "reason": "Support ticket #1234 — complimentary VIP join approved."
  }
}
```

**Errors:**

| HTTP | Code | When |
|---|---|---|
| 404 | `LEGACY_MEMBERSHIP_NOT_FOUND` | No membership row for user |
| 409 | `LEGACY_NOT_PENDING_JOIN` | Status is `ACTIVE`, `EXPIRED`, `NONE`, etc. |
| 422 | `LEGACY_PAYMENT_PENDING` | Open manual JOIN payment in `PENDING` — approve/reject first |
| 403 | — | Missing permission |
| 400 | — | Reason validation failed |

---

## 3. Backend behaviour (required)

**Preconditions:**

- Membership `status === PENDING_JOIN`
- User does not already have `ACTIVE` Legacy membership
- Reject if a JOIN payment with `status: PENDING` exists for this user

**On success** (mirror seed waive from [phase-1-backend.md](./phase-1-backend.md) §10):

1. **Membership**
   - Set status `PENDING_JOIN` → **`ACTIVE`**
   - Set `joinedAt`, `cycleStartedAt`
   - Preserve existing **package** and **sponsor** from `join/start`
2. **Wallets**
   - Ensure `LEGACY_CASHOUT` and `LEGACY_VOUCHER` wallets exist
   - Credit **Instant commission** to `LEGACY_CASHOUT`
   - Pay **Successline Instant bonus** to sponsor if applicable
3. **No commerce**
   - **No** marketplace order, **no** PV, **no** Legacy voucher debit (same as seed waive)
4. **Payments**
   - Cancel/close any open join payment intents for this membership (do not approve with wallet credit from payment flow)
5. **Audit / history**
   - Append admin event on member detail timeline: `kind: "JOIN"` with `waivedByAdmin: true` (or `kind: "JOIN_WAIVED"`), `at`, `reason`, `adminId`
6. **Idempotency**
   - Second waive on already-`ACTIVE` user → `409 LEGACY_NOT_PENDING_JOIN`

**Must NOT:**

- Waive upgrade or reactivate flows
- Debit Legacy product voucher
- Create marketplace order or buyer/sponsor PV

---

## 4. Member impact

- `GET /legacy/me` returns `status: "ACTIVE"` with wallets and cycle fields populated
- Existing legacy-pay polling treats this like a successful join (no member FE change required unless backend adds a one-time notice)

---

## 5. Admin FE (implemented)

| Location | Change |
|---|---|
| `/admin/legacy/members/:userId` | **Waive & activate** when `status === PENDING_JOIN` |
| `/admin/legacy/members` | Inline **Waive & activate** in Actions column |
| Service | `POST admin/legacy/members/:userId/waive-join` |

**Permission check:** `legacy.waive_join` or fallback `legacy.enroll_seed`.

---

## 6. Related docs

- [ADMIN_CANCEL_PENDING_JOIN.md](./ADMIN_CANCEL_PENDING_JOIN.md)
- [phase-1-backend.md](./phase-1-backend.md) §10 (seed waive behaviour)
- User management waive: `POST /admin/users/:id/activate-registration` with `mode: WAIVE_PAYMENT`
