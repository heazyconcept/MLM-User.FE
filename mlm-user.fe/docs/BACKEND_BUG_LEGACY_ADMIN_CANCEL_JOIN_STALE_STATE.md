# Backend Bug: Admin cancel join leaves stale state for Successline register

**Date:** 2026-09-28  
**From:** User FE + Admin FE  
**Status:** Open  
**Severity:** High  
**Area:** `POST /admin/legacy/members/:userId/cancel-join`, `GET /legacy/members/lookup`, `POST /legacy/successlines/register`

---

## Summary

After an admin **cancels** a user's pending Legacy join (`PENDING_JOIN`), a sponsor can **look up** that username and see **"Ready — @user can join under you"**, but **Register & pay** fails with:

- `ALREADY_IN_LEGACY` — *That member is already in Legacy Club.*  
- or `ALREADY_PENDING` — *That member already started joining Legacy Club. They must finish or cancel first.*

**Lookup and register disagree on membership state.** The cancelled user cannot be re-registered via sponsor-paid Successline flow.

---

## Reproduction (reported: @heazy)

1. User **@heazy** had `PENDING_JOIN` Legacy membership.
2. Admin cancelled via **Cancel registration** (`POST /admin/legacy/members/:userId/cancel-join`).
3. Active Legacy member **@Ayomide** opens **Register a Successline** → looks up **`heazy`**.
4. **Lookup:** green — *Ready — @heazy can join under you.*
5. **Register & pay:** red — already in Legacy / already started joining.

Screenshots show both outcomes on the same flow.

---

## Expected behaviour

After successful admin cancel ([ADMIN_CANCEL_PENDING_JOIN.md](../legacy-club%20update/ADMIN_CANCEL_PENDING_JOIN.md)):

| Check | Expected |
|---|---|
| `GET /legacy/me` (as target user) | `status: "NONE"`, no `pendingJoin` / `pendingPayment` |
| `GET /admin/legacy/members/:userId` | User **absent** from members list OR not `PENDING_JOIN` / `ACTIVE` |
| `GET /legacy/members/lookup?username=heazy` | `legacyStatus: "NONE"`, eligible for sponsor register |
| `POST /legacy/successlines/register` | **200** — creates ACTIVE membership under payer |

Lookup and register **must use the same source of truth** for `legacyStatus`.

---

## Likely root cause

Admin cancel clears state for **lookup** (or admin list) but **not** for the guard inside **`POST /legacy/successlines/register`**, e.g.:

- Membership row still `PENDING_JOIN` or `ACTIVE` while lookup reads a cached/different field
- Orphan `LegacyMembership` row not reset to `NONE` / not deleted
- Join intent / draft order / payment row still blocks register
- Separate "prospective member" cache not invalidated on cancel

---

## Backend fix checklist

When `cancel-join` succeeds, ensure **atomically**:

1. Membership `status` → **`NONE`** (or row removed); clear package/sponsor/join fields
2. Reject/close any `PENDING` JOIN payments for that user
3. Clear draft Legacy cart / join order linkage
4. Remove reserved Successline placement
5. **`GET /legacy/members/lookup`** and **`POST /legacy/successlines/register`** read the **same** membership status after cancel
6. Target user's `GET /legacy/me` → `status: "NONE"` (with optional `joinCancellationNotice`)

---

## QA matrix (after fix)

| Step | Result |
|---|---|
| Cancel `PENDING_JOIN` for @heazy | Admin 200, member list no longer pending |
| Lookup as sponsor | `legacyStatus: NONE`, UI "Ready" |
| Register & pay | 200, @heazy ACTIVE under sponsor |
| Lookup again | `legacyStatus: ACTIVE`, "already in Legacy Club" |

---

## Related docs

- [ADMIN_CANCEL_PENDING_JOIN.md](../legacy-club%20update/ADMIN_CANCEL_PENDING_JOIN.md)
- [BACKEND_BUG_LEGACY_SPONSOR_REGISTER_DOWNLINE_VS_REFERRAL.md](./BACKEND_BUG_LEGACY_SPONSOR_REGISTER_DOWNLINE_VS_REFERRAL.md)
