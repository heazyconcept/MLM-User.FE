# Backend Bug: Legacy upgrade wallet payment fails DB purpose check

**Date:** 2026-09-24  
**From:** User FE (`mlm-user.fe`)  
**Status:** Open — backend fix required  
**Severity:** High  
**Area:** `POST /legacy/payments/wallet` with `purpose: "UPGRADE"`  
**Related FE:** [`legacy-pay.component.ts`](../src/app/pages/legacy-club/legacy-pay/legacy-pay.component.ts), [`legacy-payment.service.ts`](../src/app/services/legacy-payment.service.ts)

---

## Summary

Paying for a **Legacy package upgrade** from the registration wallet returns **500** because inserting a `LegacyPayment` row with `purpose = UPGRADE` violates a PostgreSQL check constraint on the table.

Join and reactivate may work; **upgrade is broken** in production.

---

## Observed error

**Request:**

```http
POST /legacy/payments/wallet
Authorization: Bearer <token>
Content-Type: application/json
```

```json
{
  "purpose": "UPGRADE",
  "requestKey": "<uuid>"
}
```

**Response (500):**

```json
{
  "statusCode": 500,
  "message": [
    "new row for relation \"LegacyPayment\" violates check constraint \"LegacyPayment_purpose_check\""
  ],
  "error": "DriverAdapterError",
  "timestamp": "2026-09-24T17:13:49.102Z",
  "path": "/legacy/payments/wallet"
}
```

---

## Root cause

The `LegacyPayment` table was created with a check constraint that **only allows** `JOIN` and `REACTIVATE`:

```sql
CONSTRAINT "LegacyPayment_purpose_check" CHECK ("purpose" IN ('JOIN', 'REACTIVATE'))
```

(Migration: `prisma/migrations/20260922170000_legacy_payments/migration.sql`)

The application layer correctly supports **`UPGRADE`** as a payment purpose:

- DTO: `LegacyWalletPaymentDto.purpose` accepts `JOIN | UPGRADE | REACTIVATE`
- Service/repository: upgrade flow creates `LegacyPayment` with `purpose: UPGRADE`
- Prisma enum `LegacyCycleSource` includes `UPGRADE`

The DB constraint was never updated when upgrade payments were implemented → insert fails at runtime.

---

## Expected behavior

`POST /legacy/payments/wallet` with `purpose: "UPGRADE"` should:

1. Validate active membership + upgrade intent
2. Debit registration wallet
3. Insert `LegacyPayment` with `purpose = UPGRADE`
4. Complete upgrade activation (new cycle, instant commission, etc.)
5. Return **200** (same as JOIN / REACTIVATE)

---

## Required fix (HerbApi)

### 1. Database migration

Drop and recreate the check constraint to include `UPGRADE`:

```sql
ALTER TABLE "LegacyPayment" DROP CONSTRAINT IF EXISTS "LegacyPayment_purpose_check";

ALTER TABLE "LegacyPayment"
  ADD CONSTRAINT "LegacyPayment_purpose_check"
  CHECK ("purpose" IN ('JOIN', 'UPGRADE', 'REACTIVATE'));
```

Do **not** add `SEED` unless admin/seed flows also write `LegacyPayment` rows with that purpose (typically they do not).

### 2. Verify application path

After migration, confirm:

- Wallet pay for upgrade (`POST /legacy/payments/wallet`, `purpose: UPGRADE`)
- Manual bank upgrade proof (`POST /legacy/payments/manual`, `purpose: UPGRADE`)
- Admin approve of pending upgrade payment

### 3. Regression test

Add an integration or repository test that inserts / pays with `purpose: UPGRADE` so the constraint mismatch cannot recur.

---

## Frontend impact

No FE change required. User FE already sends `purpose: "UPGRADE"` from `/legacy/pay/upgrade` via `LegacyPaymentService.payWithWallet()`.

Until the migration runs in production, upgrade payments will continue to fail with 500.

---

## Test plan

1. Active Legacy member starts upgrade to a higher package.
2. `POST /legacy/payments/wallet` with `purpose: UPGRADE` → **200**, membership package updated, wallet debited.
3. Repeat for manual bank flow → pending payment → admin approve → **200**.
4. Confirm existing JOIN and REACTIVATE wallet payments still work.
