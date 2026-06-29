# Earnings History — Additive API Fields (Backend Spec)

**Date:** 2026-06-29  
**Audience:** Backend team  
**Related contract:** [`EARNINGS_CARD_HISTORY_ENDPOINTS.md`](./EARNINGS_CARD_HISTORY_ENDPOINTS.md)  
**Related UI:** [`earnings-overview.component.html`](../src/app/pages/commissions/earnings-overview.component.html) — **Earnings drop history** table

---

## Summary

**Do not change endpoints, pagination, card keys, or response structure.**

Keep the existing API exactly as documented:

- `GET /earnings/cards/summary` — unchanged
- `GET /earnings/cards/{cardKey}/history` — **same shape**; add extra fields on each `items[]` row

The frontend table stays the same columns:

| Date | Status | Source | Value dropped |

We only need the backend to **populate richer values** in the existing fields and add a few **optional extra properties** on each row so users see *who* triggered the commission, *which level/stage*, and a clear *description* — instead of only a total or a generic source label.

---

## What stays the same

| Item | No change |
|------|-----------|
| Paths | `/earnings/cards/summary`, `/earnings/cards/{cardKey}/history` |
| `cardKey` values | PDPA, CDPA, REGISTRATION_PV, DIRECT_REFERRAL_PV, PPPC, DRPPC, CPPC, PERSONAL_CPV, CPV_CASH_BONUS |
| Top-level response | `cardKey`, `unit`, `currency`, `items[]`, `nextCursor` |
| Existing row fields | `id`, `date`, `status`, `source`, `value`, `runningBalance`, `description`, `sourceRef`, `metadata` |
| Pagination | `limit`, `cursor`, `from`, `to`, `status` query params |
| Summary cards | Still totals only (`value` + `unit`) — no new endpoint |

---

## What to add on each `items[]` row

Add these **new optional fields** alongside existing ones (backward compatible):

| New field | Type | When to populate |
|-----------|------|------------------|
| `sourceUsername` | string \| null | Public username of the user who triggered the earning (buyer, referral, downline). `null` if not applicable (e.g. system PDPA). |
| `sourceUserId` | string \| null | Internal user ID (optional, for admin/deep links) |
| `level` | number \| null | Community/matrix level (1–13) when applicable |
| `stage` | number \| null | Earner's stage at credit time when applicable |
| `earningType` | string \| null | Canonical type, e.g. `DIRECT_REFERRAL_PRODUCT_PURCHASE`, `CDPA` |

Also **improve existing fields** (no rename):

| Existing field | Backend should return |
|----------------|----------------------|
| `source` | Keep as short label; may include `@username` when relevant |
| `description` | **Non-empty** human-readable line, e.g. *"Level 3 community bonus from @johndoe — Order #ORD-123"* |

---

## Example response (same structure + extra fields)

```json
{
  "cardKey": "DRPPC",
  "unit": "MONEY",
  "currency": "NGN",
  "items": [
    {
      "id": "evt_123",
      "date": "2026-06-28T14:22:00.000Z",
      "status": "POSTED",
      "source": "@janedoe",
      "sourceRef": "ORD-8842",
      "value": 2400,
      "runningBalance": 4800,
      "description": "Direct referral product commission from @janedoe — Order #ORD-8842",
      "earningType": "DIRECT_REFERRAL_PRODUCT_PURCHASE",
      "sourceUsername": "janedoe",
      "sourceUserId": "usr_jane_001",
      "level": null,
      "stage": 2,
      "metadata": {
        "orderId": "ord_uuid",
        "baseAmount": 48000,
        "ratePct": 5
      }
    }
  ],
  "nextCursor": "opaque_cursor_here"
}
```

CDPA example (level + source user):

```json
{
  "id": "evt_456",
  "date": "2026-06-28T00:05:00.000Z",
  "status": "POSTED",
  "source": "@mikeuser",
  "value": 320,
  "runningBalance": 1600,
  "description": "CDPA (12%) from @mikeuser's PDPA — Level 4",
  "earningType": "CDPA",
  "sourceUsername": "mikeuser",
  "sourceUserId": "usr_mike_002",
  "level": 4,
  "stage": 3,
  "metadata": {
    "package": "GOLD",
    "downlinePackage": "SILVER",
    "cdpaPercent": 12
  }
}
```

---

## Field guide by earning type

| Card / type | `sourceUsername` | `level` | `stage` | `description` (example) |
|-------------|------------------|---------|---------|-------------------------|
| PPPC | `null` (self) | null | earner stage | Personal product commission — Order #ORD-7710 |
| DRPPC | buyer username | null | earner stage | DRPPC from @{user} — Order #… |
| CPPC | downline username | 1–13 | earner stage | Level {n} CPPC from @{user} — Order #… |
| CDPA | downline username | 1–13 | earner stage | CDPA ({rate}%) from @{user}'s PDPA |
| PDPA | `null` | null | earner stage | PDPA daily allocation ({rate}%) |
| DIRECT_REFERRAL_PV | referred username | null | earner stage | Registration PV from @{user} |
| CPV_CASH_BONUS | `null` | null | milestone | CPV cash bonus — {milestone name} |

Use the member's **public username** (not email). Frontend displays `@` prefix.

---

## Frontend usage (no layout change)

Existing mapping in `earnings.service.ts` already reads `description` and `metadata`.

After backend ships, the **Source** column will show:

1. `sourceUsername` as `@username` when present, else existing `source`
2. `description` on the line below (already supported in template)
3. `level` / `stage` inline in `description` or `metadata` when useful

No new columns. No new endpoints. No change to summary cards.

---

## Acceptance criteria

1. Response JSON shape unchanged — only **additional properties** on `items[]`.
2. All existing fields still returned (`id`, `date`, `status`, `source`, `value`, etc.).
3. Each history row includes a meaningful **`description`** string.
4. Rows triggered by another member include **`sourceUsername`**.
5. Level-based credits include **`level`** (1–13) when applicable.
6. **`stage`** included when available at credit time.
7. Empty history still returns `items: []` with `200`.
8. Pagination behaviour unchanged.

---

## Optional (same additive pattern)

If convenient, the same extra fields may also be added to **`GET /earnings`** list items and **`GET /earnings/activity`** ledger rows — but the **priority** is `GET /earnings/cards/{cardKey}/history` used by the Earnings drop history table.

---

## Questions for backend

1. Will historical rows be **backfilled**, or only new credits after deploy?
2. For system PDPA, is `sourceUsername` always `null`?
3. Should `stage` be a snapshot at credit time?

Please confirm when the extra fields will be available on `/earnings/cards/{cardKey}/history`.
