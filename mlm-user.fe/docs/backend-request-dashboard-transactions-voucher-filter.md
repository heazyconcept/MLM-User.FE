# Backend Request — Dashboard Transactions: Product Voucher Filter

**Date:** 2026-07-09  
**From:** User FE (`mlm-user.fe`)  
**Related:** [dashboard-endpoints-mapping.md](./dashboard-endpoints-mapping.md), [PRODUCT_VOUCHER_FUNDING_GAP.md](./PRODUCT_VOUCHER_FUNDING_GAP.md), [earnings-activity-log.md](./earnings-activity-log.md)  
**Status:** Request for backend implementation

---

## 1. Problem

The Transactions page has a **Product Voucher** tab for ledger activity on the **VOUCHER** wallet (`walletType: VOUCHER`).

Calling:

```http
GET /dashboard/transactions?limit=10&category=voucher
```

returns **400 Bad Request**:

```json
{
  "statusCode": 400,
  "message": [
    "Unknown category filter \"voucher\". Use a group (wallet, earnings, autoship, withdrawals, transfers, product, system, other), payments (same as wallet), or a specific code (e.g. PDPA, REGISTRATION_PAYMENT)."
  ]
}
```

The **Wallet** tab works correctly with `category=wallet` and returns `categoryGroup: "WALLET"` rows (registration funding, cash funding, referral creation, etc.). That group must **not** be reused for product voucher history.

---

## 2. Wallet group (already working — reference)

### Request

```http
GET /dashboard/transactions?limit=10&category=wallet
```

### Example response items

| `category` | `categoryGroup` | Typical description |
|------------|-----------------|---------------------|
| `REGISTRATION_WALLET_FUNDING` | `WALLET` | Registration wallet funding |
| `WALLET_FUNDING` | `WALLET` | Cash wallet funding |
| `REFERRAL_CREATION` | `WALLET` | Referral creation of username … |

### Frontend usage

The **Wallet** tab calls `category=wallet` and displays all returned rows. Category codes are mapped to user-friendly labels (e.g. `REGISTRATION_WALLET_FUNDING` → “Registration wallet funding”).

---

## 3. Requested: Product Voucher filter

### Option A (preferred): New category group

Add **`voucher`** as an accepted value for the `category` query param on `GET /dashboard/transactions`.

```http
GET /dashboard/transactions?limit=10&category=voucher
```

**Include ledger rows** where the affected wallet is **VOUCHER**, for example:

| Ledger source / category | Description |
|--------------------------|-------------|
| `ACTIVATION_IPV` | IPV credit to product voucher on activation |
| `PRODUCT_PURCHASE` | Product order debited from voucher wallet |
| `TRANSFER` | Transfer to or from VOUCHER wallet |
| Voucher wallet funding (if supported) | Gateway or admin credit to VOUCHER |

**Exclude** from this filter:

- `REGISTRATION_WALLET_FUNDING`
- `WALLET_FUNDING` (cash)
- `REFERRAL_CREATION` (registration wallet debits)
- Earnings credits (PDPA, CDPA, etc.)

### Option B: `walletType` query param

Alternatively (or in addition), support:

```http
GET /dashboard/transactions?walletType=VOUCHER
```

Allowed values: `REGISTRATION`, `CASH`, `VOUCHER`, `AUTOSHIP`.

---

## 4. Response shape enhancement

Add **`walletType`** on each transaction item when known:

```json
{
  "id": "ledger-uuid",
  "date": "2026-07-07T11:04:22.160Z",
  "description": "Product voucher credit on activation",
  "type": "Credit",
  "amount": 240000,
  "currency": "NGN",
  "status": "Completed",
  "categoryGroup": "WALLET",
  "category": "ACTIVATION_IPV",
  "walletType": "VOUCHER",
  "paymentId": null
}
```

Frontend type (already prepared):

```typescript
walletType?: 'REGISTRATION' | 'CASH' | 'VOUCHER' | 'AUTOSHIP';
```

This allows reliable client filtering even before a dedicated `category=voucher` group ships.

---

## 5. Valid category filters (current backend)

Per error message, accepted values today:

**Groups:** `wallet`, `earnings`, `autoship`, `withdrawals`, `transfers`, `product`, `system`, `other`  
**Alias:** `payments` (same as `wallet`)  
**Specific codes:** e.g. `PDPA`, `REGISTRATION_PAYMENT`

**Requested addition:** `voucher`

---

## 6. Frontend behavior

### Wallet tab (implemented)

- API: `GET /dashboard/transactions?category=wallet`
- Shows all `categoryGroup: WALLET` rows
- Category column uses readable labels from `category` code

### Product Voucher tab (interim)

Until backend ships `category=voucher`:

- API: `GET /dashboard/transactions` (no category filter)
- Client-side filter for voucher rows (`walletType === VOUCHER`, `ACTIVATION_IPV`, voucher keywords)
- Empty state notes that history may be limited until backend filter exists

### After backend ships

- Product Voucher tab: `GET /dashboard/transactions?category=voucher`
- Prefer `walletType` from API over keyword heuristics

---

## 7. Acceptance criteria

- [ ] `GET /dashboard/transactions?category=voucher` returns **200** (not 400).
- [ ] Voucher filter returns only VOUCHER-wallet movements (credits, debits, transfers).
- [ ] Voucher filter does **not** return registration wallet funding, cash wallet funding, or referral creation debits.
- [ ] `ACTIVATION_IPV` and voucher-funded `PRODUCT_PURCHASE` rows appear in voucher filter.
- [ ] Optional: `walletType` field on all transaction items.
- [ ] OpenAPI / Swagger updated.

---

## 8. Priority

**Medium** — Wallet tab is unblocked. Product Voucher tab is limited until this filter exists; users can still see voucher balance on dashboard/wallet pages.
