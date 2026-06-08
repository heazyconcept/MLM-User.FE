# Frontend Integration — Product Volume Distribution

**Date:** 2026-05-26  
**Backend change:** Per-product volume fields and correct distribution on `order.paid` (Direct Referral Product PV + Community Product CPV).

Use this guide for **admin product forms**, **catalog/order UI**, and **earnings/CPV displays**.

---

## 1. Summary (what changed)

Each product price now has **three** configurable volume values:

| Field | Label (suggested UI) | Credited to | When |
|--------|----------------------|-------------|------|
| `pv` | Personal product PV (PPPPV) | **Buyer** | Order paid (member) |
| `directReferralPv` | Direct referral product PV | **Direct sponsor** (`referredById`) | Order paid |
| `cpv` | Community product CPV (CPPPV) | **Matrix uplines** (split) | Order paid (if depth gate passes) |

**Breaking behavior change**

- Product `cpv` is **no longer** added to the **buyer’s** milestone `totalCpv` (`PRODUCT_PURCHASE` source removed for buyers).
- Buyers still receive **`pv`** as a ledger row (`PRODUCT_PURCHASE_PV`) for history; it does **not** increase milestone total.
- Sponsors receive **`directReferralPv`** × quantity (sum per order).
- Uplines receive an **equal split** of order `cpv` × quantity when the same gate as **community registration CPV** applies (buyer’s sponsor paid + sponsor has a paid sponsor; **direct sponsor excluded** from the split).

**Unchanged**

- Cash commissions on product purchase (PPPC, DRPPC, CPPC) — same earning types and cards.
- Guest checkout — no `order.paid` volume/earnings (no `userId`).

**Merchant-specific additions (2026-05-27)**

Merchants earn **twice** on product purchases (member stream + merchant stream). Full frontend guide:

**[frontend-integration-merchant-product-earnings.md](./frontend-integration-merchant-product-earnings.md)**

Summary: second-stream `MERCHANT_*` cash on `order.paid` (rates from `productCommissionPct`); `MERCHANT_DELIVERY_BONUS` on delivery confirmation (`deliveryCommissionPct`). Member PV/CPV from this doc still apply to merchant buyers.

---

## 2. Admin — set / create product price

### `POST /admin/products/:id/price`

**Body (required volume fields):**

```json
{
  "basePrice": 5000,
  "nonMemberBasePrice": 6000,
  "priceCurrency": "NGN",
  "pv": 3,
  "directReferralPv": 1,
  "cpv": 0.4
}
```

| Field | Type | Rules |
|--------|------|--------|
| `basePrice` | number | > 0 |
| `pv` | number | ≥ 0 — buyer personal PV |
| `directReferralPv` | number | ≥ 0 — sponsor when referral buys |
| `cpv` | number | ≥ 0 — community CPV pool for uplines |
| `nonMemberBasePrice` | number? | optional |
| `priceCurrency` | `"NGN"` \| `"USD"`? | default `NGN` for admin input |

**Response** includes `pv`, `directReferralPv`, `cpv` (prices in NGN for display where documented).

### `POST /admin/products` (optional initial price)

You may send pricing on create so one request creates product + first price:

```json
{
  "categoryId": "uuid",
  "name": "Herbal Tea",
  "sku": "TEA-001",
  "basePrice": 5000,
  "pv": 3,
  "directReferralPv": 1,
  "cpv": 0.4
}
```

If `basePrice` is present, `pv`, `directReferralPv`, and `cpv` should be sent (validation applies). Without `basePrice`, create product only and call `POST .../price` later.

### `GET /admin/products/:id` — `currentPrice`

```json
{
  "currentPrice": {
    "basePrice": 5000,
    "nonMemberBasePrice": 6000,
    "pv": 3,
    "directReferralPv": 1,
    "cpv": 0.4,
    "effectiveFrom": "2026-05-26T00:00:00.000Z"
  }
}
```

### `GET /admin/products/:id/price-history`

Each history row includes `directReferralPv` alongside `pv` and `cpv`.

**Admin UI checklist**

- [ ] Product create/edit price form: three numeric fields (`pv`, `directReferralPv`, `cpv`) with short help text (buyer / sponsor / community).
- [ ] Price history table: column for `directReferralPv`.
- [ ] Do not show product `cpv` as “buyer CPV” on consumer-facing copy.

---

## 3. Member catalog — product list / detail

`GET` shop/catalog endpoints that expose `currentPrice` now include:

```json
{
  "currentPrice": {
    "basePrice": 12.5,
    "pv": 3,
    "directReferralPv": 1,
    "cpv": 0.4
  }
}
```

**Member-facing UI**

- Show **`pv`** to the buyer as “Personal PV” (or your product label).
- **`directReferralPv`** and **`cpv`** are usually **admin/sponsor education** only unless you explain the compensation plan; they are not credited to the buyer.

---

## 4. Orders — line items and totals

### `GET /orders`, `GET /orders/:id`

Each item:

```json
{
  "id": "uuid",
  "productId": "uuid",
  "productName": "Herbal Tea",
  "quantity": 2,
  "unitPrice": 12.5,
  "pv": 3,
  "directReferralPv": 1,
  "cpv": 0.4,
  "lineTotal": 25
}
```

Values are **snapshotted at order time** (immutable after create).

**Order confirmation copy (member)**

- “You will earn **{sum of pv × qty}** personal product PV” (not milestone CPV unless you add separate copy).
- Do **not** promise “**{cpv}** CPV to you” from the product row — that volume goes to the community upline pool.

---

## 5. CPV ledger sources (earnings history)

New `source` values on `CpvTransaction` / `GET /earnings/cpv` history:

| `source` | `pvType` | Meaning |
|----------|----------|---------|
| `PRODUCT_PURCHASE_PV` | `PERSONAL` | Buyer personal product PV (no milestone bump) |
| `DIRECT_REFERRAL_PRODUCT_PV` | `PERSONAL` | Sponsor earned from referral’s product purchase |
| `COMMUNITY_PRODUCT_MATRIX` | `TEAM` | Upline share of order community CPV |

**Removed for new orders:** buyer lines with `source: "PRODUCT_PURCHASE"` from product `cpv`.

### Suggested labels

| Source | Display label |
|--------|----------------|
| `PRODUCT_PURCHASE_PV` | Personal product PV |
| `DIRECT_REFERRAL_PRODUCT_PV` | Direct referral product PV |
| `COMMUNITY_PRODUCT_MATRIX` | Community product CPV |
| `DIRECT_REFERRAL_REGISTRATION` | Direct referral registration PV (unchanged) |
| `COMMUNITY_REGISTRATION_MATRIX` | Community registration CPV (unchanged) |

---

## 6. PV breakdown — `GET /earnings/cpv` (and profile widgets)

`pvBreakdown` / card buckets:

| Bucket | Includes (among others) |
|--------|-------------------------|
| `directReferralPv` | `DIRECT_REFERRAL_REGISTRATION` **and** `DIRECT_REFERRAL_PRODUCT_PV` |
| `communityPv` | `COMMUNITY_REGISTRATION_MATRIX` **and** `COMMUNITY_PRODUCT_MATRIX` |
| `instantPv` | Registration personal PV sources (unchanged) |

**Do not** treat `PRODUCT_PURCHASE` as personal allocation for new data.

**Sponsor dashboard**

- After a referral pays for a product, sponsor may see:
  - **Money:** DRPPC card (`DIRECT_REFERRAL_PRODUCT_PURCHASE`) — unchanged.
  - **PV:** increase in direct referral PV from `DIRECT_REFERRAL_PRODUCT_PV` (and in `totalCpv` / milestones if amounts count toward summary).

**Upline dashboard**

- Community product CPV appears under **team/community** PV (`pvType: "TEAM"`), not direct referral personal.

---

## 7. Earnings cards (unchanged keys)

`GET /earnings/cards/summary` — no new card keys. Product **cash** still uses:

| Key | Unit | Ledger type |
|-----|------|----------------|
| `PPPC` | MONEY | Personal product purchase |
| `DRPPC` | MONEY | Direct referral product purchase |
| `CPPC` | MONEY | Community product purchase |

Volume (PV/CPV) is separate from these cards; use CPV history / breakdown.

---

## 8. Eligibility (when community product CPV pays)

Community product CPV runs only if:

1. Buyer has a **paid** direct sponsor, and  
2. That sponsor has a **paid** sponsor (grand-sponsor chain), and  
3. Matrix uplines are **registration-paid**.

Direct sponsor **does not** receive a share of `cpv` (they can still get **DRPPC** cash and **directReferralPv**).

Frontend should **not** show guaranteed community CPV to every upline on every purchase; optional copy: “Subject to matrix eligibility rules.”

---

## 9. Migration notes for existing UIs

| Old assumption | New behavior |
|----------------|--------------|
| Product `cpv` on price = buyer milestone CPV | Buyer gets `pv` only for personal product PV row; `cpv` → uplines |
| Only `pv` and `cpv` on admin price form | Add **`directReferralPv`** (required on set price) |
| `cpv.personal` includes `PRODUCT_PURCHASE` | New orders: no buyer `PRODUCT_PURCHASE`; use `PRODUCT_PURCHASE_PV` in history only |
| Historical orders | Old snapshots may lack `directReferralPv` (defaults to 0); old buyers may have legacy `PRODUCT_PURCHASE` CPV |

---

## 10. Related docs

- [features/12-product-catalog.md](../features/12-product-catalog.md) — catalog ownership  
- [features/13-orders-purchases.md](../features/13-orders-purchases.md) — order lifecycle  
- [frontend-integration-backend-fixes.md](../Febugs/frontend-integration-backend-fixes.md) — registration PV / CPV (section 1 partially superseded by this doc for **products**)  
- [frontend-integration-matrix-cpv-notifications.md](./frontend-integration-matrix-cpv-notifications.md) — matrix tree & CPV summary fields  
- [frontend-integration-merchant-product-earnings.md](./frontend-integration-merchant-product-earnings.md) — dual member + merchant cash streams, delivery bonus, `GET /merchants/earnings/summary`  

---

## 11. Quick QA scenarios

1. **Admin** sets price with `pv: 3`, `directReferralPv: 1`, `cpv: 0.4` → detail and history show all three.  
2. **Member** buys qty 2 → order items snapshot `pv: 3`, `directReferralPv: 1`, `cpv: 0.4` per unit.  
3. **Buyer** CPV history: `PRODUCT_PURCHASE_PV` amount `6`; no new `PRODUCT_PURCHASE` from `cpv`.  
4. **Sponsor** CPV history: `DIRECT_REFERRAL_PRODUCT_PV` amount `2` for that order.  
5. **Qualified upline** CPV history: `COMMUNITY_PRODUCT_MATRIX` shares summing to `0.8` (0.4 × 2 qty).  
6. **Guest** order paid → no volume events (no member `userId`).
