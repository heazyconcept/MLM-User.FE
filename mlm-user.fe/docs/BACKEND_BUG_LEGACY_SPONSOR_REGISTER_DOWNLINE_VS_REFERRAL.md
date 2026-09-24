# Backend Bug: Legacy sponsor register uses direct referral instead of downline tree

**Date:** 2026-09-24  
**From:** User FE (`mlm-user.fe`)  
**Status:** Resolved — HerbApi `dev` @ `007652e` (2026-09-24)  
**Severity:** High  
**Area:** `GET /legacy/members/lookup`, `POST /legacy/successlines/register`  
**Related docs:**

- Sponsor register spec: [`BACKEND_REQUEST_LEGACY_SPONSOR_REGISTER_SUCCESSLINE.md`](./BACKEND_REQUEST_LEGACY_SPONSOR_REGISTER_SUCCESSLINE.md)
- FE register modal: [`legacy-home.component.ts`](../src/app/pages/legacy-club/legacy-home/legacy-home.component.ts)
- HerbApi sponsor resolution: `HerbApi/src/modules/legacy-club/legacy-sponsor.util.ts`
- HerbApi downline check: `HerbApi/src/modules/referrals/referrals.repository.ts` → `isUserInDownline()`

---

## Summary

Sponsor-paid Legacy Successline registration blocks upline members who **have the target in their Network Downline List** but are **not the target’s direct Segulah sponsor** (`referredById`).

**Product intent:** Any **ACTIVE Legacy member** who has the target **anywhere in their downline tree** should be able to pay-register that person into Legacy **under themselves** — aligned with the Network **Downline List**, not only **Direct Referral**.

---

## Reproduction (confirmed in production)

### Setup

| Account | Kosi11 in Downline List? | Relationship | Register Kosi11 in Legacy? |
|---|---|---|---|
| **@Dele** | Yes (Level 4) | In tree, **not** direct referral | **Blocked** |
| **@Dele1a** | Yes (Level 2) | **Direct referral** | **Works** |

- **@Dele1a** — ACTIVE Legacy member; **direct Segulah sponsor** of **Kosi11** (`isDirectReferral: true` in Downline List).
- **@Dele** — ACTIVE Legacy member; **Kosi11 appears in Downline List** at Level 4 (`isDirectReferral: false`).

### Steps

1. Impersonate **@Dele** → Legacy home → **Register a Successline**.
2. Look up **`Kosi11`**.

**Actual lookup response:**

```json
{
  "username": "Kosi11",
  "exists": true,
  "isRegistrationPaid": true,
  "legacyStatus": "NONE",
  "canRegisterUnderMe": false,
  "blockCode": "SPONSOR_MUST_BE_AUTO"
}
```

**UI shows:** “Your Segulah sponsor is already in Legacy Club.” (misleading for the payer — see below.)

3. Impersonate **@Dele1a** → same flow → lookup **`Kosi11`** → **Register & pay** succeeds.

Same target user; different outcome based on **direct referral vs indirect downline**.

---

## Root cause

### Network Downline List (what admins/users expect)

Downline membership uses **tree path ancestry** — same helper used for placement validation:

```typescript
// referrals.repository.ts — isUserInDownline
return candidateTree.path.startsWith(`${viewerTree.path}/`);
```

The Downline List also exposes:

```typescript
isDirectReferral: tree.user.referredById === viewerUserId
```

So **@Dele** correctly sees **Kosi11** at Level 4 with `isDirectReferral: false`.

### Legacy sponsor register (current — wrong for product)

`canRegisterUnderMe` on lookup and validation on `POST /legacy/successlines/register` reuse **`resolveLegacySponsor`**, which only considers the **immediate** Segulah sponsor (`referredById`):

```typescript
// legacy-club.service.ts — loadAutoSponsor
if (!user.referredById) return null;
const membership = await findActiveMembershipByUserId(user.referredById);
// if ACTIVE → auto sponsor = direct referrer only
```

When a Legacy member pays to register someone else, the caller’s username is passed as `chosenUsername`. If the target’s **direct referrer** is ACTIVE in Legacy and is **not** the caller → `SPONSOR_MUST_BE_AUTO`.

For **Kosi11:**

- `referredById` = **Dele1a** (direct referral).
- Dele1a is ACTIVE in Legacy → Kosi11’s auto Legacy sponsor = **Dele1a**.
- **Dele** tries to register Kosi11 → backend rejects with `SPONSOR_MUST_BE_AUTO`.
- **Dele** is in Kosi11’s upline tree (Downline List Level 4) but is **not** the direct referrer.

**Mismatch:** Downline List = **tree**; Legacy sponsor register = **direct referral only**.

---

## Expected behavior

When an **ACTIVE Legacy member** pays to register a downline from the dashboard:

1. **Eligibility:** Target must be in the caller’s **downline tree** — reuse `referralsRepository.isUserInDownline(callerId, targetId)` (same rule as Downline List and placement validation).
2. **Legacy placement:** Target joins Legacy **under the payer** (`legacySponsorId` = caller), whether or not the payer is the direct `referredById` sponsor.
3. **Lookup:** Return `canRegisterUnderMe: true` when target is paid, `legacyStatus: NONE`, and target is in caller’s downline.
4. **Block only when:**
   - Target **not** in caller’s downline → `NOT_IN_DOWNLINE`
   - Target already ACTIVE → `ALREADY_IN_LEGACY`
   - Target has unpaid `PENDING_JOIN` → `ALREADY_PENDING`
   - Caller not ACTIVE Legacy → `NOT_LEGACY_MEMBER`
   - Insufficient registration wallet balance → `INSUFFICIENT_BALANCE`

**Do not** apply self-join `SPONSOR_MUST_BE_AUTO` rules to sponsor-paid dashboard registration when the payer is a valid upline in the downline tree.

---

## Suggested backend fix

### `POST /legacy/successlines/register`

For this endpoint only, **do not** use `resolveLegacySponsor` as the gate for “can caller be Legacy sponsor.”

Replace with:

```typescript
const inDownline = await referralsRepository.isUserInDownline(sponsor.id, target.id);
if (!inDownline) {
  throw ApiError.badRequest('NOT_IN_DOWNLINE', 'That member is not in your downline.');
}

// Place under payer
legacySponsorId = sponsor.id;
sponsorSource =
  target.referredById === sponsor.id
    ? LegacySponsorSource.AUTO
    : LegacySponsorSource.CHOSEN;
```

Keep the existing atomic transaction: debit **sponsor** registration wallet, create **ACTIVE** membership, credit instant commission + Successline bonus.

### `GET /legacy/members/lookup` (when caller is ACTIVE Legacy member)

Compute `canRegisterUnderMe` with `isUserInDownline(callerId, targetId)` instead of `resolveLegacySponsor` equality check.

**Eligible example:**

```json
{
  "username": "Kosi11",
  "exists": true,
  "isRegistrationPaid": true,
  "legacyStatus": "NONE",
  "canRegisterUnderMe": true,
  "sponsorSourceIfRegistered": "CHOSEN"
}
```

**Not in downline:**

```json
{
  "canRegisterUnderMe": false,
  "blockCode": "NOT_IN_DOWNLINE"
}
```

Remove `SPONSOR_MUST_BE_AUTO` from sponsor-register lookup for indirect downlines who are still in the payer’s tree.

### Error copy (recommended)

Return payer-facing messages, not joiner-facing copy:

| Code | Message (example) |
|---|---|
| `NOT_IN_DOWNLINE` | That member is not in your downline. |
| `SPONSOR_MUST_BE_AUTO` | *(Remove from sponsor-register path; keep for self-join only)* |

Optionally include `requiredLegacySponsorUsername` when blocking for audit/debug.

---

## Affected endpoints

| Endpoint | Issue |
|---|---|
| `GET /legacy/members/lookup` | `canRegisterUnderMe` uses direct-referral / `resolveLegacySponsor` logic |
| `POST /legacy/successlines/register` | Rejects indirect downlines with `SPONSOR_MUST_BE_AUTO` |

---

## Out of scope (unchanged)

- **Self-serve join** (`POST /legacy/join/start`) may keep existing `resolveLegacySponsor` rules for members joining on their own login.
- Registering users **outside** the caller’s downline tree should remain blocked.

---

## Test plan

1. **@Dele + Kosi11 (indirect downline, Level 4):** lookup `canRegisterUnderMe: true`; register succeeds; Kosi11 ACTIVE under Dele; Dele registration wallet debited; Successline bonus to Dele.
2. **@Dele1a + Kosi11 (direct referral):** still works; Kosi11 ACTIVE under Dele1a when Dele1a registers; `sponsorSource: AUTO`.
3. **Unrelated Legacy member + Kosi11:** `NOT_IN_DOWNLINE`; no membership or ledger rows.
4. **Insufficient balance:** `INSUFFICIENT_BALANCE`; no membership created.
5. **Kosi11 already ACTIVE:** `ALREADY_IN_LEGACY`.

---

## Resolution (HerbApi — shipped)

**Commit:** `007652e` on `dev` — *document backend resolution for downline sponsor registration*

Sponsor-paid register and lookup now use **`referralsRepository.isUserInDownline(callerId, targetId)`** instead of `resolveLegacySponsor` for dashboard registration.

| Change | Detail |
|---|---|
| `POST /legacy/successlines/register` | Eligible when target is anywhere in payer’s downline tree; places under payer via `resolveSponsorRegisterPlacement()` |
| `GET /legacy/members/lookup` | `canRegisterUnderMe: true` when in downline; `blockCode: NOT_IN_DOWNLINE` when not |
| Sponsor source | `AUTO` when `target.referredById === payer.id`; else `CHOSEN` for indirect downlines (e.g. @Dele → Kosi11) |
| Removed from sponsor-register path | `SPONSOR_MUST_BE_AUTO` (kept for self-serve `POST /legacy/join/start` only) |

**HerbApi files:** `legacy-club.service.ts`, `legacy-club.service.sponsor-register.spec.ts`, `legacy-payment.repository.ts`

**Deploy:** Production must run HerbApi ≥ `007652e` for @Dele to register indirect downlines like Kosi11.

---

## Frontend follow-up

- Map `NOT_IN_DOWNLINE` in [`legacy-error.util.ts`](../src/app/core/utils/legacy-error.util.ts) — shipped on FE.
- No change required to Downline List — it already reflects the correct tree relationship.
