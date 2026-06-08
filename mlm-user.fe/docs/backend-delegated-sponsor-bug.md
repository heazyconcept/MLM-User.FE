# Bug Report: Backend Rejecting Delegated Sponsor in `POST /referrals/create`

**Date:** May 8, 2026
**Endpoint:** `POST /referrals/create`
**Feature:** Delegated Sponsor Mode (Referral Creation)

## The Issue
The frontend has been updated to support the **Delegated Sponsor Mode** as outlined in the integration documentation. The frontend is correctly capturing the `referralUsername` field and sending it in the JSON payload when a user wants to delegate the direct referral bonus to someone else.

However, the backend is rejecting valid requests where the `referralUsername` differs from the currently authenticated user's identity.

## Request Payload (Sent by Frontend)
```json
{
  "username": "Lumi",
  "password": "Olajesu1974#",
  "package": "SILVER",
  "currency": "NGN",
  "placementParentUsername": "heazy1",
  "referralUsername": "tayo"
}
```

## Error Response (Received from Backend)
```json
{
    "statusCode": 400,
    "message": [
        "referralUsername must identify the authenticated sponsor (your username or referral code)"
    ],
    "error": "Bad Request",
    "timestamp": "2026-05-08T06:51:39.530Z",
    "path": "/referrals/create"
}
```

## Root Cause
The backend DTO validation layer (likely in `CreateReferralDto`) still contains a strict validation rule checking whether the `referralUsername` matches the currently authenticated user. 

Because of this rule, the backend assumes that the logged-in user is trying to fraudulently use someone else's username, completely blocking the intended "Delegated Sponsor" behavior where the payer and the sponsor are explicitly meant to be two different users.

## Expected Backend Fix
Please remove or bypass the validation rule on the `referralUsername` field that enforces it must match the authenticated user's identity. The backend should allow the logged-in user (the payer) to submit a different username in the `referralUsername` field, treating that provided username as the true sponsor/DR owner.
