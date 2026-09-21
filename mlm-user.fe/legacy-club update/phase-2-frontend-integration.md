# Frontend Integration — Legacy Club Phase 2

**Date:** 2026-09-18  
**Updated:** 2026-09-18 — Legacy voucher; no cashout lock; base vs increased monthly  
**Status:** **Not shipped** — extends updated Phase 1 contract  
**Audience:** Member app + admin app

Related:

- [Phase 2 context](./phase-2-context.md)
- [Phase 2 UI/UX](./phase-2-ui-ux.md)
- [Phase 2 backend](./phase-2-backend.md)
- [Phase 1 FE](./phase-1-frontend-integration.md)

---

## 1. Summary

Phase 2 extends `GET /legacy/me`, adds `GET /legacy/months`, and **reopens** Legacy checkout for `ACTIVE` members (Autoship / PV-only) paid with **`LEGACY_VOUCHER`**.

Frontend must:

1. Stop treating `LEGACY_SHOP_JOIN_ONLY` as the ACTIVE happy path.  
2. Use `shopMode` for join vs Autoship.  
3. Never add `pendingAmount` into `legacyCashout.balance`.  
4. Never treat `directSuccesslineCount < 3` as a cashout lock.  
5. Show **Base** vs **Increased** on months.  
6. Pay Autoship with `LEGACY_VOUCHER`, not `VOUCHER`.

---

## 2. `GET /legacy/me` (extended)

Phase 1 fields stay (`canCashoutLegacy: true` when wallet exists, `legacyVoucher`, `minDirectsToIncreaseMonthly`). When `ACTIVE`:

```json
{
  "cycle": {
    "startedAt": "2026-09-18T10:00:00.000Z",
    "cycleMonths": 6,
    "issuedCount": 2,
    "droppedCount": 1,
    "pendingCount": 1,
    "pendingAmount": 15000,
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
}
```

`shopMode`: `JOIN` | `AUTOSHIP` | `NONE`  
`nextDueRateTier`: `BASE` | `INCREASED`

| Field | UI |
|---|---|
| `cycle.pendingAmount` | Waiting — not in cashout balance |
| `cycle.nextDueAmount` + `nextDueRateTier` | Next month card |
| `cycle.isCycleComplete` | Banner, no Reactivate |
| `monthlyQualify.isQualified` | “Increased” copy vs “refer N more” |
| `autoship.requiredAmount` | Shop sticky bar |
| `legacyCashout.balance` | Dropped only |
| `canCashoutLegacy` | Always enable if wallet exists |

If `cycle` is missing (Phase 1-only backend): hide monthly/Autoship; shop stays closed for ACTIVE.

Ignore deprecated `minDirectsToCashout` / `canCashoutLegacy: false` if an old backend still sends them.

---

## 3. `GET /legacy/months`

```http
GET /legacy/months
```

**403** if not ACTIVE.

Each month: `periodIndex`, `dueAt`, `amount`, `rateTier` (`BASE` | `INCREASED`), `status` (`SCHEDULED` | `PENDING` | `DROPPED`), `droppedAt`, `autoshipOrderId`.

Always render `cycleMonths` rows. Chip rate + status. Bind `monthlyQualify` for the banner.

---

## 4. Cart & checkout (ACTIVE)

`channel=LEGACY`. **No** join purchase floor when `shopMode === AUTOSHIP`.

Pay:

```http
POST /orders/checkout/:checkoutId/pay-wallet
{ "walletType": "LEGACY_VOUCHER" }
```

```
units = Math.floor(cartSubtotal / me.autoship.requiredAmount)
release = Math.min(units, me.cycle.pendingCount)
```

If `pendingCount > 0` && `release === 0`: warn, allow pay (PV only).  
If `pendingCount === 0`: *Early Autoship does not keep a credit.*

| Code | UI |
|---|---|
| `LEGACY_SHOP_JOIN_ONLY` | Backend not on Phase 2 |
| `LEGACY_CART_BELOW_PACKAGE` | JOIN mode only |
| `LEGACY_VOUCHER_REQUIRED` | Wrong pay wallet |
| `LEGACY_JOIN_REQUIRED` | Redirect join |

On 200: `DELETE /cart?channel=LEGACY`, refresh `/legacy/me` + `/legacy/months`. If `pendingCount` fell, show amount now in Legacy account.

---

## 5. Screen → API

| Screen | Load |
|---|---|
| Home | `/legacy/me` |
| `/legacy/months` | `/legacy/months` |
| Shop ACTIVE | cart `LEGACY` + `/legacy/me` |
| Checkout | Phase 1 checkout + `LEGACY_VOUCHER` |
| Voucher | `/legacy/voucher` |

---

## 6. Packages / admin

`GET /legacy/packages` and admin PUT expose `monthlyCommissionBase` and `monthlyCommissionIncreased` (caller currency / NGN). Label monthly+Autoship **live**.

Admin member detail: `monthlyQualifiedAt` + period `rateTier`.

No new RBAC.

---

## 7. QA checklist

- Day 0: next due 30 days, pending 0, Instant already in Legacy account, shop open, pay Legacy voucher.  
- After 30 days, 0 Successlines: month 1 PENDING at **base**; cashout of Instant still works.  
- 3rd Successline mid-cycle: already-pending months unchanged; **next** due shows **increased**.  
- Qualify in month 5: only month 6 increased.  
- Autoship ≥ required: drop, Legacy account up, sponsor bonus, no Instant, no PPPC.  
- Network `VOUCHER` pay on Autoship fails.  
- Early Autoship: PV only; after due still waiting.  
- `pendingAmount` never added to displayed cashout.  
- Cycle complete: banner, no 7th month, no Reactivate, pending can still drop.  
- USD Autoship $10 / $40 / $80; increased monthly $30 / $120 / $250.  
- Network shop still PPPC.
