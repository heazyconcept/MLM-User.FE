# Earnings Activity Log API (Frontend)

This document describes the **unified activity log** endpoints that return all wallet ledger entries (money in/out) and PV/CPV transactions in one chronological list. Use these for "Transaction history", "Earning logs", or "Activity feed" screens.

---

## Overview

- **Customer:** `GET /earnings/activity` — returns the **current user's** combined ledger + PV activity.
- **Admin:** `GET /admin/earnings/activity?userId=...` — returns the same shape for a **specific user** (admin only).

Items are sorted by **`createdAt` descending** (newest first). Each item is either a **ledger** entry (wallet credit/debit) or a **PV** entry (CPV point movement). Use the `type` field to discriminate.

---

## 1. Customer: GET /earnings/activity

**Auth:** Bearer JWT. User must be **registered (activation paid)** — the route is behind `RegistrationPaidGuard`.

### Request

| Method | Path                |
|--------|---------------------|
| GET    | `/earnings/activity` |

### Query parameters

| Parameter | Type   | Default | Description                                      |
|----------|--------|--------|--------------------------------------------------|
| `limit`  | number | 50     | Max items to return (e.g. 1–100).               |
| `offset` | number | 0      | Number of items to skip (for pagination).       |
| `from`   | string | —      | Optional. Start of date range (ISO 8601).       |
| `to`     | string | —      | Optional. End of date range (ISO 8601).         |

**Example**

```http
GET /earnings/activity?limit=20&offset=0
GET /earnings/activity?limit=50&from=2025-01-01&to=2025-01-31
```

### Response

```json
{
  "items": [
    {
      "type": "ledger",
      "id": "uuid",
      "createdAt": "2025-02-20T10:00:00.000Z",
      "walletType": "CASH",
      "direction": "CREDIT",
      "source": "EARNING",
      "earningType": "DIRECT_REFERRAL",
      "amount": 15.5,
      "displayAmount": 25000,
      "displayCurrency": "NGN",
      "reference": "REF-...",
      "metadata": {}
    },
    {
      "type": "pv",
      "id": "uuid",
      "createdAt": "2025-02-19T14:30:00.000Z",
      "amount": 40,
      "source": "REGISTRATION",
      "sourceId": null,
      "metadata": {}
    }
  ]
}
```

- **`items`** — Array of activity items (ledger or pv). Order: newest first.
- Pagination: use `limit` and `offset`; the API does not return a total count in this version (you can show "Load more" or page by `limit`).

---

## 2. Admin: GET /admin/earnings/activity

**Auth:** Bearer JWT + **Admin** role.

### Request

| Method | Path                          |
|--------|-------------------------------|
| GET    | `/admin/earnings/activity`    |

### Query parameters

| Parameter | Type   | Required | Description                                |
|----------|--------|----------|--------------------------------------------|
| `userId` | string | **Yes**  | User ID whose activity log is requested.   |
| `limit`  | number | No       | Default 50. Max items to return.           |
| `offset` | number | No       | Default 0. Skip for pagination.            |
| `from`   | string | No       | ISO date string (start of range).         |
| `to`     | string | No       | ISO date string (end of range).            |

**Example**

```http
GET /admin/earnings/activity?userId=usr_xxx&limit=50&offset=0
```

### Response

Same shape as customer: `{ "items": [ ... ] }` with ledger and pv items sorted by `createdAt` descending.

---

## 3. Item types

### 3.1 Ledger item (`type: "ledger"`)

Represents a **credit or debit** on one of the user's wallets (REGISTRATION, CASH, VOUCHER, AUTOSHIP).

| Field             | Type    | Description |
|-------------------|---------|-------------|
| `type`            | string  | Always `"ledger"`. |
| `id`              | string  | Ledger entry ID. |
| `createdAt`       | string  | ISO 8601 date. |
| `walletType`      | string  | `REGISTRATION` \| `CASH` \| `VOUCHER` \| `AUTOSHIP`. |
| `direction`       | string  | `CREDIT` (money in) \| `DEBIT` (money out). |
| `source`          | string  | See [Ledger sources](#ledger-sources). |
| `earningType`     | string? | Present when `source === "EARNING"`; see [Earning types](#earning-types). |
| `amount`          | number  | Amount in **base currency (USD)**. |
| `displayAmount`   | number? | Amount in user's display currency (e.g. NGN). |
| `displayCurrency`  | string? | e.g. `NGN`, `USD`. |
| `reference`       | string? | Idempotency/reference. |
| `metadata`        | object? | Extra payload. |

**Ledger sources**

- `DEPOSIT` — Wallet funding (e.g. Paystack).
- `EARNING` — Bonus/commission (check `earningType` for kind).
- `WITHDRAWAL` — Cash withdrawal.
- `TRANSFER` — Wallet-to-wallet.
- `REGISTRATION_ACTIVATION` — Spend from registration wallet to activate.
- `REFERRAL_CREATION` — Spend from registration wallet to add referral.
- `ACTIVATION_IPV` — IPV credit to voucher.
- `PRODUCT_PURCHASE` — Product order debit.
- `ADMIN` — Admin funding.
- `AUTOSHIP_TO_PV`, `AUTOSHIP_ADMIN_FEE` — Autoship flows.
- Others: `REVERSAL`, `SYSTEM`, `MERCHANT` as applicable.

**Earning types** (when `source === "EARNING"`)

Examples: `PDPA`, `CDPA`, `DIRECT_REFERRAL`, `COMMUNITY_REFERRAL`, `MATCHING_BONUS`, `RANKING_BONUS`, `CPV_CASH_BONUS`, `LEADERSHIP_BONUS`, `PERSONAL_PRODUCT_PURCHASE`, `DIRECT_REFERRAL_PRODUCT_PURCHASE`, `COMMUNITY_PRODUCT_PURCHASE`, etc.

---

### 3.2 PV item (`type: "pv"`)

Represents a **CPV (Cumulative Point Value)** movement — no wallet, just points.

| Field       | Type   | Description |
|------------|--------|-------------|
| `type`     | string | Always `"pv"`. |
| `id`       | string | CPV transaction ID. |
| `createdAt`| string | ISO 8601 date. |
| `amount`   | number | CPV points (e.g. 40, 100). |
| `source`   | string | e.g. `REGISTRATION`, `PRODUCT_PURCHASE`. |
| `sourceId` | string?| Related entity ID if any. |
| `metadata` | object?| Extra payload. |

---

## 4. Frontend usage

- **Discriminate by `type`:**  
  - `item.type === 'ledger'` → show wallet, direction, amount, source/earningType.  
  - `item.type === 'pv'` → show CPV amount and source.
- **Sorting:** API returns newest first; no need to sort again.
- **Pagination:** Use `limit` and `offset` (e.g. page size 20, next page `offset=20`).
- **Date filter:** Send `from` and `to` as ISO date strings when the user picks a date range.
- **Display:** Use `displayAmount` and `displayCurrency` when showing money to the user when present; otherwise use `amount` (USD). For PV items use `amount` as CPV points.

---

## 5. Summary

| Who     | Endpoint                       | Purpose                    |
|---------|--------------------------------|----------------------------|
| Customer| `GET /earnings/activity`       | My full activity (ledger + PV). |
| Admin   | `GET /admin/earnings/activity?userId=...` | Same for any user.   |

Response: `{ items: Array<LedgerItem | PvItem> }` with `type`, `createdAt`, and type-specific fields. Use `type` to render ledger vs PV rows correctly.
  