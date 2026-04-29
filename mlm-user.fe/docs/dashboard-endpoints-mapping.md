# Dashboard Endpoints and UI Mapping

This document defines the backend endpoints needed for the current dashboard UI and how each response field maps to the implemented cards and sections.

## Recommended Endpoints

1. `GET /dashboard/overview` (single source for hero + all dashboard cards)
2. `GET /dashboard/transactions?limit=10&cursor=...` (recent transactions table)

## Consolidation Goal

The frontend should not aggregate dashboard card values from multiple services.

Use `GET /dashboard/overview` as the direct source for:

1. Hero balances
2. All 6 stat cards

This removes cross-endpoint mapping for dashboard cards.

## 1) GET /dashboard/overview

Use this endpoint to return all hero metrics and stat card values in one response.

This endpoint is the single card payload the dashboard should bind to directly.

### Suggested response shape

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

## 2) GET /dashboard/transactions?limit=10&cursor=...

Use this endpoint for the Recent Transactions table rows.

### Suggested response shape

```json
{
  "items": [
    {
      "id": "tx_001",
      "date": "2026-04-19T11:45:00Z",
      "description": "Wallet Funding via Bank Transfer",
      "type": "Credit",
      "amount": 50000,
      "currency": "NGN",
      "status": "Completed",
      "category": "wallet",
      "source": "wallet_funding",
      "subType": "bank_transfer",
      "reference": "PAY_12345",
      "direction": "inflow",
      "metadata": {
        "channel": "bank_transfer"
      }
    }
  ],
  "nextCursor": "opaque_cursor_here"
}
```

### Suggested additive query params

The endpoint should accept these optional params without breaking existing clients:

1. `category` (`earnings` | `wallet` | `withdrawals` | `payments`) - enables tab-level filtering.
2. `from` (ISO datetime) - lower date bound.
3. `to` (ISO datetime) - upper date bound.
4. `status` (`Completed` | `Pending` | `Failed`) - status filter.
5. `type` (`Credit` | `Debit`) - direction filter.
6. `search` (string) - server-side search against description/reference.

If unsupported params are passed, backend may ignore them during rollout, but should preserve response shape.

### Category mapping for tabbed Transactions page

To support full visibility of earnings inflow sources (registration, product, voucher), backend should map ledger records consistently:

1. `earnings`
   - Registration commissions and bonuses
   - Product commissions/bonuses
   - Voucher/PV-related earnings credits
2. `wallet`
   - Wallet funding/top-up
   - Wallet transfers and wallet adjustments
3. `withdrawals`
   - Withdrawal request, approval, payout lifecycle entries
4. `payments`
   - Payment processor charges, reversals, and payment-linked records

`source` should carry finer-grained machine-friendly values (for example, `registration_bonus`, `product_commission`, `voucher_bonus`, `wallet_funding`, `withdrawal_payout`).

### Compatibility note

These fields are additive. Existing consumers that only use `id`, `date`, `description`, `type`, `amount`, `currency`, and `status` continue to work without change.

## UI Mapping (Already Implemented)

### Hero section

1. Total Wallet Balance -> `overview.hero.totalWalletBalance`
2. Vouchers -> `overview.hero.voucherBalance`
3. Autoship -> `overview.hero.autoshipBalance`

### Stat cards

1. Cashout Balance -> `overview.stats.cashoutBalance`
2. Total Earnings -> `overview.stats.totalEarnings`
3. Total Payout (Total Withdrawal) -> `overview.stats.totalPayout`
4. Product Voucher -> `overview.stats.productVoucher`
5. Total Downlines -> `overview.stats.totalDownlines`
6. Total CPVs -> `overview.stats.totalCpvs`

No frontend recomputation is required for these card values.

### Quick actions

Frontend-owned (no backend mapping required):

1. Create Successline -> `/network`
2. Fund Wallet -> `/wallet`
3. Withdraw Funds -> `/withdrawals`
4. View Commissions -> `/commissions`

### Recent Transactions table

1. Date -> `transactions.items[].date`
2. Description -> `transactions.items[].description`
3. Type -> `transactions.items[].type` (`Credit` | `Debit`)
4. Amount -> `transactions.items[].amount` + `transactions.items[].currency`
5. Status -> `transactions.items[].status` (`Completed` | `Pending` | `Failed`)

## Notes

- Keep `currency` at the top-level of overview so frontend can format money values consistently.
- Quick action labels/routes are handled fully by frontend and should not be returned by dashboard endpoints.
- `totalPayout` should represent cumulative successful withdrawals only.
- `totalDownlines` should include all downline members according to your business rule (direct only vs full tree) and remain consistent across dashboard and network pages.
- `totalCpvs` should be aggregate CPV visible to the user (define if personal only or personal + team).
- Suggested implementation rule: if backend cannot compute a metric yet, still return the field with `0` so response shape remains stable.
