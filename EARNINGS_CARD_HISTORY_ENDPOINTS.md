# Earnings Cards and History Frontend Integration

Date: 2026-04-20  
Area: Earnings Overview (cards + per-card history table)

This document reflects the implemented backend endpoints and how frontend should integrate them.

## Implemented Endpoints

1. `GET /earnings/cards/summary`
2. `GET /earnings/cards/:cardKey/history`

Controller: `EarningsController`  
Guards: JWT + `RegistrationPaidGuard`

All requests require:

- `Authorization: Bearer <token>`

---

## 1) `GET /earnings/cards/summary`

Use this as the single source for card totals.

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

### Contract notes

- `cards` always includes all 9 keys (stable shape).
- Unknown/empty values are returned as `0` values, not omitted keys.
- `currency` is user registration currency for money formatting.

---

## 2) `GET /earnings/cards/:cardKey/history`

Use this endpoint to fetch rows for the selected card table.

### Request

- Method: `GET`
- Path: `/earnings/cards/{cardKey}/history`
- Path param:
  - `cardKey` required
- Query params:
  - `limit` optional, default `20`, min `1`, max `100`
  - `cursor` optional, opaque cursor from previous `nextCursor`
  - `from` optional, ISO datetime
  - `to` optional, ISO datetime
  - `status` optional: `POSTED` | `PENDING` | `FAILED`

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
      "source": "PDPA",
      "sourceRef": "pdpa-2026-04-20-user123",
      "value": 120,
      "runningBalance": 4200,
      "description": "PDPA"
    }
  ],
  "nextCursor": "opaque_cursor_here"
}
```

`nextCursor` is omitted when there is no more page.

### Status/filter behavior (important)

- Money cards (`PDPA`, `CDPA`, `PPPC`, `DRPPC`, `CPPC`, `CPV_CASH_BONUS`):
  - `POSTED` maps to backend `AVAILABLE`
  - `PENDING` maps to backend `PENDING`
  - `FAILED` returns empty `items: []` (no failed rows in current model)
- PV cards (`REGISTRATION_PV`, `DIRECT_REFERRAL_PV`, `PERSONAL_CPV`):
  - data source is CPV transactions and rows are always `status: "POSTED"`
  - if `status=PENDING` or `status=FAILED`, endpoint returns `items: []`

---

## Frontend Integration Flow

### Initial screen load

1. Call `GET /earnings/cards/summary`
2. Render cards directly from `cards` map
3. Select default card (for example `PDPA`)
4. Call history endpoint for selected card with `limit=20`

### Card switch

1. When card changes, clear table and cursor
2. Call `GET /earnings/cards/{cardKey}/history?limit=20`
3. Render returned rows

### Load more

1. If `nextCursor` exists, call:
   - `/earnings/cards/{cardKey}/history?limit=20&cursor=<nextCursor>`
2. Append rows
3. Stop when `nextCursor` is missing

Treat cursor as opaque. Do not parse or construct it on frontend.

### Filters

- If UI sends `from`, `to`, or `status`, include them as query params on the same endpoint.
- Invalid ISO dates or malformed cursor return `400`.

---

## Frontend Table Mapping

Use these fields directly:

1. Date -> `items[].date`
2. Status -> `items[].status`
3. Source -> `items[].source`
4. Value Dropped -> `items[].value` (format by `unit`)
5. Optional Running Balance -> `items[].runningBalance`

Money formatting rule:

- For `unit: "MONEY"`, use `currency` from response.
- For `unit: "PV"`, render as PV (no money symbol).

---

## Error Handling

Expected statuses:

1. `400` invalid `cardKey`, bad cursor, or invalid date query
2. `401` unauthorized
3. `403` registration-paid guard failed

Typical invalid card key message:

```json
{
  "statusCode": 400,
  "message": "Invalid cardKey. Supported values: PDPA, CDPA, REGISTRATION_PV, DIRECT_REFERRAL_PV, PPPC, DRPPC, CPPC, PERSONAL_CPV, CPV_CASH_BONUS"
}
```

---

## Suggested Frontend Types

```ts
type EarningsCardKey =
  | 'PDPA'
  | 'CDPA'
  | 'REGISTRATION_PV'
  | 'DIRECT_REFERRAL_PV'
  | 'PPPC'
  | 'DRPPC'
  | 'CPPC'
  | 'PERSONAL_CPV'
  | 'CPV_CASH_BONUS';

type EarningsCardsSummaryResponse = {
  currency: 'NGN' | 'USD';
  cards: Record<EarningsCardKey, { value: number; unit: 'MONEY' | 'PV' }>;
};

type EarningsCardHistoryItem = {
  id: string;
  date: string;
  status: 'POSTED' | 'PENDING';
  source: string;
  sourceRef?: string;
  value: number;
  runningBalance?: number;
  description?: string;
};

type EarningsCardHistoryResponse = {
  cardKey: EarningsCardKey;
  unit: 'MONEY' | 'PV';
  currency: 'NGN' | 'USD';
  items: EarningsCardHistoryItem[];
  nextCursor?: string;
};
```
