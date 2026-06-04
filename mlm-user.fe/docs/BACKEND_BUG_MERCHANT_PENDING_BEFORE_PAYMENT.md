# Backend Bug Report: Merchant Application Marked PENDING Before Payment is Confirmed

Date reported: 2026-05-26
Reported by: Frontend team
Severity: High
Area: Merchant Registration / Merchant Fee Payment

---

## Summary

When a user applies to become a merchant via `POST /merchants/apply`, the backend immediately
creates the merchant record with `status: "PENDING"`. This happens **before** any payment is
initiated or confirmed.

As a result, the admin dashboard shows the applicant as **PENDING** even when:
- The user has not paid the registration fee at all
- The user cancelled the Paystack payment gateway midway
- The wallet payment attempt failed (e.g. insufficient balance)
- The user simply closed the browser after applying

This means admin can mistakenly approve an unpaid application, or the merchant list becomes
polluted with ghost PENDING records that will never be paid.

---

## User Impact

- User fills the application form and clicks submit.
- Backend creates a `PENDING` merchant record immediately.
- User is redirected to pay but fails (insufficient wallet balance) or cancels Paystack.
- User is now stuck — they have a PENDING record with no payment, and cannot re-apply.
- **Admin sees them as PENDING** and may approve them without payment being made.
- No merchant fee is ever collected, but merchant access may be granted.

---

## Reproduction Steps

1. Log in as a regular user who has not yet applied for merchant.
2. Navigate to `/merchant/apply`.
3. Select a merchant tier and service areas.
4. Click **Apply** (or **Apply & Pay** in the updated frontend flow).
5. On the payment step, either:
   - Select a wallet with insufficient balance → payment fails with 400 error.
   - Select Paystack → get redirected → close/cancel the Paystack page without paying.
6. Go to the admin dashboard and check the merchant list.

**Result:** The user appears in the admin merchant list with `status: PENDING` and
`merchantFeePaidAt: null` — even though no payment was ever made.

---

## Actual Behaviour

```
POST /merchants/apply
→ Response: { id: "...", status: "PENDING", merchantFeePaidAt: null }

POST /merchants/merchant-fee/initiate   ← payment attempt
→ Response: { message: "Insufficient balance..." }   ← payment FAILS

Admin GET /merchants  →  user still listed as status: "PENDING"
```

---

## Expected Behaviour

The merchant record should only be visible to admin (i.e. have `status: "PENDING"`) **after**
payment is successfully confirmed.

Before payment is confirmed, the record should carry a distinct `DRAFT` or `PENDING_PAYMENT`
status that:
- Is invisible (filtered out) on the admin merchant list.
- Cannot be approved by admin.
- Can be resumed by the user to complete payment.

```
POST /merchants/apply
→ Response: { id: "...", status: "DRAFT", merchantFeePaidAt: null }

POST /merchants/merchant-fee/verify   ← payment confirmed
→ Backend transitions status: "DRAFT" → "PENDING"

Admin GET /merchants  →  user NOW appears as status: "PENDING"   ✅
```

---

## Frontend Note

The frontend has already been updated to chain `apply()` and `initiateMerchantFeePayment()`
atomically in a single user action ("Apply & Pay" button), minimising the time window between
record creation and payment initiation. However, this **does not solve the root issue**:

- If wallet payment fails → record is already `PENDING` in the DB.
- If Paystack is cancelled → record is already `PENDING` in the DB.
- The frontend has no API to delete or revert an application once created.

The fix **must be implemented on the backend**.

Relevant frontend files (for reference only):
- `src/app/pages/merchant/merchant-apply/merchant-apply.component.ts` — `onApplyAndPay()`
- `src/app/services/merchant.service.ts` — `apply()` and `initiateMerchantFeePayment()`

---

## Suspected Backend Issues

1. `POST /merchants/apply` sets `status = "PENDING"` immediately instead of `"DRAFT"`.
2. There is no intermediate status to represent "applied but not yet paid".
3. The admin merchant list query does not filter by `merchantFeePaidAt IS NOT NULL` or a
   separate status, so unpaid records are surfaced alongside legitimate pending applications.
4. `POST /merchants/merchant-fee/verify` (payment confirmation) does not transition the
   merchant status — it only sets `merchantFeePaidAt`.

---

## Proposed Backend Fix

### 1. Add a new status: `DRAFT` (or `PENDING_PAYMENT`)

Update the merchant status enum:

```
DRAFT            → Applied, payment not yet made (hidden from admin)
PENDING          → Payment confirmed, awaiting admin approval
ACTIVE           → Approved by admin
SUSPENDED        → Suspended by admin
```

### 2. Update `POST /merchants/apply`

Set initial status to `DRAFT` instead of `PENDING`.

```json
// Response after apply (before payment)
{
  "id": "merchant-uuid",
  "status": "DRAFT",
  "merchantFeePaidAt": null
}
```

### 3. Update `POST /merchants/merchant-fee/verify`

On successful payment verification, transition:
```
status: "DRAFT"  →  status: "PENDING"
merchantFeePaidAt: <timestamp>
```

### 4. Update `POST /merchants/merchant-fee/initiate` (wallet payments)

For wallet payment sources (`REGISTRATION_WALLET`, `CASH_WALLET`), payment is synchronous.
On successful debit, transition immediately:
```
status: "DRAFT"  →  status: "PENDING"
merchantFeePaidAt: <timestamp>
```

If payment fails, status **remains `DRAFT`** — admin never sees it.

### 5. Admin merchant list — filter query

Ensure the admin endpoint `GET /admin/merchants` (or equivalent) only returns records where
`status != "DRAFT"`, or equivalently `merchantFeePaidAt IS NOT NULL`.

---

## Minimal Contract Proposal

**`GET /merchants/me` response** — frontend needs to distinguish DRAFT from PENDING:

```json
{
  "id": "string",
  "status": "DRAFT | PENDING | ACTIVE | SUSPENDED",
  "merchantFeePaidAt": "ISO8601 | null",
  "type": "REGIONAL | NATIONAL | GLOBAL",
  "serviceAreas": ["string"]
}
```

**Frontend will use `status === "DRAFT"` to show the "complete payment" UI to the user.**
**`status === "PENDING"` will mean payment done, awaiting admin approval.**

---

## Acceptance Criteria

1. After `POST /merchants/apply`, admin dashboard does **not** show the new applicant.
2. After a **failed** wallet payment, admin dashboard does **not** show the applicant.
3. After a **cancelled** Paystack session, admin dashboard does **not** show the applicant.
4. After a **successful** payment (wallet or Paystack verified), admin dashboard **does** show
   the applicant with `status: PENDING`.
5. `GET /merchants/me` returns `status: "DRAFT"` for unpaid applications so the frontend
   can show the correct "complete payment" UI to the user.
6. Admin cannot approve a merchant whose `status` is `DRAFT`.

---

## Notes

- The frontend flag `merchantFeePaidAt` already exists on the profile response and is used
  to distinguish "payment done" from "payment not done". This can serve as a migration-safe
  interim filter for the admin list while the new status is being implemented.
- An alternative to a new enum value is to simply filter the admin list by
  `merchantFeePaidAt IS NOT NULL` — this requires no schema change to the status enum,
  only a query filter change on the admin side.

---
---

# Backend Bug Report: Merchant Registration Fee Validated in USD Instead of NGN

Date reported: 2026-05-26
Reported by: Frontend team
Severity: High
Area: Merchant Registration / Merchant Fee Payment / Currency Handling

---

## Summary

When a Nigerian user (currency: NGN) attempts to pay the merchant registration fee from their
wallet, the backend validates the wallet balance against a **USD amount** and returns an error
message explicitly referencing USD — even though the user's account and wallets operate in NGN.

**Observed error from backend:**
```
"Insufficient balance in registration wallet. Required: 400000 USD equivalent"
```

This is wrong on two counts:
1. The required amount should be expressed in **NGN**, not USD.
2. The wallet balance check should compare against the NGN value of the fee, not the raw
   `registrationFeeUsd` field without currency conversion.

---

## User Impact

- Nigerian user selects Registration Wallet or Cash Wallet to pay the merchant fee.
- Backend responds with an error referencing "USD equivalent".
- User is confused — their wallet holds NGN, not USD.
- Even if the user has enough NGN to cover the fee at the correct exchange rate, the
  backend may reject the payment because it is comparing NGN balance against a USD threshold
  without conversion.
- Payment cannot be completed, but the merchant PENDING record already exists (see Bug 1 above).

---

## Reproduction Steps

1. Log in as a NGN user (Nigerian account).
2. Navigate to `/merchant/apply`.
3. Select any merchant tier (e.g. Regional — fee shown as ₦400,000).
4. Select **Registration Wallet** or **Cash Wallet** as payment source.
5. Click **Apply & Pay** (or **Complete Payment** for existing PENDING users).
6. Observe the error response from `POST /merchants/merchant-fee/initiate`.

**Observed error:**
```json
{
  "message": "Insufficient balance in registration wallet. Required: 400000 USD equivalent"
}
```

---

## Actual Behaviour

The backend reads `registrationFeeUsd` from the merchant category config and uses that raw
numeric value to validate wallet balance — without converting to the user's local currency
(NGN). The error message also leaks the internal field name `USD equivalent` to the user.

```
registrationFeeUsd = 400000   ← stored as USD in DB (or labelled USD but actually NGN?)
User NGN wallet balance = ₦350,000

Backend check: 350,000 < 400,000  →  "Insufficient balance. Required: 400000 USD equivalent"
```

If `registrationFeeUsd` is actually meant to be NGN, then the field is misnamed and the error
message is doubly misleading.

---

## Expected Behaviour

The backend should:
1. Determine the user's currency from their account/profile (`currency: "NGN"`).
2. Convert the `registrationFeeUsd` to the user's local currency using a stored exchange rate,
   **OR** store the fee in multiple currencies / store it in NGN for NGN users.
3. Validate wallet balance against the local-currency fee amount.
4. Return error messages using the correct currency symbol and amount.

**Expected error (if truly insufficient):**
```json
{
  "message": "Insufficient balance in registration wallet. Required: ₦400,000.00"
}
```

---

## Frontend Note

The frontend merchant apply page already displays the fee with a ₦ symbol:

```html
₦{{ cfg.registrationFeeUsd | number: '1.2-2' }}
```

The field is named `registrationFeeUsd` on the API response, but the frontend treats it as
NGN for display. This naming inconsistency suggests the backend field may actually store the
NGN amount but is incorrectly named `registrationFeeUsd`, causing confusion in the payment
validation logic.

Relevant frontend file:
- `src/app/pages/merchant/merchant-apply/merchant-apply.component.html` — fee display line

---

## Suspected Backend Issues

1. `registrationFeeUsd` field is named in USD but may store NGN — naming mismatch leads to
   incorrect currency logic in the fee validation service.
2. The wallet balance check does not perform currency conversion before comparison.
3. The error message template hardcodes `"USD equivalent"` regardless of the user's currency.
4. No per-user or per-region currency context is applied when validating the merchant fee.

---

## Proposed Backend Fix

### Option A — Field is actually NGN (rename fix)

If `registrationFeeUsd` is already stored in NGN:
- Rename the field to `registrationFee` with a companion `registrationFeeCurrency: "NGN"`.
- Update the balance validation to compare in the same currency.
- Update error messages to use the user's currency symbol.

### Option B — Field is USD, user is NGN (conversion fix)

If the fee is truly stored in USD:
- Fetch the current NGN/USD exchange rate from a stored config or rate table.
- Convert: `feeInNGN = registrationFeeUsd * exchangeRate`
- Validate: `walletBalanceNGN >= feeInNGN`
- Charge: debit `feeInNGN` from NGN wallet.
- Error message: `"Insufficient balance. Required: ₦{feeInNGN}"`

### Error message contract

Regardless of option chosen, the error response should follow this format:

```json
{
  "statusCode": 400,
  "message": "Insufficient balance in {walletType} wallet. Required: {currencySymbol}{amount}",
  "currency": "NGN",
  "requiredAmount": 400000,
  "currentBalance": 350000
}
```

---

## Acceptance Criteria

1. NGN users receive error messages in NGN (₦), not USD.
2. Wallet balance is compared against the correct NGN fee amount (not a raw USD number).
3. `GET /merchants/category-config` response is clear about which currency
   `registrationFeeUsd` represents — rename or add a `currency` companion field.
4. A user with sufficient NGN balance can successfully pay the merchant fee.
5. No "USD equivalent" text appears anywhere in responses to NGN users.

---

## Notes

- This bug compounds with Bug 1 above: payment fails due to wrong currency validation →
  merchant record stays PENDING (unpaid) → admin sees a ghost PENDING applicant.
- Both bugs together make the merchant registration flow completely broken for NGN users.
- Priority: fix Bug 2 (currency) alongside Bug 1 (status) in the same release.

