# Backend Request — Direct Referral Counts (Registered vs Paid DR)

**Date:** 2026-09-03  
**From:** User FE (`mlm-user.fe`)  
**Status:** Shipped (backend 2026-09-04) — ready for FE verification  
**Severity:** High  
**Area:** Dashboard overview, referral stats, direct referrals list

**Client confirmation (2026-09-03, WhatsApp):** Yes — there should be a separate column for Registered / Active / Inactive. Registered (unpaid) members must **not** appear in the dashboard Direct Successlines count.

**Related FE (updated, waiting on API):**

- Dashboard: [`dashboard.component.ts`](../src/app/pages/dashboard/dashboard.component.ts)
- Network overview: [`network-overview.component.html`](../src/app/pages/network/overview/network-overview.component.html)
- Direct referrals page: [`direct-referrals.component.ts`](../src/app/pages/network/direct-referrals/direct-referrals.component.ts)
- Services: [`dashboard.service.ts`](../src/app/services/dashboard.service.ts), [`referral.service.ts`](../src/app/services/referral.service.ts)
- Status rules reference: [`frontend-integration-downlines-status.md`](../frontend-integration-downlines-status.md)

---

## 1. Summary

Dashboard **Direct Successlines** currently counts **everyone** the user personally sponsored (`referredById`), including people who **registered but have not paid**. **Total Downlines** correctly counts only **paid** members in the matrix tree.

This causes impossible dashboard states — for example account **Lingzju Global 1**:

| Metric | Current (wrong) | Expected |
|--------|-----------------|----------|
| Direct Successlines | 9 | **3** (paid only) |
| Total Downlines | 3 | 3 (unchanged) |
| Unpaid sign-ups in DR list | 6 visible | 6 visible (keep in list) |

**Business rule:** Unpaid registrations are **direct referrals** for tracking purposes, but they must **not** count toward dashboard/network Direct Successlines until they pay. The frontend needs separate counts for **Registered**, **Active**, and **Inactive** direct referrals.

---

## 2. Reproduction steps

1. Log in as a sponsor who shared their link and has multiple sign-ups (some unpaid).
2. Call `GET /dashboard/overview` — note `stats.directSuccesslines` vs `stats.totalDownlines`.
3. Call `GET /referrals/me/direct-referrals` — note rows where `status === "REGISTERED"` and `isRegistrationPaid === false`.
4. Compare counts.

**Expected after fix:** `directSuccesslines` equals the number of **paid** direct referrals only, and should not exceed `totalDownlines` in typical cases like Lingzju.

---

## 3. Root cause

| Endpoint | Field | Current logic | Problem |
|----------|-------|---------------|---------|
| `GET /dashboard/overview` | `stats.directSuccesslines` | Counts all `referredById` users | Includes unpaid registrations |
| `GET /dashboard/overview` | `stats.totalDownlines` | Counts paid matrix descendants | Correct |
| `GET /referrals/me/stats` | `totalDirectReferrals` | All sponsored users | OK to keep, but FE needs paid breakdown |
| `GET /referrals/me/stats` | `isLeader` | Based on all DR count | Should use **paid** DR count ≥ 3 |

---

## 4. Terminology (client vs API)

The client uses everyday labels that map to existing MLM `status` values on each DR row:

| Client label | API `status` | Rule |
|--------------|--------------|------|
| **Registered** | `REGISTERED` | `isRegistrationPaid === false` |
| **Inactive** | `INACTIVE` | Paid + fewer than 3 own direct referrals |
| **Active** | `ACTIVE` | Paid + 3 or more own direct referrals |

**Important naming note:** The existing field `totalActiveDirectReferrals` in `GET /referrals/me/direct-referrals` currently means **paid/activated registration**, not MLM Active. Do **not** reuse that name for MLM Active. Use explicit names such as `totalMlmActiveDirectReferrals`.

Per-row `status` on the DR list is already correct. This request is about **aggregate counts** on dashboard and summary endpoints.

---

## 5. Required API changes

### 5.1 `GET /dashboard/overview`

**Fix existing field:**

- `stats.directSuccesslines` → count of **paid** direct referrals only (`isRegistrationPaid === true`).

**Add new fields (additive, non-breaking):**

```json
{
  "currency": "NGN",
  "hero": { "totalWalletBalance": 0, "voucherBalance": 0, "autoshipBalance": 0 },
  "stats": {
    "cashoutBalance": 0,
    "totalEarnings": 0,
    "totalPayout": 0,
    "productVoucher": 0,
    "totalDownlines": 3,
    "totalCpvs": 0,
    "directSuccesslines": 3,
    "registeredDirectReferrals": 6,
    "activeDirectReferrals": 0,
    "inactiveDirectReferrals": 3
  }
}
```

| Field | Type | Required | Meaning |
|-------|------|----------|---------|
| `directSuccesslines` | number | yes | Paid DR count — **excludes** unpaid registrations |
| `registeredDirectReferrals` | number | yes | Unpaid DR count |
| `activeDirectReferrals` | number | yes | Paid DR with MLM status ACTIVE (≥ 3 own DR) |
| `inactiveDirectReferrals` | number | yes | Paid DR with MLM status INACTIVE (< 3 own DR) |

**Invariant:** `directSuccesslines === activeDirectReferrals + inactiveDirectReferrals` (plus any legacy `ACTIVATED` rows if they exist in your status resolver).

---

### 5.2 `GET /referrals/me/stats`

Keep `totalDirectReferrals` as **all** sponsored users (backward compatible). Add explicit breakdown fields:

```json
{
  "teamSize": 3,
  "totalDirectReferrals": 9,
  "totalPaidDirectReferrals": 3,
  "totalRegisteredDirectReferrals": 6,
  "totalMlmActiveDirectReferrals": 0,
  "totalMlmInactiveDirectReferrals": 3,
  "totalActiveDirectReferrals": 3,
  "isLeader": true,
  "totalLeaders": 0
}
```

| Field | Type | Required | Meaning |
|-------|------|----------|---------|
| `totalDirectReferrals` | number | yes | All users with `referredById = me` (unchanged) |
| `totalPaidDirectReferrals` | number | yes | Same as corrected `directSuccesslines` |
| `totalRegisteredDirectReferrals` | number | yes | Unpaid DR |
| `totalMlmActiveDirectReferrals` | number | yes | Paid + ≥ 3 own DR |
| `totalMlmInactiveDirectReferrals` | number | yes | Paid + < 3 own DR |
| `totalActiveDirectReferrals` | number | yes | Keep as alias for paid count (existing consumers) |
| `isLeader` | boolean | yes | **Change:** `totalPaidDirectReferrals >= 3` |

**Invariant:** `totalRegisteredDirectReferrals + totalPaidDirectReferrals === totalDirectReferrals`.

---

### 5.3 `GET /referrals/me/direct-referrals` → `data.summary`

Extend the summary block. The **list must still return all rows** (registered + paid) — do not filter unpaid users out of `directReferrals[]`.

```json
{
  "status": "success",
  "data": {
    "sponsorUserId": "uuid",
    "sponsorUsername": "lingzju_global_1",
    "summary": {
      "totalDirectReferrals": 9,
      "totalActiveDirectReferrals": 3,
      "totalRegisteredDirectReferrals": 6,
      "totalMlmActiveDirectReferrals": 0,
      "totalMlmInactiveDirectReferrals": 3,
      "isLeader": true
    },
    "pagination": { "totalRecords": 9, "currentPage": 1, "totalPages": 1, "hasNextPage": false, "hasPreviousPage": false },
    "directReferrals": []
  }
}
```

| Summary field | Meaning |
|---------------|---------|
| `totalDirectReferrals` | All sponsored users (all pages) |
| `totalActiveDirectReferrals` | Paid DR count |
| `totalRegisteredDirectReferrals` | Unpaid DR count |
| `totalMlmActiveDirectReferrals` | Paid + ≥ 3 own DR |
| `totalMlmInactiveDirectReferrals` | Paid + < 3 own DR |
| `isLeader` | `totalActiveDirectReferrals >= 3` |

**Optional enhancement:** Add `?status=REGISTERED|ACTIVE|INACTIVE` query param for server-side filtering when paginating.

---

## 6. Suggested backend implementation

Compute all DR summary counts in one pass over users where `referredById = sponsorId`:

1. If `isRegistrationPaid === false` → increment `registered`
2. If paid and own referral count ≥ 3 → increment `mlmActive`
3. If paid and own referral count < 3 → increment `mlmInactive`
4. `paid = mlmActive + mlmInactive` (+ legacy ACTIVATED if applicable)
5. `total = registered + paid`

Use the same MLM status threshold as admin user management: **3 direct referrals** for ACTIVE vs INACTIVE.

---

## 7. What the frontend will do after deployment

| Screen | Behavior |
|--------|----------|
| Dashboard | Direct Successlines card uses `stats.directSuccesslines` (paid only). New cards for Registered / Active DR / Inactive DR. |
| Network overview | Direct successlines tile uses `totalPaidDirectReferrals`. Separate tiles for registered, active, inactive. |
| My Direct Referrals | Summary stat row + status filter tabs. Unpaid users remain visible in the table with `REGISTERED` badge. |

Until the API ships, the frontend falls back where possible (e.g. `totalActiveDirectReferrals` as paid count on network stats).

---

## 8. Acceptance criteria

- [x] `GET /dashboard/overview`: `directSuccesslines` counts **paid DR only** — Lingzju fixture returns `3`, not `9`.
- [x] `registeredDirectReferrals + directSuccesslines === total sponsored DR count` for any sponsor.
- [x] `activeDirectReferrals + inactiveDirectReferrals === directSuccesslines` (among paid DR).
- [x] Unpaid users still appear in `GET /referrals/me/direct-referrals` list with `status: "REGISTERED"`.
- [x] `isLeader` is true only when **paid** DR count ≥ 3, not when unpaid sign-ups inflate the total.
- [x] Direct Successlines no longer exceeds Total Downlines for Lingzju Global 1 (3 vs 3).

---

## 9. Test fixture — Lingzju Global 1

Use this as a regression test case:

| Category | Count |
|----------|-------|
| Total sponsored (`referredById`) | 9 |
| Registered (unpaid) | 6 |
| Paid (Direct Successlines) | 3 |
| MLM Active (paid, ≥ 3 own DR) | 0 |
| MLM Inactive (paid, < 3 own DR) | 3 |
| Total Downlines (matrix tree) | 3 |

**After fix:**

```json
{
  "stats": {
    "directSuccesslines": 3,
    "registeredDirectReferrals": 6,
    "activeDirectReferrals": 0,
    "inactiveDirectReferrals": 3,
    "totalDownlines": 3
  }
}
```

---

## 10. Changelog

| Date | Author | Change |
|------|--------|--------|
| 2026-09-03 | User FE | Initial request — client video + WhatsApp confirmation |
| 2026-09-04 | Backend | Shipped per HerbApi Febugs doc — paid-only counts + breakdown fields |
