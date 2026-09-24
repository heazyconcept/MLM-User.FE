# Legacy PV Dashboard — Frontend Integration

How the **User FE** consumes Legacy marketplace Product Volume (PV): summary on `GET /legacy/me` and history on `GET /legacy/pv/history`.

**Backend spec:** [`BACKEND_REQUEST_LEGACY_PV_DASHBOARD.md`](./BACKEND_REQUEST_LEGACY_PV_DASHBOARD.md)

---

## Problem & resolution

Members who buy on the **Legacy marketplace** (`channel: LEGACY`, pay with `LEGACY_VOUCHER`) earn PV that credits the **network ledger**, but previously had **no Legacy dashboard view** to verify it.

**Shipped behavior:**

1. **`GET /legacy/me` → `legacyPv`** — total + breakdown on Legacy home
2. **`GET /legacy/pv/history`** — own purchases and direct Successline referral PV rows

Legacy APIs are a **filtered read model** over existing CPV transactions. Network milestone / CPV math is unchanged.

---

## Authentication

Same as other `/legacy/*` member routes:

```http
Authorization: Bearer <accessToken>
```

- **401** — missing/invalid JWT
- **403** — not registration-paid or not eligible Legacy member

Responses may use `{ "status": "success", "data": { ... } }`. FE unwraps `data` in `LegacyClubService`.

---

## 1. PV summary — `GET /legacy/me`

### Request

```http
GET /legacy/me
Authorization: Bearer <token>
```

### `legacyPv` block (nested on `LegacyMe`)

```json
{
  "legacyPv": {
    "totalPv": 450,
    "personalProductPv": 300,
    "directReferralProductPv": 150
  }
}
```

| Field | Type | Meaning |
|-------|------|---------|
| `personalProductPv` | number | Buyer PV from own paid Legacy marketplace orders |
| `directReferralProductPv` | number | Sponsor PV from direct Successline Legacy purchases |
| `totalPv` | number | `personalProductPv + directReferralProductPv` |

When none: all three are **0** (always present).

### FE usage

| File | Role |
|------|------|
| `legacy-club.service.ts` | `loadMe()` → `normalizeLegacyMe()` |
| `legacy-home.component.ts` | Legacy PV metric card |
| `legacy-club.models.ts` | `LegacyPvSummary`, `legacyPvCardDescription()` |

---

## 2. PV history — `GET /legacy/pv/history`

### Request

```http
GET /legacy/pv/history?limit=20
GET /legacy/pv/history?limit=20&cursor=2026-09-23T12:00:00.000Z
Authorization: Bearer <token>
```

| Query | Type | Default | Notes |
|-------|------|---------|-------|
| `limit` | number | 20 | Min 1, max 100 |
| `cursor` | string | — | **ISO `createdAt` of last item** from previous page (not row `id`) |

Pagination is **cursor-only** (`limit` + optional `cursor`). Always send `limit` on every request, including “Load more”.

### Response

```json
{
  "items": [
    {
      "id": "tx-own",
      "kind": "OWN_PURCHASE",
      "pvAmount": 30,
      "at": "2026-09-23T12:00:00.000Z",
      "orderId": "ord-1",
      "orderReference": "ORD-…",
      "orderTotal": 15000,
      "currency": "NGN",
      "productSummary": "Wellness Pack × 2",
      "buyerUsername": null,
      "downlineUsername": null
    },
    {
      "id": "tx-ref",
      "kind": "DIRECT_REFERRAL_PURCHASE",
      "pvAmount": 15,
      "at": "2026-09-23T11:30:00.000Z",
      "orderId": "ord-2",
      "orderReference": "ORD-…",
      "orderTotal": null,
      "currency": null,
      "productSummary": "Tea × 1",
      "buyerUsername": "jane_doe",
      "downlineUsername": "jane_doe"
    }
  ],
  "nextCursor": "2026-09-23T11:30:00.000Z"
}
```

| Field | Notes |
|-------|-------|
| `nextCursor` | ISO timestamp of last item when more pages exist; `null` when done |
| `kind` | `OWN_PURCHASE` ← `PRODUCT_PURCHASE_PV`; `DIRECT_REFERRAL_PURCHASE` ← `LEGACY_DIRECT_SUCCESSLINE_PV` |
| `productSummary` | Built from order line items: `"Product name × qty"` joined with `, ` |
| `orderReference` | Compact reference from order id |
| `downlineUsername` | From `metadata.fromUserId` on sponsor CPV row |

Sort: **newest first** (merged personal + sponsor CPV rows).

### FE usage

| File | Role |
|------|------|
| `legacy-club.service.ts` | `getPvHistory()`, `mapPvHistoryResponse()` |
| `legacy-pv-history.component.ts` | Route `/legacy/pv/history`, “Load more” via `nextCursor` |
| `legacy-club.models.ts` | `LegacyPvHistoryItem`, `legacyPvHistoryRowTitle()` |

---

## Network ledger mapping

On **Legacy order paid** (`channel: LEGACY`), the backend still writes network CPV:

| Recipient | CPV `source` | Legacy history `kind` |
|-----------|--------------|------------------------|
| Buyer | `PRODUCT_PURCHASE_PV` | `OWN_PURCHASE` |
| Legacy direct sponsor | `LEGACY_DIRECT_SUCCESSLINE_PV` | `DIRECT_REFERRAL_PURCHASE` |

Legacy shop does **not** write PPPC / network direct-referral product cash commissions. Community / matrix CPV from Legacy orders stays on network earnings only (v1).

**Do not** merge PV rows into `GET /legacy/history` (membership JOIN / UPGRADE / REACTIVATE / SEED only).

---

## User FE routes

| Route | Screen | API |
|-------|--------|-----|
| `/legacy/home` | Legacy PV metric card | `GET /legacy/me` |
| `/legacy/pv/history` | PV history | `GET /legacy/pv/history` |
| `/legacy/history` | Membership history (unchanged) | `GET /legacy/history` |

After Legacy checkout, `legacy-checkout.service.ts` calls `loadMe()` to refresh the summary card.

---

## TypeScript types (User FE)

See `src/app/core/models/legacy-club.models.ts`:

- `LegacyPvSummary`
- `LegacyPvHistoryItem`
- `LegacyPvHistoryResponse`
- `LegacyPvHistoryKind` = `'OWN_PURCHASE' | 'DIRECT_REFERRAL_PURCHASE'`

Service mappers also accept snake_case aliases (`legacy_pv`, `pv_amount`, etc.).

---

## Verification

### Frontend (shipped)

- [x] Legacy home card from `legacyPv.totalPv`
- [x] Breakdown subtitle (personal vs Successline)
- [x] PV history page with cursor load-more
- [x] Separate from membership history

### Live probe

Requires a logged-in Legacy member token against the deployed API (e.g. `https://api.segulah.ng`). Unauthenticated calls return **401** on `/legacy/me`. Ensure the API build including `GET /legacy/pv/history` is deployed — older deployments may return **404**.
