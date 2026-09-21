# Feature 15c – Legacy Club (Phase 3)
## Backend Implementation Guide — Upgrade, reactivation, history

> **Canonical reference**  
> [phase-3-context.md](./phase-3-context.md)  
> Phase 1: [phase-1-backend.md](./phase-1-backend.md) · Phase 2: [phase-2-backend.md](./phase-2-backend.md)

**Status:** Not implemented  
**Date:** 2026-09-18  
**Updated:** 2026-09-18 — Instant → LEGACY_CASHOUT; LEGACY_VOUCHER; keep `monthlyQualifiedAt`; no cashout lock  
**UI:** [phase-3-ui-ux.md](./phase-3-ui-ux.md)  
**FE contract:** [phase-3-frontend-integration.md](./phase-3-frontend-integration.md)

---

## 1. Purpose

1. **Upgrade** — LEGACY order ≥ purchase difference, pay `LEGACY_VOUCHER`; Instant difference → **LEGACY_CASHOUT**; Successline % of that Instant → sponsor LEGACY_CASHOUT; new cycle.  
2. **Reactivate** — current cycle issued `cycleMonths` dues; order ≥ full purchase; full Instant → LEGACY_CASHOUT; new cycle; **same** package; **do not clear** `monthlyQualifiedAt`.  
3. **History** JOIN / UPGRADE / REACTIVATE / SEED.  
4. Old **PENDING** stays on the old cycle and still drops FIFO. Not-due old months are never inserted.  
5. No cashout gate. Lifetime Successline joins still feed Phase 2 **monthly raise**.

No downgrade. No sponsor change.

---

## 2. Data model

Same cycle / event / intent model as previously specified. Periods: `@@unique([cycleId, periodIndex])`. Keep Phase 2 `rateTier`, `monthlyQualifiedAt`.

Migrate Phase 2 `(membershipId, periodIndex)` rows onto a JOIN/SEED `LegacyCycle`.

```
VIP = 1, EXECUTIVE = 2, SUPREME = 3
upgrade iff rank(to) > rank(from)
```

```prisma
enum LegacyOrderPurpose {
  JOIN
  AUTOSHIP
  OTHER
  UPGRADE
  REACTIVATE
}
```

---

## 3. Difference math

Current config at pay:

```
payNgn     = to.purchaseAmountNgn - from.purchaseAmountNgn
instantNgn = to.instantCommissionNgn - from.instantCommissionNgn
```

Reject `payNgn <= 0` or `instantNgn < 0`.

Reactivate: full `purchaseAmountNgn` + full `instantCommissionNgn`.

FX: Phase 1 (÷ 1000 USD).

---

## 4. Intents

`POST /legacy/upgrade/start { package }` — ACTIVE, higher, target active. Set intent; **do not** change package until pay.

`POST /legacy/reactivate/start` — current cycle issued ≥ cycleMonths.

Cancel → `intent = NONE`. While UPGRADE/REACTIVATE, checkout uses that floor. Cancel to do a small Autoship.

---

## 5. Checkout

| Mode | Floor | purpose | Pay |
|---|---|---|---|
| PENDING_JOIN | purchase | JOIN | LEGACY_VOUCHER |
| ACTIVE, NONE | none | AUTOSHIP / OTHER | LEGACY_VOUCHER |
| ACTIVE, UPGRADE | difference | UPGRADE | LEGACY_VOUCHER |
| ACTIVE, REACTIVATE | full purchase | REACTIVATE | LEGACY_VOUCHER |

`LEGACY_CART_BELOW_PACKAGE` if under floor.

---

## 6. On paid UPGRADE / REACTIVATE

Idempotent on `orderId`.

1. PV buyer + Legacy sponsor; skip product cash commissions.  
2. `units = floor(batchTotal / autoship of package **before** change)`; `dropPeriods` FIFO **all** PENDING cycles.  
3. Instant → **LEGACY_CASHOUT**, `skipAutoshipSplit` (difference or full).  
4. Successline Instant bonus on that Instant → sponsor LEGACY_CASHOUT.  
5. Close current cycle `endedAt = now()`.  
6. New `LegacyCycle` (`startedAt = now()`, source, snapshots).  
7. `membership.package` (upgrade only), `cycleStartedAt = now()`, `currentCycleId`, `intent = NONE`.  
8. **Do not** clear `monthlyQualifiedAt`.  
9. `LegacyMembershipEvent`.  
10. Due job writes **only** on the new cycle. Old PENDING stay on old `cycleId`.

New-cycle period amounts use Phase 2 §4 with **new** package config + existing `monthlyQualifiedAt`. If already qualified, month 1 (`dueAt = start+30d`) is INCREASED.

---

## 7. Due job

```
cycle = membership.currentCycle  // endedAt == null
n = cycleMonths of cycle.package
dueAt = cycle.startedAt + periodIndex * 30 days
```

Never insert onto closed cycles.

`isCycleComplete` = issued count on **current** cycle ≥ cycleMonths.

---

## 8. FIFO drop

PENDING for `membershipId`, any cycle, `orderBy dueAt, periodIndex`.  
After upgrade, later Autoship units use **new** package Autoship amount. Same-payment units use **old** amount (step 2 before package update).

---

## 9. Successline count (monthly raise only)

```
COUNT memberships WHERE legacySponsorId = :id AND cycleStartedAt IS NOT NULL
```

PENDING_JOIN does not count. Inactive / non-reactivated Successlines **still count**. Used only to set/keep `monthlyQualifiedAt`. **Not** a withdraw gate. `canCashoutLegacy` stays true whenever LEGACY_CASHOUT exists.

---

## 10. HTTP

| Method | Path |
|---|---|
| POST | `/legacy/upgrade/start` `{ package }` |
| POST | `/legacy/upgrade/cancel` |
| GET | `/legacy/upgrade/quote?package=` |
| POST | `/legacy/reactivate/start` |
| POST | `/legacy/reactivate/cancel` |
| GET | `/legacy/history` |
| GET | `/legacy/me` — + intent, upgradeTargets, canReactivate, priorPending |
| GET | `/legacy/months` — + priorPending[] |

Quote:

```json
{
  "fromPackage": "VIP",
  "toPackage": "EXECUTIVE",
  "currency": "NGN",
  "payAmount": 140000,
  "instantCommission": 60000,
  "newMonthlyBase": 0,
  "newMonthlyIncreased": 120000,
  "newAutoshipAmount": 40000
}
```

(`newMonthlyBase` from target config; 0 if admin has not set production base.)

History events unchanged in shape; Instant amounts are Legacy-account credits.

---

## 11. Tests

- VIP→Exec: 140k floor, Instant 60k **LEGACY_CASHOUT** (not CASH), sponsor % of 60k, new cycle, history  
- Pay with network VOUCHER rejected  
- Old PENDING unchanged on old cycle; new month 1 at +30d  
- Already qualified: new month 1 **INCREASED** at Exec rate  
- Not qualified: new month 1 **BASE** at Exec rate  
- Autoship after upgrade: old pending first  
- Upgrade basket FIFO-drops using old Autoship units  
- Same/lower / Supreme upgrade 400  
- Reactivate before 6 issued 400  
- Reactivate: full Instant LEGACY_CASHOUT; `monthlyQualifiedAt` unchanged; new months increased if qualified  
- Inactive Successlines still count toward 3  
- Zero Successlines: still can withdraw Instant  
- Cancel intent → AUTOSHIP  
- No second Instant on Autoship  
- Idempotent replay  
- USD ÷ 1000  
- Phase 2 period migration onto a JOIN cycle  

---

## 12. Implementation order

1. Cycle + events; migrate periods  
2. Quote + start/cancel + me flags  
3. Checkout floors + LEGACY_VOUCHER  
4. Paid handler (drop → Instant on LEGACY_CASHOUT → new cycle; keep qualifiedAt)  
5. History + priorPending  
6. Admin timeline  
7. Tests
