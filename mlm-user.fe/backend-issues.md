# Backend Issues – Frontend Integration

This document lists issues identified during admin frontend integration. Each item describes the problem, affected endpoints, and the expected behavior for the backend team to fix.

---

## Issue 1: Wallet balance returned in wrong currency for NGN users

### Problem

Wallet endpoints return the `balance` amount in USD (or a converted rate) even when the wallet's `displayCurrency` is NGN. The frontend displays the raw `balance` value with the wallet's `displayCurrency` symbol, which leads to incorrect and confusing display.

**Example:** A user has ₦300,000 NGN in their wallet, but the UI shows ₦30 (or NGN 30) because the backend is returning the USD-equivalent (~30 USD) while `displayCurrency` remains `"NGN"`.

### Affected endpoints

- `GET /admin/wallets` – list response `balance` per wallet
- `GET /admin/wallets/:id` – detail response `balance`
- `GET /admin/wallets/summary` – aggregate balances per wallet type (if applicable)
- Ledger entries: `amount` in `recentLedger` (if ledger amounts are also converted)

### Expected behavior

- `balance` MUST be in the wallet's native/display currency.
- For NGN wallets: return balance in NGN (e.g. `300000` for ₦300,000).
- For USD wallets: return balance in USD.
- Do NOT convert NGN balances to USD when returning. The frontend expects `balance` to match `displayCurrency` for display (e.g. `{{ balance | currency:displayCurrency }}`).

---

## Issue 2: Withdrawal approval and wallet lock state conflict

### Problem

The withdrawal approval flow has contradictory requirements and inconsistent behavior around wallet lock state:

1. **When wallet is locked:** Admin approves a pending withdrawal → API returns:
   ```json
   {
     "message": ["Failed to debit wallet: Wallet is locked and cannot perform this operation"],
     "error": "Bad Request"
   }
   ```
   The approval fails because the wallet is locked.

2. **Side effect:** When the approval fails (due to wallet locked), the wallet is **automatically unlocked** even though the admin did not call the unlock endpoint. This is unexpected.

3. **When wallet is unlocked:** Admin approves a pending withdrawal → API returns:
   ```json
   {
     "message": ["Wallet is not locked"]
   }
   ```
   The approval fails because the wallet is *not* locked.

**Summary:** The backend appears to require the wallet to be locked to approve a withdrawal, but when locked it rejects the debit. When unlocked it also rejects. The workflow is impossible to complete, and failed attempts cause unintended state changes (auto-unlock).

### Affected endpoints

- `POST /admin/withdrawals/:id/approve` (or equivalent approve endpoint)
- Wallet lock/unlock endpoints (behavior may be affected)
- Debit logic used during withdrawal approval

### Expected behavior

- **Clarify the intended workflow:** Does approval require the wallet to be locked or unlocked? The current behavior is contradictory.
- **Fix the logic:** Either:
  - Allow approval when wallet is **unlocked** (so the debit can proceed), and remove the "Wallet is not locked" check; or
  - If approval must happen while locked, ensure the debit/approval logic correctly handles the locked state (e.g. temporary unlock during debit, or a different flow).
- **Do not auto-unlock on failure:** If approval fails, the wallet lock state should remain unchanged. Do not unlock the wallet when the approval request fails.

### Frontend usage

- Withdrawal approval is triggered from the admin withdrawals management UI when an admin approves a pending withdrawal request.

---

## Issue 3: User Management – incomplete integration

### Problem

1. **User list table – full name not displayed:** The user list expects `fullName` (or `firstName` + `lastName`) from the API. If the backend does not return these fields, the table shows "None" for everyone. The frontend maps `fullName` or `firstName`/`lastName` from the API response; when these are missing or empty, the UI cannot display the user's name.

2. **User profile – no dedicated endpoint:** The user profile/detail page (`/admin/users/:id`) requires richer data than the current list endpoint provides:
   - `wallets` (cash, productVoucher, autoship) – currently defaulted to zeros
   - `activityLog` – currently empty
   - `upline` – currently undefined
   - `downlinesCount`, `rank` – derived from API or defaulted

   Either `GET /admin/users/:id` does not exist, or it returns the same minimal shape as the list and does not include profile-specific data (wallets, activity, network). The frontend cannot display a complete user profile without this data.

### Affected endpoints

- `GET /admin/users` – list response should include `fullName` or `firstName` and `lastName` for each user
- `GET /admin/users/:id` – detail/profile response should include:
  - `fullName` (or `firstName`, `lastName`)
  - `wallets` – `{ cash, productVoucher, autoship }` with actual balances
  - `activityLog` – array of activity items (if applicable)
  - `upline` – direct sponsor ID or name
  - `downlinesCount`, `rank` – network stats

### Expected behavior

- **List:** Ensure `GET /admin/users` returns `fullName` or `firstName`/`lastName` for each user so the frontend can display names in the user list table.
- **Profile:** Provide `GET /admin/users/:id` (or equivalent) that returns full profile data including wallets, activity log, upline, and network stats. If the endpoint exists but returns minimal data, extend it to include these fields.

---

## Issue 4: User withdrawal validation uses USD-equivalent for NGN users

### Problem

When a user with an NGN wallet requests a withdrawal, the backend incorrectly treats the balance as USD-equivalent during validation, causing false "insufficient balance" errors.

**Example:**

- User's cash wallet:
  ```json
  "cashWallet": {
      "currency": "NGN",
      "balance": 464773400,
      "status": "ACTIVE"
  }
  ```
- User requests withdrawal of ₦500,000 (500k NGN).
- API returns:
  ```json
  {
    "statusCode": 403,
    "message": [
      "Insufficient balance. Available: 464773.4, Requested: 500000"
    ],
    "error": "Forbidden",
    "timestamp": "2026-03-18T15:41:03.091Z",
    "path": "/withdrawals/request"
  }
  ```

The backend appears to divide the stored balance by 1000 (464773400 → 464773.4) and/or treat it as USD-equivalent when comparing against the requested NGN amount. For NGN users, validation must use the balance in NGN (or the correct minor unit) against the requested NGN amount, not a USD-equivalent.

### Affected endpoints

- `POST /withdrawals/request` – withdrawal validation logic uses wrong unit/currency for NGN wallets
- User wallet endpoints that return `balance` (if same unit mismatch applies)

### Expected behavior

- When validating a withdrawal request, compare the requested amount and available balance in the **same currency** as the wallet.
- For NGN wallets: both must be in NGN (or consistent minor units). Do not use USD-equivalent for NGN users.

### Frontend usage

- User withdrawal request is triggered from the user wallet/withdrawals UI when a user submits a withdrawal request.

---

## Issue 5: Amount inconsistency across earnings, summary, and amount-returning endpoints

### Problem

Amounts returned by the backend are inconsistent for NGN users. Some endpoints return USD (or wrong units) while others return NGN. The same user may see correct amounts in one place and incorrect amounts in another. This affects earnings, summary, and any endpoint that returns monetary amounts.

**Example 1 – Earnings (USD amounts for NGN users):**

```json
{
  "id": "f7f0d084-ee3d-4d0b-acec-9a4f89f00c9c",
  "userId": "2565cbf6-7353-4ee2-a103-9f13c5b2db27",
  "amount": 3,
  "currency": "NGN",
  "type": "BONUS",
  "earningType": "DIRECT_REFERRAL",
  "metadata": {
    "newUserId": "1555bc72-395f-4856-b3bd-97e6ce6a3efa",
    "sponsorPackage": "SILVER",
    "registrationAmount": 30
  },
  "status": "PENDING",
  "createdAt": "2026-03-17T08:21:49.914Z"
}
```

`amount: 3` and `metadata.registrationAmount: 30` are USD amounts despite `currency: "NGN"`. For NGN users, these should be in NGN.

**Example 2 – Summary (mixed units within same response):**

```json
{
  "totalEarned": 715036,
  "cashoutEligible": 464773.4,
  "autoshipBalance": 250262.59999999998,
  "cashoutPercentage": 65,
  "autoshipPercentage": 35,
  "monthlyAutoshipAmountUsd": 10,
  "byType": {
    "RANKING_BONUS": 715000,
    "DIRECT_REFERRAL": 36
  }
}
```

- `totalEarned` and `RANKING_BONUS` appear in one scale.
- `cashoutEligible`, `autoshipBalance`, and `DIRECT_REFERRAL` are clearly wrong (e.g. `DIRECT_REFERRAL: 36` vs `RANKING_BONUS: 715000` suggests USD vs NGN or unit mismatch).
- `autoshipBalance` has floating-point precision issues.

### Affected endpoints

- Earnings endpoints – `amount`, `metadata.registrationAmount`, and any amount fields
- Summary endpoints – `totalEarned`, `cashoutEligible`, `autoshipBalance`, `byType.*`, etc.
- Any endpoint that returns monetary amounts (ledgers, transactions, bonuses, etc.)

### Expected behavior

- **Consistent currency:** For NGN users, all amounts MUST be in NGN. For USD users, all amounts MUST be in USD. Do not mix currencies or units within a response.
- **Consistent units:** Use the same minor unit (e.g. kobo for NGN, cents for USD) across all amount fields, or document the convention clearly.
- **Match `currency` field:** When `currency: "NGN"` is present, amounts must be in NGN, not USD-equivalent.
- **Audit all amount-returning endpoints:** Review earnings, summary, ledgers, transactions, and any other endpoints that return amounts to ensure they follow the same currency/unit rules for the user's wallet.

### Frontend usage

- Earnings are displayed in the user earnings/history UI.
- Summary data is used for dashboard stats, wallet breakdown, and cashout/autoship splits.
- Inconsistent amounts cause incorrect displays and user confusion.

---

## Issue 6: Guest checkout verify – foreign key constraint failed

### Problem

After a guest places an order on the landing page website, the verify endpoint returns a database error instead of completing the checkout flow.

**API response:**

```json
{
  "statusCode": 400,
  "message": [
    "Foreign key constraint failed"
  ],
  "error": "Database Error",
  "timestamp": "2026-03-18T15:57:50.379Z",
  "path": "/shop/checkout/guest/verify"
}
```

The error suggests that when persisting or updating guest checkout/order data, a foreign key reference points to a non-existent or invalid record (e.g. missing order, user, product, or related entity).

### Affected endpoints

- `POST /shop/checkout/guest/verify` (or equivalent guest checkout verify endpoint)

### Expected behavior

- Guest checkout verify should complete successfully when the order and related data are valid.
- If a foreign key constraint fails, the backend should either:
  - Fix the data flow so all referenced entities exist before the verify step; or
  - Return a clearer, user-friendly error instead of exposing the raw database constraint message.
- Investigate which foreign key is failing (order, guest, product, payment, etc.) and ensure the verify flow creates or links all required records in the correct order.

### Frontend usage

- Triggered from the landing page website after a guest completes an order and the verify step runs.
- Blocks guests from completing checkout.

---

## Issue 7: Delete notification endpoint not available

### Problem

Users cannot delete individual notifications. The frontend needs a delete endpoint to allow users to remove notifications from their list (e.g. dismiss or clear unwanted items). This endpoint does not exist.

### Affected endpoints

- `DELETE /notifications/:id` (or equivalent) – endpoint does not exist

### Expected behavior

- Provide `DELETE /notifications/:id` (or `DELETE /notifications/{id}`) to allow users to delete a single notification by ID.
- On success: return 200 or 204.
- On not found: return 404.
- The deleted notification should be removed from the user's notification list and no longer appear in `GET /notifications`.

### Frontend usage

- Delete would be triggered from the notifications list/drawer when a user chooses to delete or dismiss a notification.

---

## How to add more issues

For each new issue, add a section with:

1. **Problem** – Clear description of what is wrong
2. **Affected endpoints** – API routes involved
3. **Expected behavior** – What the backend should return/do
4. **Frontend usage** – Where the frontend uses this (optional, for context)
