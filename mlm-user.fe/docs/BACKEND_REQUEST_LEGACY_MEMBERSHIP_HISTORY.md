# Backend request: unified Legacy membership history

**Status:** Open — frontend interim merge shipped; backend unified endpoint pending  
**Area:** `GET /legacy/history` — membership lifecycle + Legacy cashout ledger  
**Audience:** HerbApi / Legacy Club backend  
**Related FE:** [`legacy-history.component.ts`](../src/app/pages/legacy-club/legacy-history/legacy-history.component.ts)

---

## Problem

Members see Legacy cashout activity on `/legacy/account` but **Membership history** (`/legacy/history`) is empty.

### Root causes

1. **Response shape mismatch (fixed on FE)**  
   Backend returns `{ currency, events: [...] }` while the original FE expected `{ items: [...] }` with different field names (`type` vs `kind`, `instantCommission` vs `instantAmount`, `createdAt` vs `at`).

2. **Scope gap**  
   `GET /legacy/history` only returns `LegacyMembershipEvent` rows (JOIN / UPGRADE / REACTIVATE / SEED). It does **not** include:

   - Instant membership commission credits
   - Successline instant bonuses (`LEGACY_SUCCESSLINE_INSTANT_BONUS`)
   - Weekly/monthly membership commission drops
   - Cashout withdrawals and wallet transfers

   Those rows live on `GET /legacy/cashout` → `items[]` (ledger).

3. **Missing event rows for some members**  
   Active members may have cashout ledger credits but zero `LegacyMembershipEvent` rows if activation paths did not write events (seed, migration, or failed event insert).

---

## Product requirement

`/legacy/history` should be the **single source of truth** for Legacy account activity:

| Include | Exclude |
|---|---|
| Join / upgrade / reactivate / seed | Legacy PV (stays on `GET /legacy/pv/history`) |
| Instant commission | Network wallet activity |
| Successline instant + monthly bonuses | |
| Weekly membership commission credits | |
| Withdrawals and transfers out of Legacy cashout | |

Cashout page keeps balance + actions and shows a **3-row preview** linking to full history.

---

## Interim frontend (shipped)

Until backend ships a unified feed, User FE:

1. Maps `events[]` → normalized `items[]` via `mapLegacyHistoryResponse()`.
2. Loads `GET /legacy/cashout?limit=50` and merges ledger rows client-side.
3. Dedupes join instant vs matching instant-commission ledger credit (same amount within 5 minutes).
4. Paginates ledger via cashout `nextCursor` (“Load more”).

---

## Requested backend contract

Extend **`GET /legacy/history`** to return one paginated timeline.

### Request

```http
GET /legacy/history?limit=20&cursor=2026-09-23T12:50:06.000Z
```

| Param | Notes |
|---|---|
| `limit` | 1–100, default 20 |
| `cursor` | ISO `createdAt` of last item from previous page |

### Response

```json
{
  "status": "success",
  "data": {
    "currency": "NGN",
    "items": [
      {
        "id": "ledger-uuid",
        "kind": "SUCCESSLINE_INSTANT_BONUS",
        "at": "2026-09-23T15:00:00.000Z",
        "title": "Legacy Successline bonus — Instant from bode",
        "amount": 4000,
        "direction": "CREDIT",
        "currency": "NGN",
        "subtitle": null,
        "metadata": {
          "earningType": "LEGACY_SUCCESSLINE_INSTANT_BONUS",
          "fromUsername": "bode"
        }
      },
      {
        "id": "event-uuid",
        "kind": "JOIN",
        "at": "2026-09-23T12:50:06.000Z",
        "title": "Joined SUPREME",
        "amount": 200000,
        "direction": "CREDIT",
        "currency": "NGN",
        "subtitle": "Package payment ₦500,000",
        "metadata": {
          "package": "SUPREME",
          "payAmount": 500000,
          "cycleId": "cycle-uuid",
          "orderId": "order-uuid"
        }
      }
    ],
    "nextCursor": "2026-09-23T12:50:06.000Z"
  }
}
```

### `kind` enum

| Kind | Source |
|---|---|
| `JOIN` | `LegacyMembershipEvent` |
| `UPGRADE` | `LegacyMembershipEvent` |
| `REACTIVATE` | `LegacyMembershipEvent` |
| `SEED` | `LegacyMembershipEvent` |
| `INSTANT_COMMISSION` | Ledger earning `LEGACY_INSTANT_COMMISSION` |
| `SUCCESSLINE_INSTANT_BONUS` | Ledger earning `LEGACY_SUCCESSLINE_INSTANT_BONUS` |
| `MONTHLY_COMMISSION` | Ledger earning `LEGACY_MONTHLY_COMMISSION` |
| `SUCCESSLINE_MONTHLY_BONUS` | Ledger earning `LEGACY_SUCCESSLINE_MONTHLY_BONUS` |
| `WITHDRAWAL` | Ledger withdrawal debit |
| `TRANSFER` | Ledger transfer debit |

### Implementation notes (HerbApi)

1. **Union query** — merge `LegacyMembershipEvent` + `LEGACY_CASHOUT` ledger rows (same source as [`getCashout()`](../../HerbApi/src/modules/legacy-club/legacy-club.service.ts)).
2. **Titles** — reuse [`formatLedgerActivityDescription()`](../../HerbApi/src/modules/earnings/utils/format-ledger-activity-description.util.ts) for ledger rows; membership titles like `Joined {package}`.
3. **Include `id`** on membership events (currently omitted in service mapper).
4. **Transfer metadata** — always persist `toWalletType` on transfer ledger rows so descriptions are not `Move to undefined`.
5. **Deprecation** — keep `events[]` as optional alias during transition, or document breaking change with FE already accepting `items[]`.
6. **Backfill** — for ACTIVE members with cashout credits but zero membership events, insert a JOIN/SEED event from cycle/membership data.

### Successline bonus verification

When a direct Successline pays to join, sponsor must receive `LEGACY_SUCCESSLINE_INSTANT_BONUS` on `LEGACY_CASHOUT` (see [`legacy-payment.repository.ts`](../../HerbApi/src/modules/legacy-club/legacy-payment.repository.ts) ~519–535). If Successlines exist but no bonus ledger rows appear, treat as a **payout bug** separate from history UI.

---

## Acceptance criteria

- [ ] `GET /legacy/history` returns `items[]` (not only `events[]`).
- [ ] Join row appears for active members who completed payment.
- [ ] Successline instant bonuses appear when paid.
- [ ] Transfers and withdrawals appear with human-readable titles (no `undefined` destination).
- [ ] Cursor pagination works; newest first.
- [ ] FE can drop client-side merge with `GET /legacy/cashout` for history once deployed.

---

## Frontend switch-over

When unified `items[]` ships:

1. Detect unified feed (items include non-membership kinds or `title` + `direction`).
2. Remove client-side merge with cashout ledger.
3. Paginate history via `GET /legacy/history` cursor only.

See [`legacy-history.util.ts`](../src/app/core/utils/legacy-history.util.ts) and [`frontend-integration-legacy-pv-dashboard.md`](./frontend-integration-legacy-pv-dashboard.md) (PV remains separate).
