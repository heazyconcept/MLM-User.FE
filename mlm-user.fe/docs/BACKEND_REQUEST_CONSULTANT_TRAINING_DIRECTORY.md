# Backend Request — Consultant Training Schedule & Public Directory

**Date:** 2026-07-16  
**From:** User FE (`mlm-user.fe`)  
**Status:** Request for backend change (FE form + directory page blocked until contract lands)  
**Severity:** Medium  
**Area:** Business Consultant programme

**Related frontend (current):**

- `src/app/services/consultant.service.ts` — `ConsultantApplication`, `ApplyConsultantBody`
- `src/app/pages/consultant/consultant.component.*` — authenticated apply / status / earnings UI

---

## Summary

Product needs two related backend capabilities:

1. **Training days and times** on the Business Consultant application (write + read).
2. **Automatic website directory** of Admin-approved seminar centres showing name, address, phone, and training schedule.

Today the FE can only submit/read centre identity fields. There is no training schedule on apply/`me`, and no list endpoint for approved centres that a website or future Consultant directory page can consume.

This document defines the API contract FE will implement later. **No FE UI work is in scope for this request.**

---

## Product requirements

| # | Requirement |
|---|-------------|
| 1 | Applicant can provide **Days of Training** and **Days and Time** on the apply form. |
| 2 | Any consultant **approved by Admin** must appear automatically on the website / Consultant directory (no separate “publish” toggle). |
| 3 | Directory cards must show: **Seminar Centre name**, **address**, **phone number**, **training days and times**. |
| 4 | Revoked / rejected consultants must **not** appear in the directory. |

---

## Current FE contract (baseline)

Authenticated endpoints already used by `ConsultantService`:

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/consultants/eligibility` | Eligibility + status hints |
| `GET` | `/consultants/me` | Current user’s application |
| `POST` | `/consultants/apply` | Submit / reapply |

### Current `ApplyConsultantBody` / application fields

```typescript
// Existing FE types — keep these names; only extend them
seminarCentreName: string;           // required
seminarCentreAddress?: string;
seminarCentreCity?: string;
seminarCentreState?: string;
phoneNumber?: string;
applicantNotes?: string;
```

### Current `ConsultantApplication` (read)

Same centre fields as above, plus:

- `id`, `userId`, `status` (`PENDING` \| `APPROVED` \| `REJECTED` \| `REVOKED`)
- `appliedAt`, `reviewedAt`, `rejectionReason`, `grantedByAdmin`
- `isStage1Complete`, `effectiveRankingLevel`, `createdAt`, `updatedAt`

### Gaps

- No `trainingSchedule` (or equivalent) on apply or `GET /consultants/me`.
- No public / directory listing of approved seminar centres.
- Admin-granted consultants (`grantedByAdmin: true`) have no documented path to attach a training schedule for directory display.

---

## A. Extend application write + read

### A1. Shared type: `TrainingScheduleSlot`

Prefer **structured multi-slot** data so the future Consultant page can format and filter consistently. Free-text is acceptable only as a temporary fallback if structure cannot ship soon (see § Fallback).

```typescript
type DayOfWeek =
  | 'MONDAY'
  | 'TUESDAY'
  | 'WEDNESDAY'
  | 'THURSDAY'
  | 'FRIDAY'
  | 'SATURDAY'
  | 'SUNDAY';

interface TrainingScheduleSlot {
  dayOfWeek: DayOfWeek;
  /** Local centre time, 24h `HH:mm` (e.g. `"10:00"`). */
  startTime: string;
  /** Local centre time, 24h `HH:mm` (e.g. `"14:00"`). Must be after `startTime`. */
  endTime: string;
}
```

Timezone assumption for display: **Africa/Lagos (WAT)** unless backend documents otherwise. Do not send timezone per slot unless multi-region is already supported.

### A2. `POST /consultants/apply` (and reapply)

**Extend body** (additive; keep existing field names):

```json
{
  "seminarCentreName": "Lagos Training Hub",
  "seminarCentreAddress": "12 Example Road, Ikeja",
  "seminarCentreCity": "Lagos",
  "seminarCentreState": "Lagos",
  "phoneNumber": "08012345678",
  "applicantNotes": "Optional notes",
  "trainingSchedule": [
    { "dayOfWeek": "SATURDAY", "startTime": "10:00", "endTime": "14:00" },
    { "dayOfWeek": "WEDNESDAY", "startTime": "16:00", "endTime": "18:00" }
  ]
}
```

**Validation (requested):**

| Rule | Expected behaviour |
|------|--------------------|
| At least one slot | `400` if `trainingSchedule` missing or empty on apply/reapply |
| Max slots | Cap at **7** (one per weekday) unless product asks otherwise |
| `dayOfWeek` | Must be one of the enum values above |
| Duplicate days | Prefer reject duplicate `dayOfWeek` in one payload (`400`) |
| Time format | `HH:mm`, 24-hour |
| Ordering | `endTime` strictly after `startTime` |
| Existing centre fields | Unchanged rules for name / address / phone |

**Response:** return full `ConsultantApplication` including `trainingSchedule`.

### A3. `GET /consultants/me`

Echo `trainingSchedule` on the application object (same shape as write).

Example fragment:

```json
{
  "id": "uuid",
  "status": "PENDING",
  "seminarCentreName": "Lagos Training Hub",
  "seminarCentreAddress": "12 Example Road, Ikeja",
  "seminarCentreCity": "Lagos",
  "seminarCentreState": "Lagos",
  "phoneNumber": "08012345678",
  "trainingSchedule": [
    { "dayOfWeek": "SATURDAY", "startTime": "10:00", "endTime": "14:00" }
  ]
}
```

### A4. Admin-granted consultants

When `grantedByAdmin === true` (or Admin creates an approved consultant without a member apply flow), backend must still allow storing:

- `seminarCentreName`, address fields, `phoneNumber`
- `trainingSchedule`

Otherwise those centres cannot appear correctly on the directory. Prefer Admin tools writing the same fields, or expose `PATCH /consultants/me` for approved members to complete missing public details (see § C).

### A5. Fallback (only if structured schedule is delayed)

If structure cannot ship immediately, accept a single string:

```json
{ "trainingDaysAndTime": "Saturdays 10:00–14:00; Wednesdays 16:00–18:00" }
```

FE strongly prefers **`trainingSchedule[]`**. If both exist temporarily, directory and apply forms should treat `trainingSchedule` as canonical.

---

## B. Public / website directory listing

### B1. New endpoint

**Suggested:** `GET /consultants/public`

Alternate names are fine if consistent with existing conventions (e.g. `/consultants/directory`), as long as behaviour matches this section.

### B2. Auth

- Must be callable by the **public marketing website** (and later by the member portal directory page).
- Prefer **no auth** (same pattern as other public discovery endpoints).
- If auth is required, document the exact scheme; do not reuse member-only cookies without a public token path.

### B3. Inclusion rules (auto-publish)

| Condition | In directory? |
|-----------|----------------|
| `status === APPROVED` | **Yes** (immediately after Admin approval) |
| `PENDING` | No |
| `REJECTED` | No |
| `REVOKED` | No |
| Extra “published” flag | **Not required** — approval = published |

No manual publish step after Admin approval.

### B4. Safe public response shape

**Do expose (per item):**

```typescript
interface PublicConsultantCentre {
  id: string; // public application / centre id (stable for listing keys)
  seminarCentreName: string;
  seminarCentreAddress?: string | null;
  seminarCentreCity?: string | null;
  seminarCentreState?: string | null;
  phoneNumber?: string | null;
  trainingSchedule: TrainingScheduleSlot[];
}
```

**Do not expose:**

- `userId`
- `applicantNotes`
- `rejectionReason`
- `reviewedAt` / admin actor ids
- earnings or wallet data
- eligibility / ranking internals

### B5. Response envelope

Prefer one of:

```json
{
  "items": [
    {
      "id": "uuid",
      "seminarCentreName": "Lagos Training Hub",
      "seminarCentreAddress": "12 Example Road, Ikeja",
      "seminarCentreCity": "Lagos",
      "seminarCentreState": "Lagos",
      "phoneNumber": "08012345678",
      "trainingSchedule": [
        { "dayOfWeek": "SATURDAY", "startTime": "10:00", "endTime": "14:00" }
      ]
    }
  ],
  "total": 1,
  "limit": 20,
  "offset": 0
}
```

Or a bare array `[]` if pagination is deferred. Empty result: **`200` with empty list**, never `404`.

### B6. Optional query params

| Param | Purpose |
|-------|---------|
| `state` | Filter by `seminarCentreState` |
| `city` | Filter by `seminarCentreCity` |
| `search` | Case-insensitive match on centre name (and optionally city) |
| `limit` / `offset` (or cursor) | Pagination |

**Sort:** stable default — e.g. `seminarCentreName` ascending, then `id`.

---

## C. Behavioural rules after approval

1. **Approve → listable:** Next `GET /consultants/public` includes the centre.
2. **Revoke / reject → delisted:** Centre disappears from the directory on the next fetch.
3. **Keeping directory data fresh (recommended):**  
   Add `PATCH /consultants/me` for `status === APPROVED` members to update centre contact fields and `trainingSchedule` without re-applying.  
   If PATCH is not available, document how approved centres update address/phone/schedule (Admin-only edit is acceptable short-term).
4. **Incomplete public cards:** If approved but missing phone or schedule, still list the centre, but FE will show “Contact details incomplete” / hide empty rows. Prefer requiring schedule + phone before approval when possible.

---

## D. Acceptance criteria (backend)

- [ ] `POST /consultants/apply` accepts and persists `trainingSchedule` with validation above.
- [ ] `GET /consultants/me` returns `trainingSchedule`.
- [ ] Admin approval of an application causes that centre to appear on `GET /consultants/public` without a publish flag.
- [ ] `GET /consultants/public` returns only `APPROVED` centres.
- [ ] Public payload includes `seminarCentreName`, address fields, `phoneNumber`, `trainingSchedule`.
- [ ] Public payload omits `userId`, notes, rejection, and earnings fields.
- [ ] Empty directory returns `200` + empty list.
- [ ] Revoking an approved consultant removes them from the directory.
- [ ] Admin-granted consultants can carry the same public fields and appear when `APPROVED`.

---

## E. Frontend follow-up (out of scope for this MD)

After backend ships:

1. Extend apply form with training day/time slots (`ApplyConsultantBody.trainingSchedule`).
2. Show schedule on authenticated consultant status / approved views.
3. New Consultant directory page (member portal and/or marketing site) consuming `GET /consultants/public`.

---

## F. Field-name alignment note for FE

Keep existing camelCase names already used by FE so adoption is additive:

| Concept | Canonical field |
|---------|-----------------|
| Centre name | `seminarCentreName` |
| Address | `seminarCentreAddress` |
| City | `seminarCentreCity` |
| State | `seminarCentreState` |
| Phone | `phoneNumber` |
| Training slots | `trainingSchedule` |
| Slot day | `dayOfWeek` |
| Slot times | `startTime`, `endTime` |

Avoid renaming to snake_case in JSON unless the rest of the consultants API already dual-maps both; FE can map snake_case if needed, but camelCase matches current client types.
