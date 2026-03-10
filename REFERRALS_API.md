# Referrals API – Frontend Integration

Base path: `/referrals`  
**Auth:** All endpoints except `POST /referrals/validate` require `Authorization: Bearer <access_token>`.

---

## 1. POST /referrals/validate

**Purpose:** Check whether a referral code exists and is valid. Used during registration so the frontend can show “Valid sponsor” or “Invalid code” before submit. **Public** (no auth).

### Request

- **Method:** `POST`
- **Path:** `/referrals/validate`
- **Headers:** `Content-Type: application/json`
- **Body:**

```json
{
  "referralCode": "ABC123"
}
```

| Field          | Type   | Required | Description        |
|----------------|--------|----------|--------------------|
| `referralCode` | string | yes      | Referral code to validate. Must be non-empty. |

### Response (200)

```json
{
  "valid": true,
  "uplineUserId": "uuid-of-referrer"
}
```

- When the code is **invalid**: `valid` is `false` and `uplineUserId` is omitted.
- When the code is **valid**: `valid` is `true` and `uplineUserId` is the referrer’s user ID (optional to store for registration).

### Frontend usage

- On registration or “invite by code” screen: call before or on submit; show error if `valid === false`, otherwise allow proceeding and optionally send `uplineUserId` or referral code to the registration API.

---

## 2. GET /referrals/me/upline

**Purpose:** Return the current user’s upline chain (people above them in the tree, from direct referrer up to root). Order is from closest (level 1) to root.

### Request

- **Method:** `GET`
- **Path:** `/referrals/me/upline`
- **Headers:** `Authorization: Bearer <access_token>`
- **Query:** none
- **Body:** none

### Response (200)

Array of upline nodes. Each item has:

```json
[
  { "userId": "uuid-1", "level": 1 },
  { "userId": "uuid-2", "level": 2 }
]
```

- `userId`: string (UUID of the upline user).
- `level`: number (depth in the tree; 1 = direct referrer, 2 = referrer’s referrer, etc.).

If the user has no upline (root user), the array is `[]`.

### Frontend usage

- Use to build “My upline” or “Sponsor chain” UI; resolve `userId` to names via `GET /users/me` or a user-lookup if needed (this endpoint does not return names).

---

## 3. GET /referrals/me/downlines

**Purpose:** Return the current user’s downline list (people below them in the tree) with level, package, direct referral count, and team size. Optional depth limit.

### Request

- **Method:** `GET`
- **Path:** `/referrals/me/downlines`
- **Headers:** `Authorization: Bearer <access_token>`
- **Query:**

| Query   | Type   | Required | Description                                      |
|---------|--------|----------|--------------------------------------------------|
| `depth` | number | no       | Max depth to fetch (integer ≥ 1). Omit for all. |

Example: `GET /referrals/me/downlines?depth=3`

- **Body:** none

### Response (200)

Array of downline members:

```json
[
  {
    "id": "uuid",
    "username": "johndoe",
    "email": "john@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "level": 1,
    "package": "SILVER",
    "isActive": true,
    "createdAt": "2025-01-15T10:30:00.000Z",
    "directReferrals": 5,
    "teamSize": 12,
    "profilePhotoUrl": "https://..."
  }
]
```

- `id`: string (user ID).
- `username`, `email`, `firstName`, `lastName`: strings (empty string if null).
- `level`: number (1 = direct referral, 2 = second level, etc.).
- `package`: `"NICKEL"` | `"SILVER"` | `"GOLD"` | `"PLATINUM"` | `"RUBY"` | `"DIAMOND"`.
- `isActive`: boolean.
- `createdAt`: string (ISO 8601).
- `directReferrals`: number (count of this member’s direct referrals).
- `teamSize`: number (total downline count under this member).
- `profilePhotoUrl`: string | undefined.

If the user has no downline, the array is `[]`.

### Frontend usage

- Use for “My team” / “Downline” table or tree; `level` for indentation or grouping, `directReferrals` and `teamSize` for columns.

---

## 4. GET /referrals/me/sponsor

**Purpose:** Return who referred the current user (sponsor by referral code). Distinct from placement parent (matrix position).

### Request

- **Method:** `GET`
- **Path:** `/referrals/me/sponsor`
- **Headers:** `Authorization: Bearer <access_token>`
- **Body:** none

### Response (200)

When the user has a sponsor:

```json
{
  "sponsorId": "uuid",
  "sponsorEmail": "sponsor@example.com",
  "sponsorReferralCode": "CODE123",
  "sponsorLevel": 3
}
```

- `sponsorLevel`: number | undefined (sponsor’s level in the referral tree).

When the user has **no** sponsor (root user): response body is `null` (HTTP 200).

### Frontend usage

- Use for “My sponsor” section; show sponsor email/code and optionally level. Handle `null` for root users.

---

## 5. GET /referrals/me/placement

**Purpose:** Return the current user’s placement in the matrix: the placement parent (node above them in the tree) and their own level/stage.

### Request

- **Method:** `GET`
- **Path:** `/referrals/me/placement`
- **Headers:** `Authorization: Bearer <access_token>`
- **Body:** none

### Response (200)

When the user has a placement parent (not root):

```json
{
  "placementParentId": "uuid",
  "placementParentEmail": "parent@example.com",
  "placementParentReferralCode": "PARENTCODE",
  "placementLevel": 4,
  "placementStage": 2,
  "placementStageName": "Stage 2"
}
```

- `placementLevel`: number (user’s level in the tree).
- `placementStage`: number (derived stage index).
- `placementStageName`: string (human-readable stage name).

When the user is **root** (no placement parent): response body is `null` (HTTP 200).

### Frontend usage

- Use for “My placement” / “Placed under” and for level/stage display. Handle `null` for root users.

---

## 6. GET /referrals/placement-parents

**Purpose:** When the current user (as sponsor) already has 3 direct referrals, return the list of those direct referrals so the frontend can let the sponsor choose who gets the next member (spillover choice). If the sponsor has fewer than 3 direct referrals, the list is empty (no choice needed).

### Request

- **Method:** `GET`
- **Path:** `/referrals/placement-parents`
- **Headers:** `Authorization: Bearer <access_token>`
- **Body:** none

### Response (200)

Array of eligible placement parents (sponsor’s direct referrals), or empty array:

```json
[
  { "userId": "uuid-1", "username": "alice", "email": "alice@example.com" },
  { "userId": "uuid-2", "username": "bob", "email": "bob@example.com" },
  { "userId": "uuid-3", "username": "carol", "email": "carol@example.com" }
]
```

- `userId`: string (use this as `placementParentUserId` when calling `POST /referrals/create`).
- `username`, `email`: strings.

When the sponsor has **fewer than 3** direct referrals: `[]`.

### Frontend usage

- When creating a referral from dashboard, call this first. If the array is non-empty, show a dropdown/radio to “Place under” one of these users and send the selected `userId` as `placementParentUserId` in `POST /referrals/create`. If empty, omit `placementParentUserId`.

---

## 7. POST /referrals/create

**Purpose:** Create a new referral from the dashboard. The new user is created with the given package/currency and linked to the current user as sponsor. Registration fee is debited from the **current user’s registration wallet**. The new user is activated (earnings/CPV eligible). When the sponsor already has 3 direct referrals, the request can optionally specify which of those 3 is the placement parent (spillover).

### Request

- **Method:** `POST`
- **Path:** `/referrals/create`
- **Headers:** `Authorization: Bearer <access_token>`, `Content-Type: application/json`
- **Body:**

```json
{
  "email": "newuser@example.com",
  "username": "newuser",
  "password": "SecurePass123",
  "package": "SILVER",
  "currency": "NGN",
  "placementParentUserId": "uuid-of-one-of-my-direct-referrals"
}
```

| Field                   | Type   | Required | Description |
|-------------------------|--------|----------|-------------|
| `email`                 | string | yes      | Valid email. |
| `username`              | string | yes      | Unique username. |
| `password`              | string | yes      | Min length 8. |
| `package`               | string | yes      | One of: `NICKEL`, `SILVER`, `GOLD`, `PLATINUM`, `RUBY`, `DIAMOND`. |
| `currency`              | string | yes      | `NGN` or `USD`. |
| `placementParentUserId` | string | no       | When sponsor has 3 direct referrals, one of their user IDs from `GET /referrals/placement-parents`. Omit or leave empty when no choice needed. |

### Response (201)

```json
{
  "userId": "uuid-of-new-user",
  "email": "newuser@example.com"
}
```

- Use `userId` and `email` for success message or redirect to the new user’s profile.

### Errors (4xx)

- **400** – Invalid body, duplicate email/username, or **insufficient balance** in the current user’s registration wallet.
- **404** – Current user or referral data not found (e.g. no registration wallet).

### Frontend usage

- Ensure the current user has enough balance in their registration wallet before showing the form. Call `GET /referrals/placement-parents`; if it returns 3 users, show “Place under” and send selected `placementParentUserId`. On success, show the new user’s email/userId and refresh wallet/team data.

---

## Summary for frontend

| Endpoint                      | Auth   | Purpose |
|------------------------------|--------|--------|
| `POST /referrals/validate`   | No     | Validate referral code; get `valid` and optional `uplineUserId`. |
| `GET /referrals/me/upline`   | Bearer | Upline chain: `{ userId, level }[]`. |
| `GET /referrals/me/downlines` | Bearer | Downline list; optional `?depth=N`. Full member info + `directReferrals`, `teamSize`. |
| `GET /referrals/me/sponsor`  | Bearer | Sponsor info or `null`. |
| `GET /referrals/me/placement`| Bearer | Placement parent and level/stage or `null`. |
| `GET /referrals/placement-parents` | Bearer | Eligible placement parents (3 direct referrals) for spillover choice. |
| `POST /referrals/create`     | Bearer | Create referral from dashboard; fee from registration wallet; optional `placementParentUserId`. |

**Package enum:** `NICKEL`, `SILVER`, `GOLD`, `PLATINUM`, `RUBY`, `DIAMOND`  
**Currency enum:** `NGN`, `USD`
