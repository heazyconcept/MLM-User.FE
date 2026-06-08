# Dashboard Endpoints and Frontend Integration

This document describes the implemented dashboard backend endpoints and exactly how frontend should integrate them.

## Implemented Endpoints

1. `GET /dashboard/overview`
2. `GET /dashboard/transactions?limit=10&cursor=...`

Both endpoints are in `DashboardController` and are protected by:

- JWT auth (`Authorization: Bearer <token>`)
- Registration-paid guard (only fully activated users can access)

## Frontend Integration Strategy

- Use `GET /dashboard/overview` as the single source of truth for hero balances and all 6 stat cards.
- Use `GET /dashboard/transactions` for the recent transactions table (cursor pagination).
- Do not recompute any dashboard card values on frontend.

---

## 1) Overview Endpoint

### Request

- **Method:** `GET`
- **Path:** `/dashboard/overview`
- **Auth required:** Yes (Bearer token)
- **Body:** None
- **Query params:** None

### Response shape

```json
{
  "currency": "NGN",
  "hero": {
    "totalWalletBalance": 125000,
    "voucherBalance": 30000,
    "autoshipBalance": 12000
  },
  "stats": {
    "cashoutBalance": 85000,
    "totalEarnings": 210500,
    "totalPayout": 60000,
    "productVoucher": 30000,
    "totalDownlines": 42,
    "totalCpvs": 980
  }
}
```

### UI mapping

#### Hero section

1. Total Wallet Balance -> `overview.hero.totalWalletBalance`
2. Vouchers -> `overview.hero.voucherBalance`
3. Autoship -> `overview.hero.autoshipBalance`

#### Stat cards

1. Cashout Balance -> `overview.stats.cashoutBalance`
2. Total Earnings -> `overview.stats.totalEarnings`
3. Total Payout -> `overview.stats.totalPayout`
4. Product Voucher -> `overview.stats.productVoucher`
5. Total Downlines -> `overview.stats.totalDownlines`
6. Total CPVs -> `overview.stats.totalCpvs`

### Frontend notes

- Use top-level `currency` for money formatting across hero/stats.
- Backend returns stable fields; values may be `0` when data is unavailable.

---

## 2) Transactions Endpoint

### Request

- **Method:** `GET`
- **Path:** `/dashboard/transactions`
- **Auth required:** Yes (Bearer token)
- **Query params:**
  - `limit` (optional, default `10`, min `1`, max `50`)
  - `cursor` (optional, opaque string from previous `nextCursor`)

### Response shape

```json
{
  "items": [
    {
      "id": "ledger_id",
      "date": "2026-04-19T11:45:00.000Z",
      "description": "Wallet funding",
      "type": "Credit",
      "amount": 50000,
      "currency": "NGN",
      "status": "Completed"
    }
  ],
  "nextCursor": "opaque_cursor_here"
}
```

`nextCursor` is omitted when there is no next page.

### UI mapping

1. Date -> `transactions.items[].date`
2. Description -> `transactions.items[].description`
3. Type -> `transactions.items[].type` (`Credit` | `Debit`)
4. Amount -> `transactions.items[].amount` + `transactions.items[].currency`
5. Status -> `transactions.items[].status` (`Completed` | `Pending` | `Failed`)

### Pagination flow (frontend)

1. First load: call `GET /dashboard/transactions?limit=10`
2. Save `nextCursor` from response
3. Load more: call `GET /dashboard/transactions?limit=10&cursor=<nextCursor>`
4. Append new `items` to table
5. Stop requesting when `nextCursor` is missing

Do not parse or generate cursor value on frontend. Treat it as opaque.

---

## Error Handling

Expected responses:

- `401 Unauthorized` -> missing/invalid token
- `403 Forbidden` -> user not registration-paid
- `400 Bad Request` -> invalid cursor format

Frontend behavior:

- `401/403`: redirect to auth or show access state
- `400` on paginated call: reset transaction list and reload first page

---

## Quick Actions (Frontend-owned)

These are routing/UI actions and are not returned by dashboard endpoints:

1. Create Successline -> `/network`
2. Fund Wallet -> `/wallet`
3. Withdraw Funds -> `/withdrawals`
4. View Commissions -> `/commissions`

---

## Suggested FE Types

```ts
type DashboardOverview = {
  currency: 'NGN' | 'USD';
  hero: {
    totalWalletBalance: number;
    voucherBalance: number;
    autoshipBalance: number;
  };
  stats: {
    cashoutBalance: number;
    totalEarnings: number;
    totalPayout: number;
    productVoucher: number;
    totalDownlines: number;
    totalCpvs: number;
  };
};

type DashboardTransaction = {
  id: string;
  date: string;
  description: string;
  type: 'Credit' | 'Debit';
  amount: number;
  currency: 'NGN' | 'USD';
  status: 'Completed' | 'Pending' | 'Failed';
};

type DashboardTransactionsResponse = {
  items: DashboardTransaction[];
  nextCursor?: string;
};
```
