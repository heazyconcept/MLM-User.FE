# Withdrawals API – Backend Requirements (Bank Details in Response)

## Context

The frontend integrates with the user-facing Withdrawals API (`POST /withdrawals/request`, `GET /withdrawals`, `GET /withdrawals/{id}`). The **request** body correctly sends only `{ amount }`; bank details are taken from the user profile for display and confirmation. To show which account received (or will receive) the payout in the withdrawal history and detail views, the frontend needs bank payout details in the **response**.

## Request – POST /withdrawals/request

- **Body**: The frontend sends `{ "amount": number }` (min 0.01). This matches the documented contract in `withdrawals-api.md`.
- **Bank details**: Must be **required** on the backend: reject the request (e.g. 400 or 403) if the user does not have bank details on file. The frontend already blocks submission until the user has bank details in their profile.

### Backend bug: 400 "property amount should not exist"

The backend currently returns **400 Bad Request** with:

```json
{
  "statusCode": 400,
  "message": ["property amount should not exist"],
  "error": "Bad Request",
  "path": "/withdrawals/request"
}
```

This indicates the request DTO or validation pipe is **rejecting the `amount` property**. The frontend correctly sends a body like `{ "amount": 100 }`. The backend must **accept** a property named `amount` (number, min 0.01) on POST `/withdrawals/request`. Please fix the backend DTO/validation so that:

- The request body is expected to have an `amount` field (number, required, min 0.01).
- No validation rule forbids or strips the `amount` property.

## Response – required fields

Please include the following **required** fields on `WithdrawalResponseDto` (or equivalent) for **GET /withdrawals** and **GET /withdrawals/{id}** (and, if applicable, the 201 response of **POST /withdrawals/request**):

| Field            | Type   | Required | Description                                      |
|------------------|--------|----------|--------------------------------------------------|
| `bankName`       | string | **Yes**  | Name of the bank where the payout was/will be sent. |
| `accountNumber`  | string | **Yes**  | Masked or full account number (per your policy).   |
| `accountName`    | string | **Yes**  | Account holder name.                               |

- All three fields are **required**. They can be populated from the user’s profile at the time of the withdrawal request or from stored payout bank info when the withdrawal is created or approved.

## Rationale

- **User clarity**: Users can see exactly which account is associated with each withdrawal in list and detail views.
- **Consistency**: Aligns list/detail with the same data the backend uses for the payout.
- **Future use**: Supports future flows (e.g. multiple payout accounts or one-off bank details per request) if you choose to expose them later.

## Frontend behaviour

- The frontend requires the user to have bank details in their profile before allowing a withdrawal request.
- The frontend expects the API to return `bankName`, `accountNumber`, and `accountName` on every withdrawal response; it uses these in the withdrawal history table and on the withdrawal detail page. Until the backend returns them, the frontend falls back to the current user’s profile (or “On file”) for display.
