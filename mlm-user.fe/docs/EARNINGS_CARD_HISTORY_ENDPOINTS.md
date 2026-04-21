# Earnings Card History Endpoints (Backend Contract)

Date: 2026-04-20
Owner: Frontend handoff to Backend
Area: Earnings Overview (per-card history tables)

## Goal
Frontend has been restructured so each earnings card can show its own history table.

Backend should provide:

1. A single summary endpoint for card totals.
2. A card-specific paginated history endpoint for table rows.

This removes fragile frontend mapping and gives consistent data for each card.

## Authentication and Access

All endpoints below must be:

1. JWT-protected (`Authorization: Bearer <token>`)
2. Registration-paid restricted (same policy used on existing earnings endpoints)

## Endpoint 1: Card Summary

### Request

- Method: `GET`
- Path: `/earnings/cards/summary`
- Query params: none

### Response

```json
{
  "currency": "NGN",
  "cards": {
    "PDPA": { "value": 4200, "unit": "MONEY" },
    "CDPA": { "value": 1600, "unit": "MONEY" },
    "REGISTRATION_PV": { "value": 150, "unit": "PV" },
    "DIRECT_REFERRAL_PV": { "value": 45, "unit": "PV" },
    "PPPC": { "value": 800, "unit": "MONEY" },
    "DRPPC": { "value": 350, "unit": "MONEY" },
    "CPPC": { "value": 120, "unit": "MONEY" },
    "PERSONAL_CPV": { "value": 520, "unit": "PV" },
    "CPV_CASH_BONUS": { "value": 3000, "unit": "MONEY" }
  }
}
```

### Notes

1. `cards` must always contain all supported keys (stable shape).
2. If data is unavailable for a card, return `value: 0`.
3. `unit` is required and must match card type (`MONEY` or `PV`).

## Endpoint 2: Per-Card History

### Request

- Method: `GET`
- Path: `/earnings/cards/{cardKey}/history`
- Path param:
  - `cardKey` required (see supported values below)
- Query params:
  - `limit` optional (default `20`, min `1`, max `100`)
  - `cursor` optional (opaque pagination cursor)
  - `from` optional (ISO datetime)
  - `to` optional (ISO datetime)
  - `status` optional (`POSTED`, `PENDING`, `FAILED`)

### Supported card keys

1. `PDPA`
2. `CDPA`
3. `REGISTRATION_PV`
4. `DIRECT_REFERRAL_PV`
5. `PPPC`
6. `DRPPC`
7. `CPPC`
8. `PERSONAL_CPV`
9. `CPV_CASH_BONUS`

### Response

```json
{
  "cardKey": "PDPA",
  "unit": "MONEY",
  "currency": "NGN",
  "items": [
    {
      "id": "evt_123",
      "date": "2026-04-20T08:10:00.000Z",
      "status": "POSTED",
      "source": "Daily allocation engine",
      "sourceRef": "alloc_2026_04_20",
      "value": 120,
      "runningBalance": 4200,
      "description": "PDPA daily drop"
    }
  ],
  "nextCursor": "opaque_cursor_here"
}
```

### Field requirements

Per row (`items[]`):

1. `id` string required
2. `date` ISO datetime required
3. `status` required (`POSTED` | `PENDING` | `FAILED`)
4. `source` string required
5. `value` number required
6. `runningBalance` number optional but strongly recommended
7. `description` optional
8. `sourceRef` optional

Top-level:

1. `cardKey` required
2. `unit` required (`MONEY` | `PV`)
3. `currency` required for money cards; can still be included for PV cards for consistency
4. `nextCursor` optional, omit when no more records

## Frontend Table Mapping

The frontend table uses these columns:

1. Date -> `items[].date`
2. Status -> `items[].status`
3. Source -> `items[].source`
4. Value Dropped -> `items[].value` with `unit`

Optional enhancement:

1. Running Balance -> `items[].runningBalance`

## Error Handling

Expected status codes:

1. `400` invalid query/card key/cursor
2. `401` unauthorized
3. `403` forbidden (registration not completed)
4. `404` card key not supported (optional if you prefer `400`)
5. `500` server error

Error payload should include explicit message.

Example:

```json
{
  "statusCode": 400,
  "message": "Invalid cardKey. Supported values: PDPA, CDPA, ...",
  "path": "/earnings/cards/XYZ/history"
}
```

## Acceptance Criteria

1. Each card has a dedicated history endpoint response using `cardKey`.
2. History rows include Date, Status, Source, Value.
3. Pagination uses opaque `nextCursor` and works consistently.
4. Summary endpoint returns all card totals in one response.
5. Frontend can switch cards without custom remapping logic.
6. Missing data returns stable empty/zero responses, not schema changes.

## Implementation Guidance (Backend)

1. Keep business aggregation in backend; frontend should display, not derive.
2. Ensure card-key filtering is strict and deterministic.
3. Use descending date order by default.
4. If a card has no history, return `items: []` with `200`.
5. Add integration tests for every card key and status filter.
