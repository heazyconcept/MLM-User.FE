# Frontend Integration Update (Matrix, CPV, Notifications)

Date: 2026-05-07

This doc summarizes the latest FE-facing API behavior for:
- Matrix tree view endpoint
- CPV summary breakdown fields
- Notification amount/currency consistency

---

## 1) Matrix Tree View Endpoint

### Endpoint
`GET /referrals/me/matrix`

### Auth
Bearer token required.

### Query params
- `username` (optional, string)
  - If omitted: root is current user.
  - If provided: root becomes that username.

### Access rule for `username`
Provided username must be:
- the current user, or
- a user in current user's downline.

Otherwise:
- `400` with message: `Requested username must be you or in your downline`
- `404` if username does not exist.

### Response behavior
- Returns 13 levels total, including root:
  - `level: 0` = selected root node
  - `level: 1..12` = descendants
- Response always includes `levels` array with 13 entries.

### Response shape
```json
{
  "rootUserId": "uuid",
  "rootUsername": "john_doe",
  "depth": 13,
  "totalUsers": 25,
  "levels": [
    {
      "level": 0,
      "users": [
        {
          "userId": "uuid",
          "username": "john_doe",
          "email": "john@example.com",
          "phone": "080...",
          "isActive": true,
          "isRegistrationPaid": true,
          "createdAt": "2026-05-07T10:48:19.039Z",
          "relativeLevel": 0,
          "parentUsername": null,
          "stageLabel": "Entry level",
          "rank": "Stakeholder"
        }
      ]
    }
  ]
}
```

### New mapping fields per user node
- `parentUsername`: matrix parent username (null for root)
- `stageLabel`: achieved stage label (e.g. `Entry level`, `Stage 1, Level 1`)
- `rank`: achieved rank title (e.g. `Stakeholder`, `Mentor`)

---

## 2) CPV Summary Endpoint Additions

### Endpoint
`GET /earnings/cpv`

### New fields added
- `instantPv`: PV from user registration (personal registration PV)
- `communityPv`: community/matrix registration PV
- `directReferralPv`: PV from direct referral registration
- `totalPv`: `instantPv + communityPv + directReferralPv`

### Notes
- Existing fields are still returned (`totalCpv`, `transactions`, milestones, etc.).
- This is backward-compatible for existing FE consumers.

---

## 3) Notifications Consistency (REST + Socket)

### What FE can now assume
- Notification `message`, `amount`, and `metadata.amount` are aligned in display units.
- NGN users receive NGN-formatted text for amount-bearing notifications.
- Legacy rows are re-rendered at wire-mapping time for consistent display.

### Socket behavior
- `PAYMENT_INITIATED` is persisted but not pushed over websocket (no toast popup).

---

## FE Implementation Checklist

- Use `GET /referrals/me/matrix` for matrix tree rendering.
- Use optional `username` to pivot the tree root.
- Map node chips/cards with:
  - `stageLabel`
  - `rank`
  - `parentUsername`
- For CPV widget/cards, read:
  - `instantPv`, `communityPv`, `directReferralPv`, `totalPv`
- For notifications UI, use returned `message`/`amount` directly (already normalized).

