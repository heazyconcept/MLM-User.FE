# Frontend Integration — Legacy Club Phase 3

**Date:** 2026-09-18  
**Updated:** 2026-09-18 — Instant in Legacy account; LEGACY_VOUCHER; keep increased monthly; no lock  
**Status:** **Not shipped** — extends Phase 1–2 contracts  
**Audience:** Member app + admin app

Related:

- [Phase 3 context](./phase-3-context.md)
- [Phase 3 UI/UX](./phase-3-ui-ux.md)
- [Phase 3 backend](./phase-3-backend.md)
- [Phase 1 FE](./phase-1-frontend-integration.md) · [Phase 2 FE](./phase-2-frontend-integration.md)

---

## 1. Summary

Upgrade and reactivate **intents**, shop floors, history. Instant after pay is in `legacyCashout`, not CASH. Pay with **`LEGACY_VOUCHER`**. Do not treat `isCycleComplete` as a dead end. Do not lock cashout on Successline count. If `monthlyQualify.isQualified`, show that they **keep the increased monthly** after reactivate.

Pending is never part of `legacyCashout.balance`. Show `priorPending` after upgrade.

---

## 2. `GET /legacy/me` (additions)

Phase 1–2 fields stay. New:

```json
{
  "intent": "NONE",
  "intentPackage": null,
  "shopMode": "AUTOSHIP",
  "canReactivate": false,
  "upgradeTargets": ["EXECUTIVE", "SUPREME"],
  "priorPending": { "count": 0, "amount": 0 }
}
```

`shopMode`: `JOIN` | `AUTOSHIP` | `UPGRADE` | `REACTIVATE` | `NONE`

| Field | UI |
|---|---|
| `upgradeTargets` | Upgrade card / picker |
| `canReactivate` | Reactivate card |
| `monthlyQualify.isQualified` | “Keep increased monthly” on reactivate |
| `shopMode` | Cart floor + chip |
| `intent` | Resume / cancel |
| `priorPending` | Months callout |
| `canCashoutLegacy` | Always enable if wallet exists |

---

## 3. Quote

```http
GET /legacy/upgrade/quote?package=EXECUTIVE
```

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

Copy: Instant **to your Legacy account**. Show both monthly figures.

**400:** `PACKAGE_NOT_HIGHER` | `PACKAGE_INACTIVE` | `NOT_LEGACY_MEMBER`

---

## 4. Start / cancel

`POST /legacy/upgrade/start` `{ "package": "EXECUTIVE" }` → shop.  
`POST /legacy/upgrade/cancel`  
`POST /legacy/reactivate/start` — **400** `CYCLE_NOT_COMPLETE`  
`POST /legacy/reactivate/cancel`  

Last start wins if they flip intents. UI should only offer one path at a time.

---

## 5. History

`GET /legacy/history` — `JOIN` | `UPGRADE` | `REACTIVATE` | `SEED`. Instant column is Legacy-account credit.

---

## 6. `GET /legacy/months`

Add `priorPending[]`: `cyclePackage`, `periodIndex`, `amount`, `rateTier`, `dueAt`, `status`.  
`months[]` = current cycle only.

---

## 7. Cart & checkout

`channel: LEGACY`. Pay **`LEGACY_VOUCHER`** for every Legacy purpose.

| `shopMode` | Disable Checkout when |
|---|---|
| `JOIN` | subtotal `< purchaseRequired` |
| `UPGRADE` | subtotal `< quote.payAmount` |
| `REACTIVATE` | subtotal `< current purchaseAmount` |
| `AUTOSHIP` | never (warn if pending and below one unit) |

`releaseUnits = min(floor(subtotal / autoship.requiredAmount), pendingCount + priorPending.count)`

On 200: clear Legacy cart, `/legacy/me` (new package or new `cycle.startedAt`, Instant inside `legacyCashout`), success page.

| Code | UI |
|---|---|
| `LEGACY_CART_BELOW_PACKAGE` | Remaining |
| `LEGACY_VOUCHER_REQUIRED` | Wrong wallet |
| `PACKAGE_NOT_HIGHER` | Upgrade picker |
| `CYCLE_NOT_COMPLETE` | Home |
| `LEGACY_JOIN_REQUIRED` | Join |

Do not handle `LEGACY_CASHOUT_LOCKED`.

---

## 8. Screen → API

| Screen | Load | Mutations |
|---|---|---|
| Home CTAs | `/legacy/me` | — |
| Upgrade | `/legacy/me` + quote | `upgrade/start` |
| Reactivate | `/legacy/me` | `reactivate/start` |
| Shop cancel | `/legacy/me` | matching cancel |
| History | `/legacy/history` | — |
| Months | `/legacy/months` | — |
| Voucher | `/legacy/voucher` | fund before pay |

---

## 9. Admin

Member detail: `events`, `cycles[]` with `rateTier`, `monthlyQualifiedAt`.  
Packages: difference preview + base/increased. No new RBAC.

---

## 10. QA

- VIP: Upgrade visible; after 6 dues also Reactivate; Supreme hides Upgrade.  
- Quote VIP→Exec: pay 140000, Instant 60000 (NGN) / 140 and 60 (USD).  
- Pay with network voucher fails; Legacy voucher succeeds.  
- After upgrade: Instant in `legacyCashout` not CASH; new cycle; history; prior pending listed.  
- Already 3: next new-cycle month preview **INCREASED** at new package.  
- Not 3: new month **BASE** at new package.  
- Old pending drops at snapshot; new month 1 in 30 days.  
- Cancel upgrade → Autoship shop, package unchanged.  
- Reactivate before 6 dues: 400.  
- Reactivate: full Instant in Legacy account; `monthlyQualify` unchanged; copy “keep increased” if qualified.  
- Cash out Instant with zero Successlines still works.  
- No second Instant on Autoship.  
- Network shop still PPPC.  
- Replay pay does not double Instant.
