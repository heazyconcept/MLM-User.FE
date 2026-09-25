# Admin — Cancel Legacy pending join

**Date:** 2026-09-25  
**Audience:** Backend + admin FE + member FE  
**Status:** Frontend wired; **backend not implemented**

---

## 1. Purpose

Allow an admin to **cancel a user's in-progress Legacy Club registration** when membership status is `PENDING_JOIN` (join started, payment not completed / not approved).

Use cases:

- User started join with wrong package or sponsor and needs a clean restart
- Fraud / duplicate enrollment attempt
- User requested cancellation via support
- Admin needs to clear a stuck pending join before seeding or re-enrolling

This is **not** the same as rejecting a manual **payment** (`POST /admin/legacy/payments/:id/reject`). Payment reject leaves the user in `PENDING_JOIN` so they can resubmit proof. **Cancel join** removes the pending membership entirely.

---

## 2. Admin API

### 2.1 Cancel pending join

```
POST /admin/legacy/members/:userId/cancel-join
```

**Permission:** `legacy.cancel_pending_join` (recommended). Until seeded, allow users with `legacy.view_members` for Super Admin parity.

**Request body:**

```json
{
  "reason": "Duplicate enrollment — user will restart with correct sponsor."
}
```

| Field | Type | Required | Rules |
|---|---|---|---|
| `reason` | string | yes | Trimmed, min 5 chars, max 500 |

**Success `200`:**

```json
{
  "data": {
    "userId": "uuid",
    "username": "jane_doe",
    "previousStatus": "PENDING_JOIN",
    "status": "NONE",
    "package": "VIP",
    "cancelledAt": "2026-09-25T11:00:00.000Z",
    "cancelledByAdminId": "uuid",
    "reason": "Duplicate enrollment — user will restart with correct sponsor."
  }
}
```

**Errors:**

| HTTP | Code | When |
|---|---|---|
| 404 | `LEGACY_MEMBERSHIP_NOT_FOUND` | No membership row for user |
| 409 | `LEGACY_NOT_PENDING_JOIN` | Status is `ACTIVE`, `EXPIRED`, etc. |
| 409 | `LEGACY_JOIN_ALREADY_CANCELLED` | Idempotent retry after cancel |
| 403 | — | Missing permission |

---

## 3. Backend behaviour (required)

When cancel succeeds:

1. **Membership**
   - Set status from `PENDING_JOIN` → **`NONE`** (or delete pending membership row — FE expects `GET /legacy/me` → `status: "NONE"`).
   - Clear `pendingJoin`, `pendingPayment`, join intent fields, and any draft join order linkage.
2. **Payments**
   - Any `PENDING` Legacy payment with `purpose: JOIN` for this user → set **`REJECTED`** with `rejectionReason` prefixed e.g. `Join cancelled by admin: {reason}` (or cancel without reject — pick one; FE treats missing pending payment as cleared).
   - Do **not** approve or credit wallets.
3. **Placement / tree**
   - Remove reserved Successline placement if join had not activated (no `ACTIVE` record).
   - Sponsor's pending Successline count must not include this user after cancel.
4. **Audit / history**
   - Append admin event on member detail timeline: `kind: "JOIN_CANCELLED"`, `at`, `reason`, `adminId`.
   - Optional: member-facing history entry when user later joins again.
5. **User notification** (see §4).
6. **Idempotency**
   - Second cancel on already-`NONE` user → `409 LEGACY_JOIN_ALREADY_CANCELLED` or safe no-op with same payload.

**Must NOT:**

- Cancel `ACTIVE` members (use suspension/expiry flows in Phase 3).
- Refund automatically unless a separate wallet reversal flow exists.

---

## 4. User notification

### 4.1 In-app notification record

Create notification for the affected user:

| Field | Value |
|---|---|
| `type` | `LEGACY_JOIN_CANCELLED` (new enum — see §5) |
| `category` | `SYSTEM` |
| `title` | `Legacy Club registration cancelled` |
| `message` | Admin reason (user-facing). Example: *Your Legacy Club registration was cancelled: Duplicate enrollment — please start again.* |
| `actionUrl` | `/legacy/join` |
| `actionLabel` | `Start again` |
| `metadata` | `{ "package": "VIP", "cancelledBy": "admin" }` |

Also emit on Socket.io `/notifications` namespace so online users get immediate toast/modal.

Fallback until enum exists: `ADMIN_ACTION_TAKEN` with the same title/message/metadata.

### 4.2 `GET /legacy/me` notice (until acknowledged)

Include a one-time notice so polling users on `/legacy/pay/JOIN` see cancellation without waiting for socket:

```json
{
  "status": "NONE",
  "pendingJoin": null,
  "pendingPayment": null,
  "joinCancellationNotice": {
    "reason": "Duplicate enrollment — user will restart with correct sponsor.",
    "cancelledAt": "2026-09-25T11:00:00.000Z"
  }
}
```

Clear `joinCancellationNotice` after:

```
POST /legacy/join/cancellation/ack
```

(empty body, auth required)

Or clear automatically when user calls `POST /legacy/join/start` again.

---

## 5. Enum / permission additions

**Prisma / API enums**

```prisma
// NotificationType (platform)
LEGACY_JOIN_CANCELLED

// Legacy history / admin timeline
JOIN_CANCELLED
```

**Admin permission seed**

```
legacy.cancel_pending_join — Cancel pending Legacy join
```

---

## 6. Admin FE (implemented)

| Location | Behaviour |
|---|---|
| `/admin/legacy/members/:userId` | **Cancel registration** when `status === PENDING_JOIN` |
| Confirm modal | Requires reason (min 5 chars) |
| Service | `POST admin/legacy/members/:userId/cancel-join` |

Members list continues to show **Pending join** badge; no inline cancel (detail only).

---

## 7. Member FE (implemented)

| Location | Behaviour |
|---|---|
| `/legacy/pay/JOIN` | On poll / `loadMe`, if status → `NONE` with notice → toast + redirect `/legacy/join` |
| `/legacy` gate | Shows toast if `joinCancellationNotice` present |
| `/legacy/join` (packages) | Amber banner with cancellation reason |
| Notifications drawer | `LEGACY_JOIN_CANCELLED` mapped to **system** category |

---

## 8. QA checklist

- [ ] Admin can cancel `PENDING_JOIN` user; member disappears from pending state in admin list
- [ ] Active member cancel → `409`
- [ ] User on pay screen receives toast within one poll interval (15s) or on refresh
- [ ] User receives in-app + socket notification when online
- [ ] `POST /legacy/join/start` works again after cancel
- [ ] Pending manual JOIN payment rejected/cancelled in admin payments queue
- [ ] Sponsor lookup no longer returns `pending` for cancelled user

---

## 9. Related docs

- [ADMIN_REMAINING.md](./ADMIN_REMAINING.md)
- [phase-1-backend.md](./phase-1-backend.md) — join / `PENDING_JOIN`
- Admin payment reject: `POST /admin/legacy/payments/:id/reject`
