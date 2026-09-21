# Feature 15 – Legacy Club (Phase 1)
## Backend Implementation Guide

> **Canonical reference**  
> [phase-1-context.md](./phase-1-context.md)  
> Existing Segulah compensation: [COMPENSATION_AND_EARNINGS_RULES.md](../../COMPENSATION_AND_EARNINGS_RULES.md)

**Status:** Not implemented  
**Date:** 2026-09-18  
**Updated:** 2026-09-18 — Instant → LEGACY_CASHOUT; no 3-direct lock; auto-sponsor; LEGACY_VOUCHER  
**UI:** [phase-1-ui-ux.md](./phase-1-ui-ux.md)  
**FE contract:** [phase-1-frontend-integration.md](./phase-1-frontend-integration.md)

---

## 1. Purpose

Add Legacy Club as a **separate programme** beside the matrix:

- Membership (VIP / Executive / Supreme) on an already-paid Segulah user
- Unilevel sponsor (`legacySponsorId`) — level 1 only  
  **Auto** if `User.referredById` is already ACTIVE in Legacy Club; otherwise username
- Separate marketplace **channel** and **LEGACY_VOUCHER** so join orders skip product cash commissions and do not touch the network voucher
- Instant + Successline Instant bonus → **LEGACY_CASHOUT**, **no** Autoship split
- Cashout / transfer from LEGACY_CASHOUT with **no** Successline gate
- Admin-configurable amounts

This module **does not** (Phase 1):

- Accrue monthly commission, Autoship gates, or the **monthly increase after 3 Successlines**
- Upgrade / reactivate
- Place anyone in the matrix
- Change Nickel–Diamond registration packages

---

## 2. Module ownership

**New module:** `src/modules/legacy-club/`

| Area | Owner |
|---|---|
| Membership, sponsor resolution, join intent, Successline list | `legacy-club` |
| Package config | `legacy-club` + admin |
| LEGACY_CASHOUT + LEGACY_VOUCHER | `wallet` + `legacy-club` |
| Instant + Successline Instant bonus | `earnings` (new types, no split, dest LEGACY_CASHOUT) |
| Channelled cart / order | `cart`, `orders`, `order-processing` |
| PV to buyer + Legacy sponsor | `earnings/cpv` from order-processing |
| Withdrawal from LEGACY_CASHOUT | `withdrawals` |
| Internal transfer from/to Legacy wallets | `wallet` |

---

## 3. Prisma / data model

### 3.1 Enums

```prisma
enum LegacyPackage {
  VIP
  EXECUTIVE
  SUPREME
}

enum LegacyMembershipStatus {
  PENDING_JOIN
  ACTIVE
  EXPIRED        // reserved for Phase 3
}

enum LegacySponsorSource {
  AUTO           // referredById was already ACTIVE Legacy
  CHOSEN         // username entered
  SEED           // admin
}

enum ShopChannel {
  NETWORK
  LEGACY
}

enum WalletType {
  REGISTRATION
  CASH
  VOUCHER
  AUTOSHIP
  LEGACY_CASHOUT
  LEGACY_VOUCHER
}

enum LedgerEarningType {
  // ...existing...
  LEGACY_INSTANT_COMMISSION
  LEGACY_SUCCESSLINE_INSTANT_BONUS
}

enum LedgerSource {
  // ...existing...
  LEGACY_JOIN
}
```

`Cart`: `@@unique([userId, channel])`, backfill existing as `NETWORK`.

```prisma
model Order {
  // ...existing...
  channel              ShopChannel @default(NETWORK)
  legacyMembershipId   String?
  legacyMembership     LegacyMembership? @relation(...)
}
```

### 3.2 Config

```prisma
model LegacyPackageConfig {
  id                            String         @id @default(uuid())
  package                       LegacyPackage  @unique
  purchaseAmountNgn             Decimal        @db.Decimal(18, 2)
  instantCommissionNgn          Decimal        @db.Decimal(18, 2)
  monthlyCommissionNgn          Decimal        @db.Decimal(18, 2)  // Phase 2 default / high rate TBD
  successlineBonusPercent       Decimal        @db.Decimal(5, 2)
  autoshipAmountNgn             Decimal        @db.Decimal(18, 2)  // Phase 2
  cycleMonths                   Int            @default(6)
  minDirectsToIncreaseMonthly   Int            @default(3)         // Phase 2; NOT a cashout gate
  isActive                      Boolean        @default(true)
  updatedById                   String?
  createdAt                     DateTime       @default(now())
  updatedAt                     DateTime       @updatedAt
}
```

Seed (same flyer NGN as before). `minDirectsToIncreaseMonthly = 3`. Do **not** add `minDirectsToCashout`.

USD = NGN ÷ `DEFAULT_NGN_TO_USD_RATE` (1000).

### 3.3 Membership

```prisma
model LegacyMembership {
  id                   String                 @id @default(uuid())
  userId               String                 @unique
  package              LegacyPackage
  status               LegacyMembershipStatus @default(PENDING_JOIN)
  legacySponsorId      String?
  sponsorSource        LegacySponsorSource
  cycleStartedAt       DateTime?
  joinOrderId          String?                @unique
  instantEarningRef    String?
  seedWaivedPurchase   Boolean                @default(false)
  createdAt            DateTime               @default(now())
  updatedAt            DateTime               @updatedAt

  user                 User                   @relation("LegacyMembershipUser", fields: [userId], references: [id])
  legacySponsor        User?                  @relation("LegacySponsoredMembers", fields: [legacySponsorId], references: [id])
  joinOrders           Order[]

  @@index([legacySponsorId])
  @@index([status])
  @@index([package])
}
```

Rules:

- One row per user in Phase 1.
- Resolve sponsor with §5.1 **before** insert. Do not blindly trust a username when AUTO applies.
- Sponsor must be ACTIVE Legacy (except first admin seed with null sponsor).
- On paid join: `ACTIVE`, `cycleStartedAt = now()`, `joinOrderId` set.

Wallets:

- `LEGACY_VOUCHER` — ensure when they start join (or first fund), so they can load it before pay.
- `LEGACY_CASHOUT` — ensure when membership becomes `ACTIVE` (and on seed).

Same `registrationCurrency` as other wallets.

---

## 4. Display money

```
displayAmount = registrationCurrency === NGN
  ? amountNgn
  : amountNgn / DEFAULT_NGN_TO_USD_RATE

baseAmountUsd = amountNgn / DEFAULT_NGN_TO_USD_RATE
```

---

## 5. Join flow (authoritative)

### 5.1 Sponsor resolution

```
function resolveLegacySponsor(joiningUser, optionalUsername):
  segulahSponsor = joiningUser.referredById
  if segulahSponsor has LegacyMembership.status == ACTIVE:
    if optionalUsername is set and username != that sponsor:
      reject SPONSOR_MUST_BE_AUTO
    return { id: segulahSponsor, source: AUTO }
  if optionalUsername is empty:
    reject SPONSOR_USERNAME_REQUIRED
  target = user by username
  if missing → SPONSOR_NOT_FOUND
  if target.id == joiningUser.id → SPONSOR_SELF
  if target has no ACTIVE Legacy → SPONSOR_NOT_LEGACY
  return { id: target.id, source: CHOSEN }
```

`GET /legacy/me` (status NONE) and `GET /legacy/join-preview` expose this so the UI hides the username field when AUTO.

### 5.2 Sequence

```
POST /legacy/join/start { package, sponsorUsername? }
  → paid Segulah, not ACTIVE, package active
  → resolve sponsor (§5.1)
  → upsert PENDING_JOIN
  → ensure LEGACY_VOUCHER
  → no money yet

Legacy cart (channel=LEGACY) + checkout
  → PENDING_JOIN
  → subtotal >= purchaseAmount
  → Order.channel = LEGACY, legacyMembershipId set

pay-wallet walletType=LEGACY_VOUCHER only (channel LEGACY)
  → order.paid
  → LegacyJoinService.onJoinOrderPaid (idempotent)
       1. ACTIVE + cycleStartedAt + joinOrderId
       2. ensure LEGACY_CASHOUT
       3. PV buyer + PV Legacy sponsor
       4. Instant → LEGACY_CASHOUT (no Autoship split)
       5. Successline Instant bonus → sponsor LEGACY_CASHOUT
       6. skip PPPC/DRPPC/CPPC/community CPV/merchant product/BC product
```

Pay failure: stay `PENDING_JOIN`. First successful paid Legacy order wins.

`join/start` may replace package/sponsor while `PENDING_JOIN` (re-run resolution). Forbidden once `ACTIVE`.

---

## 6. Compensation on Legacy orders

### 6.1 Channel

`NETWORK` → existing behaviour.

`LEGACY`:

| Step | Action |
|---|---|
| Buyer personal PV | **Yes** (`CPV_SOURCE_PRODUCT_PURCHASE_PV`) |
| Community product CPV | **Skip** |
| PPPC / DRPPC / CPPC / BC product / merchant product cash | **Skip** |
| Merchant delivery bonus | Keep fulfilment path |
| Legacy sponsor PV | **Yes** — `LEGACY_DIRECT_SUCCESSLINE_PV`, `sourceId = {orderId}-legacy-sponsor-pv` |
| Instant + Successline Instant | `LegacyJoinService` on the **join** order only |

Sponsor PV: sum `directReferralPv * quantity` → `membership.legacySponsorId`.

### 6.2 Instant (buyer)

- Type: `LEGACY_INSTANT_COMMISSION`
- Amount: `instantCommissionNgn` at pay (snapshot)
- Destination: **LEGACY_CASHOUT**
- `skipAutoshipSplit: true` — single CREDIT, no CASH/AUTOSHIP legs
- Metadata: `{ legacyPackage, membershipId, orderId, instantCommissionNgn, fxRate }`

### 6.3 Successline Instant bonus

- Type: `LEGACY_SUCCESSLINE_INSTANT_BONUS`
- Amount: `buyerInstant * sponsor.successlineBonusPercent / 100`
- Destination: sponsor **LEGACY_CASHOUT**
- Skip if no sponsor (seed) or sponsor not ACTIVE
- Metadata: `{ fromUserId, fromUsername, fromPackage, buyerInstantAmount, percent, orderId }`

### 6.4 Successline count (informational)

```
COUNT LegacyMembership
WHERE legacySponsorId = :userId AND status = ACTIVE
```

`canCashoutLegacy = true` whenever LEGACY_CASHOUT exists.  
**Do not** implement `LEGACY_CASHOUT_LOCKED`.

Store `minDirectsToIncreaseMonthly` for Phase 2. Phase 1 may return the count and the threshold; it must not gate withdraw/transfer.

---

## 7. Cart, checkout, pay

### 7.1 Two carts

`/cart?channel=LEGACY` (default `NETWORK`).  
`DELETE /cart` clears that channel only.  
`POST /cart/merge` stays NETWORK.

### 7.2 Checkout

```json
{ "channel": "LEGACY", "countryCode": "NG", "subdivisionCode": "LA", "paymentMethod": "WALLET", "groups": [] }
```

When `channel === LEGACY`:

1. `PENDING_JOIN`
2. Subtotal ≥ purchase amount
3. Persist `channel` + `legacyMembershipId`
4. Same merchant / pickup rules

### 7.3 Pay

Network shop: still `VOUCHER` only.

Legacy shop: **`LEGACY_VOUCHER` only**. Reject `VOUCHER` / `CASH` on a LEGACY-channel pay (`LEGACY_VOUCHER_REQUIRED`).

Extend `PayWalletDto` / `payWithWallet` so `LEGACY_VOUCHER` is allowed **only** when the order’s `channel === LEGACY`.

### 7.4 After ACTIVE

Phase 1: Legacy shop closed (`403 LEGACY_SHOP_JOIN_ONLY`) until Phase 2 Autoship. Instant must not double-pay. Guard Instant with `joinOrderId` unique.

---

## 8. Wallets, cashout, transfer

### 8.1 Summary

`GET /wallets`:

```json
"legacyCashoutWallet": { "currency": "NGN", "balance": 0, "status": "ACTIVE" },
"legacyVoucherWallet": { "currency": "NGN", "balance": 0, "status": "ACTIVE" }
```

Omit keys if the row does not exist.

Do **not** fold Legacy cashout into dashboard `hero.totalWalletBalance` or `stats.cashoutBalance` in Phase 1. Expose under `/legacy`. Same for Legacy voucher vs network voucher.

### 8.2 Transfers

No Successline gate.

`POST /legacy/cashout/transfer` (PIN):

`LEGACY_CASHOUT → CASH | VOUCHER | AUTOSHIP | LEGACY_VOUCHER`

`POST /wallets/transfer` also allow `CASH → LEGACY_VOUCHER` (and optionally `CASH →` existing targets). Do **not** allow `VOUCHER → LEGACY_VOUCHER` or the reverse in Phase 1 (columns stay separate).

### 8.3 Withdrawals

`POST /legacy/cashout/withdraw` → `WithdrawalsService` on LEGACY_CASHOUT.

- Currency lock, lien, admin approval, PIN — same as CASH
- **No** `canCashoutLegacy` count check
- Lien only LEGACY_CASHOUT

### 8.4 Fund transfer to another user

Out of scope.

### 8.5 Ledger validation

- LEGACY_CASHOUT CREDIT: `EARNING`, `ADMIN`
- LEGACY_CASHOUT DEBIT: `WITHDRAWAL`, `TRANSFER`
- LEGACY_VOUCHER CREDIT: `TRANSFER`, `DEPOSIT`, `ADMIN`
- LEGACY_VOUCHER DEBIT: `PRODUCT_PURCHASE` (Legacy channel only), `TRANSFER`
- Instant / Successline Instant: no Autoship split

---

## 9. Earnings activity

- `LEGACY_INSTANT_COMMISSION` → “Legacy Club Instant Membership Commission (VIP)”
- `LEGACY_SUCCESSLINE_INSTANT_BONUS` → “Legacy Successline bonus — Instant from {username}”

```ts
processEarning(type, userId, amount, sourceId, metadata, {
  destinationWalletType: WalletType.LEGACY_CASHOUT,
  skipAutoshipSplit: true,
})
```

Default path (CASH + split) unchanged for the 17 network gateways.

Dashboard `walletType=legacy_cashout` and `legacy_voucher` filters.

---

## 10. HTTP API

Member: Bearer + `RegistrationPaidGuard`.  
Admin: admin JWT + RBAC.

| Method | Path | Purpose |
|---|---|---|
| GET | `/legacy/packages` | Packages in caller currency |
| GET | `/legacy/me` | Membership, wallets, sponsor resolution, counts |
| GET | `/legacy/join-preview` | Optional alias of NONE-state sponsor resolution |
| POST | `/legacy/sponsors/validate` | MANUAL username only |
| POST | `/legacy/join/start` | `{ package, sponsorUsername? }` |
| GET | `/legacy/successlines` | Direct ACTIVE |
| GET | `/legacy/cashout` | Balance + ledger (`canCashout: true`) |
| POST | `/legacy/cashout/withdraw` | PIN + payout fields |
| POST | `/legacy/cashout/transfer` | PIN + `toWalletType` |
| GET | `/legacy/voucher` | LEGACY_VOUCHER balance |
| GET | `/legacy/members/lookup` | Prospective Successline |

Cart/checkout: existing + `channel`. Pay: `LEGACY_VOUCHER`.

Admin: `GET/PUT /admin/legacy/packages`, `GET /admin/legacy/members`, `GET /admin/legacy/members/:userId`, `POST /admin/legacy/enroll`.

Seed waive: ACTIVE + both wallets + Instant to LEGACY_CASHOUT + sponsor bonus if any. No order/PV. Audit admin id.

If seed user has AUTO sponsor available and `sponsorUsername` omitted, use AUTO.

---

## 11. RBAC seed

| Key | Label |
|---|---|
| `legacy.view_members` | View Legacy members |
| `legacy.configure_packages` | Configure Legacy packages |
| `legacy.enroll_seed` | Seed enroll Legacy member |
| `legacy.view_wallets` | View Legacy wallets |

Grant all to Super Admin.

---

## 12. Idempotency

- Earning refs unique per `(type, orderId, userId)`
- CPV `sourceId` unique
- `joinOrderId @unique`
- `onJoinOrderPaid` retry-safe
- No Phase 1 cron

---

## 13. Tests (minimum)

- AUTO: `referredById` ACTIVE Legacy → no username; username of someone else → `SPONSOR_MUST_BE_AUTO`
- MANUAL: no username → `SPONSOR_USERNAME_REQUIRED`; non-Legacy → `SPONSOR_NOT_LEGACY`; self rejected
- Join rejects unpaid / duplicate ACTIVE
- Checkout below purchase rejected
- Pay with VOUCHER on LEGACY order rejected; LEGACY_VOUCHER succeeds; network VOUCHER unchanged
- Instant + sponsor bonus both LEGACY_CASHOUT; **no** AUTOSHIP split; **no** CASH Instant
- Zero Successlines: withdraw and transfer **200**
- No PPPC on LEGACY; NETWORK still PPPC
- Buyer PV + Legacy sponsor PV only
- Seed waive; first member sponsor null
- USD Instant = NGN/1000
- Two carts + two voucher wallets do not mix
- Config change does not rewrite paid Instant

---

## 14. Implementation order

1. Enums, config, membership, LEGACY_CASHOUT + LEGACY_VOUCHER  
2. Sponsor resolution + `/legacy/me` + `join/start`  
3. Cart channel, checkout, pay LEGACY_VOUCHER  
4. Order-processing skip + sponsor PV  
5. Instant + Successline bonus → LEGACY_CASHOUT, no split  
6. Successline list (count only)  
7. Withdraw + transfer (no lock)  
8. Admin + seed  
9. Activity copy + RBAC
