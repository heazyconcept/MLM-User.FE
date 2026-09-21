# Feature 15b – Legacy Club (Phase 2)
## Backend Implementation Guide — Monthly commission & Autoship

> **Canonical reference**  
> [phase-2-context.md](./phase-2-context.md)  
> Phase 1: [phase-1-backend.md](./phase-1-backend.md)

**Status:** Not implemented  
**Date:** 2026-09-18  
**Updated:** 2026-09-18 — Legacy voucher pay; no cashout lock; base vs increased monthly  
**UI:** [phase-2-ui-ux.md](./phase-2-ui-ux.md)  
**FE contract:** [phase-2-frontend-integration.md](./phase-2-frontend-integration.md)

---

## 1. Purpose

On an **ACTIVE** Legacy membership:

1. Every **30 days** from `cycleStartedAt`, create month `1..cycleMonths` as **pending**, amount = **base** or **increased** (§4).
2. Pending does **not** credit LEGACY_CASHOUT until a qualifying **Autoship** order is paid (`LEGACY_VOUCHER`).
3. Autoship = Legacy-channel order, subtotal ≥ package Autoship. Join pack does not count.
4. Each full Autoship **unit** drops the oldest pending month (FIFO).
5. On drop: monthly → member LEGACY_CASHOUT (`skipAutoshipSplit`); Successline % of **that** amount → sponsor LEGACY_CASHOUT. No cashout lock.
6. Reopen Legacy checkout for ACTIVE members. Instant must not pay again.

Phase 2 does **not** upgrade, reactivate, or expire memberships.

---

## 2. Module ownership

Same `legacy-club` module. Pay path stays Phase 1 `LEGACY_VOUCHER` for `channel=LEGACY`.

---

## 3. Data model

```prisma
enum LegacyPeriodStatus {
  PENDING
  DROPPED
}

enum LegacyMonthlyRateTier {
  BASE
  INCREASED
}

enum LegacyOrderPurpose {
  JOIN
  AUTOSHIP
  OTHER
}

enum LedgerEarningType {
  // Phase 1...
  LEGACY_MONTHLY_COMMISSION
  LEGACY_SUCCESSLINE_MONTHLY_BONUS
}
```

`Order.legacyPurpose` — backfill join orders as `JOIN`.

```prisma
model LegacyCommissionPeriod {
  id                      String                 @id @default(uuid())
  membershipId            String
  periodIndex             Int
  dueAt                   DateTime
  amountNgn               Decimal                @db.Decimal(18, 2)
  amountBaseUsd           Decimal                @db.Decimal(18, 8)
  rateTier                LegacyMonthlyRateTier
  status                  LegacyPeriodStatus     @default(PENDING)
  droppedAt               DateTime?
  autoshipOrderId         String?
  monthlyEarningRef       String?                @unique
  successlineBonusRef     String?                @unique
  createdAt               DateTime               @default(now())
  updatedAt               DateTime               @updatedAt

  membership              LegacyMembership       @relation(...)
  @@unique([membershipId, periodIndex])
  @@index([status, dueAt])
}
```

Insert rows **only when due**. UI synthesizes `SCHEDULED` from `cycleStartedAt + index * 30 days` + preview amount (§4).

`LegacyMembership` add:

```prisma
periods              LegacyCommissionPeriod[]
lastAutoshipAt       DateTime?
lastAutoshipOrderId  String?
monthlyQualifiedAt   DateTime?   // first time Successline count reached minDirects
```

`LegacyPackageConfig` (extend Phase 1):

```prisma
monthlyCommissionBaseNgn       Decimal  @db.Decimal(18, 2)  // before 3
monthlyCommissionIncreasedNgn  Decimal  @db.Decimal(18, 2)  // flyer / after 3
```

If Phase 1 already shipped `monthlyCommissionNgn`, migrate that column to `monthlyCommissionIncreasedNgn` and add `monthlyCommissionBaseNgn` (dev seed may copy increased; production must set base).

`minDirectsToIncreaseMonthly` already on config (default 3).

---

## 4. Rate selection

Set `monthlyQualifiedAt = now()` **once** when `COUNT ACTIVE Successlines` first reaches `minDirectsToIncreaseMonthly` (on that 3rd join pay, after membership ACTIVE). Never clear in Phase 2.

When inserting a due period:

```
if membership.monthlyQualifiedAt != null AND dueAt > monthlyQualifiedAt:
  amount = config.monthlyCommissionIncreasedNgn
  rateTier = INCREASED
else:
  amount = config.monthlyCommissionBaseNgn
  rateTier = BASE
```

Do not rewrite existing PENDING/DROPPED rows when they later qualify.

Preview for SCHEDULED slots: run the same predicate with the **computed** `dueAt` (not yet inserted).

---

## 5. Due job

Daily (e.g. 00:10 UTC) **and** lazy on `GET /legacy/me` / `/legacy/months`.

```
n = cycleMonths (default 6)
for periodIndex in 1..n:
  dueAt = cycleStartedAt + periodIndex * 30 days
  if now >= dueAt and row missing:
    insert PENDING with §4 snapshot
```

No period 7+. Skip if `cycleStartedAt` is null.

---

## 6. Drop

`LegacyMonthlyService.dropPeriods(membershipId, orderId, units)`:

1. PENDING for that membership, `orderBy periodIndex ASC`, `take: units`.
2. Per period:  
   `processEarning(LEGACY_MONTHLY_COMMISSION, member, amountBase, …, { destination: LEGACY_CASHOUT, skipAutoshipSplit: true })`  
   If sponsor ACTIVE: `%` of **this period’s** amount → sponsor LEGACY_CASHOUT (`LEGACY_SUCCESSLINE_MONTHLY_BONUS`).  
   `status = DROPPED`, refs, `autoshipOrderId`.
3. Idempotent if already DROPPED.

No Successline gate on receive or later withdraw.

---

## 7. Autoship orders

Replace Phase 1 `LEGACY_SHOP_JOIN_ONLY` for ACTIVE.

| Membership | Floor | purpose |
|---|---|---|
| PENDING_JOIN | purchase amount | JOIN |
| ACTIVE | none | AUTOSHIP if `floor(subtotal / autoshipDisplay) >= 1`, else OTHER |
| NONE | reject | — |

Pay: **`LEGACY_VOUCHER` only** (Phase 1).

On `order.paid` LEGACY + ACTIVE: Phase 1 PV / skip cash commissions; **no** Instant; then

```
units = min(floor(batchTotal / autoshipDisplay), pendingCount)
if units > 0: dropPeriods(...)
```

Early Autoship (`units === 0`): PV only, **no** stored credit toward the next due.

---

## 8. `GET /legacy/me` extensions

Keep Phase 1 fields (`canCashoutLegacy: true`, `legacyVoucher`, `minDirectsToIncreaseMonthly`, no lock). Add:

```json
"cycle": {
  "startedAt": "2026-09-18T10:00:00.000Z",
  "cycleMonths": 6,
  "issuedCount": 2,
  "droppedCount": 1,
  "pendingCount": 1,
  "pendingAmount": 30000,
  "nextDueAt": "2026-11-17T10:00:00.000Z",
  "nextDueAmount": 30000,
  "nextDueRateTier": "INCREASED",
  "isCycleComplete": false
},
"monthlyQualify": {
  "directSuccesslineCount": 3,
  "required": 3,
  "qualifiedAt": "2026-10-20T09:00:00.000Z",
  "isQualified": true
},
"autoship": {
  "requiredAmount": 10000,
  "lastAutoshipAt": "2026-10-20T09:00:00.000Z",
  "shopMode": "AUTOSHIP"
}
```

`shopMode`: `JOIN` | `AUTOSHIP` | `NONE`.  
Lazy due-catch-up before respond.  
On 3rd Successline pay, set `monthlyQualifiedAt` then return updated `monthlyQualify`.

---

## 9. `GET /legacy/months`

```json
{
  "cycleStartedAt": "...",
  "cycleMonths": 6,
  "pendingTotal": 30000,
  "currency": "NGN",
  "monthlyQualify": { "isQualified": false, "qualifiedAt": null, "required": 3, "directSuccesslineCount": 1 },
  "months": [
    {
      "periodIndex": 1,
      "dueAt": "...",
      "amount": 15000,
      "rateTier": "BASE",
      "status": "DROPPED",
      "droppedAt": "...",
      "autoshipOrderId": "uuid"
    },
    {
      "periodIndex": 2,
      "dueAt": "...",
      "amount": 30000,
      "rateTier": "INCREASED",
      "status": "SCHEDULED",
      "droppedAt": null,
      "autoshipOrderId": null
    }
  ]
}
```

Unissued indexes: `SCHEDULED` + preview amount/tier from §4.

---

## 10. Activity copy

- `LEGACY_MONTHLY_COMMISSION` → “Legacy Club Monthly Membership Commission (month {n}, base|increased)”
- `LEGACY_SUCCESSLINE_MONTHLY_BONUS` → “Legacy Successline bonus — Monthly from {username} (month {n})”

---

## 11. Tests

- Day 0: no periods; Instant already on LEGACY_CASHOUT  
- +30d, not qualified: period 1 PENDING at **base**  
- 3rd Successline on day 85: `monthlyQualifiedAt` set; period 2 (due day 60) unchanged; period 3 (due day 90) **increased**  
- Qualify during month 5: only period 6 increased  
- Qualify before day 30: all six increased  
- Qualify after a month is PENDING: that row stays base  
- Autoship 1×: drop oldest; both legs LEGACY_CASHOUT; no Instant; no CASH split  
- Pay with network VOUCHER rejected  
- Autoship below amount: OTHER, still PENDING  
- 3× cart / 3 pending: all drop  
- Early Autoship: no credit  
- Period 7 never created  
- Config change: existing PENDING unchanged  
- Zero Successlines: withdraw dropped monthly **200**  
- NETWORK order still PPPC  
- Join path still purchase floor + Instant once  

---

## 12. Implementation order

1. Config base/increased + `monthlyQualifiedAt` + period `rateTier`  
2. Set qualified on 3rd Successline join  
3. Due job + lazy catch-up  
4. `GET /legacy/months` + `/legacy/me` cycle  
5. Open ACTIVE checkout; Instant guard; LEGACY_VOUCHER  
6. FIFO drop + monthly/sponsor earnings  
7. Admin periods + package fields  
8. Tests
