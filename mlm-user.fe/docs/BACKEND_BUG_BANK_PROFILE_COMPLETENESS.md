# Backend Bug: Bank Saved but Profile Still Incomplete

**Date:** 2026-09-22  
**From:** User FE (`mlm-user.fe`)  
**Status:** Open — backend fix required  
**Severity:** High  
**Area:** `GET /users/me/bank`, `GET /users/me`, checkout profile gate

**Related docs:**

- Original profile-complete spec: [`BACKEND_REQUEST_PROFILE_COMPLETE_FLAG.md`](./BACKEND_REQUEST_PROFILE_COMPLETE_FLAG.md)
- FE reconciliation workaround (client-side only): [`profile-complete.util.ts`](../src/app/core/utils/profile-complete.util.ts)

---

## Summary

After a user saves bank details, **`GET /users/me/bank` returns a valid bank record** (including `accountNumberMasked`) **but still reports**:

- `isProfileComplete: false`
- `profileMissingFields: ["accountNumber"]`

That blocks checkout. The frontend profile gate (`LegacyCheckoutService`, `CartCheckoutService`) reads `isProfileComplete` from cached user state loaded via `GET /users/me` + bank merge. When the backend keeps the flag false despite a saved bank row, users are redirected to `/profile?setup=complete` even though they already added bank details.

This is a **backend completeness calculation bug**, not missing user input.

---

## Observed API response

`GET /users/me/bank` (2026-09-22, production `api.segulah.ng`):

```json
{
  "id": "1b8fa6f4-57ef-4727-b12d-282a832bf7d9",
  "bankName": "GTB bank",
  "accountNumberMasked": "*******9362",
  "accountName": "Paul Test",
  "accountType": "SAVINGS",
  "createdAt": "2026-09-22T20:32:45.695Z",
  "updatedAt": "2026-09-22T20:32:45.695Z",
  "isProfileComplete": false,
  "profileMissingFields": ["accountNumber"],
  "profileCompletionPercentage": 86
}
```

**Contradiction:** Bank exists, account number is stored (masked in response), yet `accountNumber` is listed as missing.

---

## Reproduction

1. Register and activate a user.
2. Complete profile fields (name, phone, address) and save bank details via `PUT /users/me/bank`.
3. Call `GET /users/me/bank`.

**Expected:** `isProfileComplete: true` and/or `profileMissingFields` does not include `accountNumber`.

**Actual:** Bank row is returned with `accountNumberMasked`, but completeness still flags `accountNumber` as missing and `isProfileComplete` stays `false`.

4. Attempt Legacy marketplace checkout or network cart checkout.

**Expected:** Checkout proceeds (or fails only on stock/payment rules).

**Actual:** Frontend shows “Complete your profile” and redirects to `/profile?setup=complete`.

---

## Why checkout blocks

| Layer | Behavior |
|-------|----------|
| `GET /users/me` | May return `isProfileComplete: false` (bank is a separate resource). |
| `GET /users/me/bank` | Returns saved bank + **incorrect** completeness metadata. |
| FE `UserService.fetchProfile()` | Loads both endpoints and merges bank fields locally. |
| FE `needsProfileSetup()` | `true` when `isProfileComplete === false`. |
| FE checkout gate | Blocks before `POST /orders/checkout` when `needsProfileSetup()` is true. |

Bank details live on **`/users/me/bank`**, not on `GET /users/me`. Completeness logic must treat an existing bank row (with account number on file) as satisfying the `accountNumber` requirement. See §4.2 of [`BACKEND_REQUEST_PROFILE_COMPLETE_FLAG.md`](./BACKEND_REQUEST_PROFILE_COMPLETE_FLAG.md).

---

## Expected backend behavior

When computing `isProfileComplete` and `profileMissingFields`:

1. **Join bank resource** — If `users/me/bank` has `bankName`, `accountName`, and an account number on file (full or masked), do **not** include `accountNumber` in `profileMissingFields`.
2. **Consistent across endpoints** — `GET /users/me`, `GET /users/me/bank`, and `PUT /users/me/bank` must return the **same** completeness result after bank save.
3. **After successful `PUT /users/me/bank`** — Recompute completeness immediately. If all required fields (profile + bank) are present, return `isProfileComplete: true` and `profileCompletionPercentage: 100`.
4. **Checkout** — Do not return `PROFILE_INCOMPLETE` for `accountNumber` when bank details exist.

### Correct example after bank save

`GET /users/me/bank`:

```json
{
  "id": "1b8fa6f4-57ef-4727-b12d-282a832bf7d9",
  "bankName": "GTB bank",
  "accountNumberMasked": "*******9362",
  "accountName": "Paul Test",
  "accountType": "SAVINGS",
  "isProfileComplete": true,
  "profileMissingFields": [],
  "profileCompletionPercentage": 100
}
```

`GET /users/me` should reflect the same `isProfileComplete` / `profileMissingFields` (bank fields themselves may remain on the bank endpoint only).

---

## Likely backend cause

Completeness is probably evaluated only against **`users` table columns** (e.g. `user.accountNumber`) and **ignores the separate bank entity** created by `PUT /users/me/bank`. After bank is saved to the bank table, the user row may still have a null `accountNumber`, so the checker keeps reporting `accountNumber` as missing.

---

## Frontend status

The FE has **partial workarounds** (not a substitute for the backend fix):

- [`reconcileProfileCompleteness()`](../src/app/core/utils/profile-complete.util.ts) can treat a locally known full or masked account number as present when `profileMissingFields` includes `accountNumber`.
- [`mergeBankDetails()`](../src/app/services/user.service.ts) copies `accountNumberMasked` into local user state during `fetchProfile()`.

These only help when the FE has refreshed profile state after bank save. They do not fix stale flags if the backend never updates `GET /users/me` or if checkout runs before refresh.

**No further FE workaround is planned unless product asks for one.** The correct fix is backend completeness logic.

---

## Acceptance checklist (backend)

- [ ] User with saved bank on `GET /users/me/bank` is not flagged with `profileMissingFields: ["accountNumber"]`.
- [ ] `isProfileComplete` becomes `true` when name, phone, address, and bank details are all saved.
- [ ] `GET /users/me` and `GET /users/me/bank` agree on completeness after bank save.
- [ ] `PUT /users/me/bank` response includes updated `isProfileComplete` / `profileMissingFields`.
- [ ] `POST /orders/checkout` does not return `PROFILE_INCOMPLETE` for `accountNumber` when bank exists.
- [ ] `profileCompletionPercentage` is `100` iff `isProfileComplete === true`.

---

## Temporary user workaround (until fixed)

1. Log out and log back in (forces `GET /users/me` + bank reload).
2. Open **Profile**, save again, then retry checkout.

If still blocked, backend completeness is still wrong — no client-side action will permanently fix it.
