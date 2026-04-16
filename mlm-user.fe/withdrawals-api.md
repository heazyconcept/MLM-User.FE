## Withdrawals API – Frontend Integration

### Overview

User-facing withdrawals endpoints under the `/withdrawals` namespace.  
All require a valid Bearer JWT; only users with a fully paid registration and who pass withdrawal-eligibility checks can request withdrawals.

---

## POST `/withdrawals/request`

### Endpoint Overview
Request a withdrawal from the user’s own wallet.

The backend:
- Validates that the user is authenticated (`JwtAuthGuard`).
- Ensures registration is paid (`RegistrationPaidGuard`).
- Runs additional eligibility rules (`WithdrawalEligibilityGuard` – e.g. minimum balance, frequency rules).

### HTTP Method
**POST**

### URL Path
`/withdrawals/request`

### Authentication
**Required** – Bearer JWT for a registered, eligible user.

### Request Headers
- **Authorization**: `Bearer <access_token>`
- **Content-Type**: `application/json`

### Request Body

**Schema (`CreateWithdrawalDto`)**

```json
{
  "amount": 100.0
}
```

- `amount` (number, required):  
  - Must be a number.  
  - Minimum value is `0.01`.  

### Response Format

On success, returns a `WithdrawalResponseDto` representing the created withdrawal.

**Success 201**

```json
{
  "id": "wd_123",
  "userId": "user_123",
  "walletId": "wallet_123",
  "amount": 100,
  "baseAmount": 100,
  "currency": "USD",
  "status": "PENDING",
  "reason": null,
  "payoutReference": null,
  "approvedAt": null,
  "paidAt": null,
  "rejectedAt": null,
  "approvedById": null,
  "rejectedById": null,
  "paidById": null,
  "createdAt": "2024-01-01T00:00:00.000Z"
}
```

*(Exact values depend on your configuration and currency; this is a representative shape.)*

### Error Responses
- **400** – Invalid body (e.g. `amount` missing, not a number, or `< 0.01`).
- **401** – Missing or invalid token.
- **403** – User is not eligible (registration not paid or fails `WithdrawalEligibilityGuard` checks).
- **409 / 422** (implementation‑dependent) – Possible business-rule violations like insufficient balance.

### Frontend Integration Notes
- Always validate `amount` client-side (numeric, positive, above your UI’s minimum) before sending.
- Show clear error messages when a 403 is returned (e.g. “You’re not yet eligible to withdraw.”).
- After a successful request, redirect the user to their withdrawals list or detail page using the returned `id`.

### Example Request (Axios)

```ts
import axios from 'axios';

await axios.post(
  '/withdrawals/request',
  { amount: 100 },
  {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
  }
);
```

---

## GET `/withdrawals`

### Endpoint Overview
List the authenticated user’s withdrawals with simple pagination.

### HTTP Method
**GET**

### URL Path
`/withdrawals`

### Authentication
**Required** – Bearer JWT.

### Request Headers
- **Authorization**: `Bearer <access_token>`

### Query Parameters

- `limit` (number, optional, default `20`):  
  Maximum number of items to return.

- `offset` (number, optional, default `0`):  
  Number of items to skip (for offset-based pagination).

### Request Body
None.

### Response Format

Returns an array of `WithdrawalResponseDto` objects for the current user.

**Success 200**

```json
[
  {
    "id": "wd_123",
    "userId": "user_123",
    "walletId": "wallet_123",
    "amount": 100,
    "baseAmount": 100,
    "currency": "USD",
    "status": "PENDING",
    "reason": null,
    "payoutReference": null,
    "approvedAt": null,
    "paidAt": null,
    "rejectedAt": null,
    "approvedById": null,
    "rejectedById": null,
    "paidById": null,
    "createdAt": "2024-01-01T00:00:00.000Z"
  }
]
```

### Error Responses
- **401** – Missing or invalid token.

### Frontend Integration Notes
- Use `limit` and `offset` to implement “Load more” or standard pagination.
- `status` will typically be one of `"PENDING"`, `"APPROVED"`, `"REJECTED"`, `"PAID"`; map these to user‑friendly labels and colors.
- Use timestamps (`createdAt`, `approvedAt`, `paidAt`, `rejectedAt`) for timelines or history views.

### Example Request (Fetch)

```ts
const res = await fetch('/withdrawals?limit=20&offset=0', {
  headers: {
    Authorization: `Bearer ${accessToken}`,
  },
});

const data = await res.json(); // WithdrawalResponseDto[]
```

---

## GET `/withdrawals/{id}`

### Endpoint Overview
Get details for a single withdrawal belonging to the authenticated user.

The backend ensures that:
- The withdrawal exists.
- It belongs to the current user; otherwise a not‑found/forbidden style error is returned.

### HTTP Method
**GET**

### URL Path
`/withdrawals/{id}`

### Authentication
**Required** – Bearer JWT.

### Request Headers
- **Authorization**: `Bearer <access_token>`

### Path Parameters
- `id` (string, required): The withdrawal ID returned from `/withdrawals/request` or `/withdrawals`.

### Request Body
None.

### Response Format

**Success 200**

```json
{
  "id": "wd_123",
  "userId": "user_123",
  "walletId": "wallet_123",
  "amount": 100,
  "baseAmount": 100,
  "currency": "USD",
  "status": "PAID",
  "reason": null,
  "payoutReference": "BANK-TRX-123456",
  "approvedAt": "2024-01-02T10:00:00.000Z",
  "paidAt": "2024-01-02T11:00:00.000Z",
  "rejectedAt": null,
  "approvedById": "admin_1",
  "rejectedById": null,
  "paidById": "admin_1",
  "createdAt": "2024-01-01T00:00:00.000Z"
}
```

### Error Responses
- **401** – Missing or invalid token.
- **404** – Withdrawal not found for this user (either does not exist or belongs to a different user).

### Frontend Integration Notes
- Use this to power a withdrawal detail screen (e.g. when user clicks from the list).
- Show `reason` if present when status is `"REJECTED"`.
- Show `payoutReference` and `paidAt` when status is `"PAID"` for tracking.

### Example Request (Axios)

```ts
import axios from 'axios';

const res = await axios.get(`/withdrawals/${withdrawalId}`, {
  headers: {
    Authorization: `Bearer ${accessToken}`,
  },
});

const withdrawal = res.data; // WithdrawalResponseDto
```

