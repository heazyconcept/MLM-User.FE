# Backend request: expose `phone` on member network lists

**Audience:** Backend API team  
**User app:** Network — Direct Referrals, Downline List, Matrix Level, Pending Leaders  
**Date:** 2026-10-26

## Summary

Members must see **phone numbers** (not emails) for people in their network: **direct referrals**, **registered downlines**, and **matrix level** peers. The user app already reads `phone` where the API returns it. **`GET /referrals/me/direct-referrals`** is the reference shape; **`GET /referrals/me/downlines`** must align.

## Direct referrals (already supported)

**Endpoint:** `GET /referrals/me/direct-referrals`

Each item in `data.directReferrals[]` should include `phone` (nullable string). Example:

```json
{
  "id": "fe13c0da-2932-4d08-937f-17c8430ca5f8",
  "username": "paul",
  "email": "odetoyinbopelumi42@gmail.com",
  "phone": "08101435999",
  "firstName": "Paul",
  "lastName": "Test",
  "registrationPackage": "PLATINUM",
  "package": "PLATINUM",
  "isActive": true,
  "isRegistrationPaid": true,
  "status": "INACTIVE",
  "joinDate": "2026-06-03T09:55:41.604Z",
  "directReferralsCount": 0,
  "drRemaining": 3
}
```

The app maps `phone`, `phoneNumber`, or `phone_number` if present.

## Downlines (required backend change)

**Endpoint:** `GET /referrals/me/downlines?depth={n}`

Add the same **`phone`** field on **every downline object** in the response array (same visibility rules as direct referrals — sponsor/upline may view downline contact phone).

### Recommended item shape

Align with direct referrals plus existing downline fields from [frontend-integration-downlines-status.md](../frontend-integration-downlines-status.md):

```json
{
  "id": "fe13c0da-2932-4d08-937f-17c8430ca5f8",
  "username": "paul",
  "email": "odetoyinbopelumi42@gmail.com",
  "phone": "08101435999",
  "firstName": "Paul",
  "lastName": "Test",
  "registrationPackage": "PLATINUM",
  "package": "PLATINUM",
  "level": 2,
  "status": "INACTIVE",
  "isActive": true,
  "isRegistrationPaid": true,
  "directReferralsCount": 0,
  "directReferrals": 0,
  "teamSize": 4,
  "rank": "STAKEHOLDER",
  "stage": "Stage 1, Level 1",
  "isDirectReferral": false,
  "createdAt": "2026-06-03T09:55:41.604Z",
  "profilePhotoUrl": null
}
```

| Field | Required for phone feature | Notes |
|-------|---------------------------|--------|
| `phone` | **Yes** | Primary; use `null` if not on file |
| `phoneNumber` / `phone_number` | Optional aliases | App accepts as fallback |

## Related endpoints (same `phone` field)

For consistent UX, return `phone` on user rows for:

| Endpoint | Purpose |
|----------|---------|
| `GET /referrals/me/matrix-level` | Level N downlines table |
| `GET /referrals/me/downlines/pending-3-dr` | Pending leaders list |

## UI behaviour (frontend)

- Network tables show a **Phone** column; emails are **not** shown on these screens.
- Missing phone displays **—** (no link).
- Non-empty values use a `tel:` link for mobile tap-to-call.

## Privacy / authorization

Confirm product/legal rules: only the **logged-in sponsor/upline** may read downline phones via these routes (same as today for email if exposed). Do not expose phone on public or unauthenticated endpoints.

## OpenAPI

Document `phone` on downline DTOs and add to the empty `GET /referrals/me/downlines` response schema (see [API-downlines-requirements.md](../../docs/API-downlines-requirements.md)).
