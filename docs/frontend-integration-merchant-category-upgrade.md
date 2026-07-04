# Frontend Integration — Merchant Category Upgrade

**Date:** 2026-07-04  
**Feature:** Active merchants can upgrade their category tier (Regional → National → Global). Upgrades charge the **full target tier registration fee**, not the difference between tiers.

---

## Summary

| Rule | Detail |
|------|--------|
| Who can upgrade | Merchants with `status: ACTIVE` only |
| Upgrade path | `REGIONAL` → `NATIONAL` → `GLOBAL` (one step at a time or show all higher tiers) |
| Price | **Full target tier fee** — e.g. Regional → National pays **₦3,000,000** / **$3,000**, not ₦2,400,000 difference |
| Admin approval | **Not required** — tier updates immediately after successful payment |
| Tier change via profile | **Blocked** after initial fee paid — use upgrade flow instead (`PATCH /merchants/me` returns `403` for `type`) |

**Default fees (when admin config is null):**

| Tier | USD | NGN (1 USD = ₦1,000) |
|------|-----|----------------------|
| REGIONAL | $600 | ₦600,000 |
| NATIONAL | $3,000 | ₦3,000,000 |
| GLOBAL | $10,000 | ₦10,000,000 |

Amounts use the user's **registration currency** (`NGN` or `USD`). Admin overrides via `GET /merchants/category-config` apply to both application and upgrade.

---

## Endpoints

All require `Authorization: Bearer <token>` and **MerchantGuard** (user must be an active merchant).

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/merchants/me/upgrade-options` | Current tier + eligible higher tiers with full upgrade amounts |
| `POST` | `/merchants/merchant-upgrade/initiate` | Pay upgrade (wallet or Paystack) |
| `POST` | `/merchants/merchant-upgrade/verify` | Verify Paystack payment after redirect |

**Supporting endpoints:**

| Method | Path | Use |
|--------|------|-----|
| `GET` | `/merchants/me` | Confirm `type` after upgrade; check `status === ACTIVE` before showing upgrade UI |
| `GET` | `/merchants/category-config` | Tier comparison (fees, PV, commissions, onboarding items) |
| `GET` | `/merchants/me/allocations` | New onboarding stock after upgrade |
| `GET` | `/earnings/cpv` | Refresh PV after upgrade (incremental PV credited) |

---

## 1. `GET /merchants/me/upgrade-options`

Returns upgrade options for the authenticated merchant.

### Response

```json
{
  "currentType": "REGIONAL",
  "eligibleUpgrades": [
    {
      "merchantType": "NATIONAL",
      "upgradeAmount": 3000000,
      "registrationPV": 320,
      "deliveryCommissionPct": 6,
      "productCommissionPct": 4.5
    },
    {
      "merchantType": "GLOBAL",
      "upgradeAmount": 10000000,
      "registrationPV": 1200,
      "deliveryCommissionPct": 10,
      "productCommissionPct": 7.5
    }
  ]
}
```

| Field | Description |
|-------|-------------|
| `currentType` | Merchant's current category |
| `eligibleUpgrades[].merchantType` | Target tier (must be higher than current) |
| `eligibleUpgrades[].upgradeAmount` | **Full** target tier registration fee in user's currency |
| `eligibleUpgrades[].registrationPV` | Total instant registration PV for that tier (informational; upgrade credits **delta** only) |
| `eligibleUpgrades[].deliveryCommissionPct` | Delivery commission % at target tier |
| `eligibleUpgrades[].productCommissionPct` | Product commission % at target tier |

### Errors

| Status | When |
|--------|------|
| `404` | No merchant profile |
| `400` | Merchant not `ACTIVE` (e.g. still `PENDING`, `DRAFT`, `SUSPENDED`) |

### UI copy

Show **full target price**, not a difference:

- ✅ "Upgrade to National Merchant — ₦3,000,000"
- ❌ "Pay ₦2,400,000 to upgrade" (difference from Regional)

Compare with member package upgrades: same rule as `GET /users/me/upgrade-options` → `upgradeAmount`.

---

## 2. `POST /merchants/merchant-upgrade/initiate`

### Request body

```json
{
  "source": "REGISTRATION_WALLET",
  "targetType": "NATIONAL",
  "callbackUrl": "https://your-app.com/merchant/upgrade/callback"
}
```

| Field | Required | Values |
|-------|----------|--------|
| `source` | Yes | `REGISTRATION_WALLET` \| `CASH_WALLET` \| `PAYSTACK` |
| `targetType` | Yes | `NATIONAL` or `GLOBAL` (must be higher than current tier) |
| `callbackUrl` | No | Redirect URL after Paystack payment (recommended for gateway flow) |

### Response (wallet payment — immediate)

```json
{
  "paymentId": "uuid",
  "reference": "pay-ref-...",
  "amount": 3000000,
  "currency": "NGN"
}
```

- Upgrade applies **immediately** (merchant `type` updated, compensation runs).
- No verify step needed.
- Refresh `GET /merchants/me` to show new `type`.

### Response (Paystack)

```json
{
  "paymentId": "uuid",
  "reference": "pay-ref-...",
  "amount": 3000000,
  "currency": "NGN",
  "gatewayUrl": "https://checkout.paystack.com/..."
}
```

1. Redirect user to `gatewayUrl`.
2. On return to `callbackUrl`, read `reference` from query string.
3. Call **`POST /merchants/merchant-upgrade/verify`** (see §3).

### Errors

| Status | When |
|--------|------|
| `400` | Not `ACTIVE`, invalid `targetType`, insufficient wallet balance, no merchant profile |
| `404` | User not found |

**Insufficient wallet example:**

```json
{
  "statusCode": 400,
  "message": "Insufficient balance in cash wallet. Required: ₦3,000,000.00",
  "currency": "NGN",
  "requiredAmount": 3000000,
  "currentBalance": 1500000
}
```

---

## 3. `POST /merchants/merchant-upgrade/verify`

**Paystack only.** Call when the user returns from the gateway.

### Request body

```json
{
  "reference": "payment-reference-from-gateway"
}
```

### Response (success)

```json
{
  "success": true,
  "payment": {
    "id": "uuid",
    "reference": "pay-ref-...",
    "amount": 3000000,
    "currency": "NGN",
    "type": "MERCHANT_UPGRADE",
    "status": "SUCCESS"
  },
  "message": "Merchant category upgraded successfully."
}
```

### Errors

| Status | When |
|--------|------|
| `403` | Reference is not this user's merchant upgrade payment |
| `400` | Gateway did not confirm payment (cancelled/failed) |

After success:

1. Refresh `GET /merchants/me` — `type` should reflect new tier.
2. Refresh `GET /merchants/me/allocations` — new tier onboarding stock may appear.
3. Refresh earnings/PV widgets.

---

## 4. What happens after upgrade (backend — for UI expectations)

No extra frontend calls required beyond refresh; useful for success messaging:

1. **`merchant.type`** updated to `targetType` immediately (no admin step).
2. **Incremental registration PV** credited (delta between tiers, e.g. Regional 100 → National 320 = **+220 PV**).
3. **Upline commissions** on the **full upgrade fee** (same types as merchant registration fee: direct sponsor 3%, team 0.16% per level 2–13).
4. **Onboarding allocations** created for the **new tier's** `onboardingItems` (same dispatch → confirm-receipt flow as initial approval).
5. Payment recorded as type **`MERCHANT_UPGRADE`** (receipts, transaction history).

**Not duplicated:** Full registration PV for the new tier is not credited again — only the **delta**.

---

## 5. Suggested frontend flow

### 5.1 Upgrade page (merchant settings)

```
┌─────────────────────────────────────────────────────────┐
│  Merchant category                                      │
│  Current: Regional Merchant                             │
├─────────────────────────────────────────────────────────┤
│  [ National Merchant ]                                  │
│  Registration fee: ₦3,000,000                           │
│  Instant PV (tier total): 320                           │
│  Delivery commission: 6%                                │
│  [ Upgrade to National ]                                │
├─────────────────────────────────────────────────────────┤
│  [ Global Merchant ]                                    │
│  Registration fee: ₦10,000,000                          │
│  ...                                                    │
│  [ Upgrade to Global ]                                  │
└─────────────────────────────────────────────────────────┘
```

1. **Gate:** `GET /merchants/me` → only show upgrade section if `status === 'ACTIVE'`.
2. **Load options:** `GET /merchants/me/upgrade-options`.
3. **Optional comparison:** merge with `GET /merchants/category-config` for onboarding product list per tier.
4. **Confirm modal:** show `upgradeAmount`, target tier name, payment source.
5. **Pay:** `POST /merchants/merchant-upgrade/initiate`.
   - Wallet: show success → redirect to merchant dashboard.
   - Paystack: redirect → callback page → verify → success.
6. **Post-success:** toast + refresh profile, allocations, PV/earnings.

### 5.2 Paystack callback page

Reuse the same pattern as merchant registration fee verify:

```ts
// On mount: read ?reference= from URL
const reference = searchParams.get('reference');
if (reference) {
  await api.post('/merchants/merchant-upgrade/verify', { reference });
}
```

Distinguish callback routes if one page handles multiple payment types (registration fee vs upgrade) — check payment type from verify response or use separate callback URLs.

### 5.3 When to hide upgrade UI

| Condition | Action |
|-----------|--------|
| No merchant profile | Hide |
| `status !== ACTIVE` | Hide or show "Complete onboarding first" |
| `currentType === GLOBAL` | Hide (no higher tier; `eligibleUpgrades` is empty) |
| `eligibleUpgrades.length === 0` | Hide upgrade CTAs |

---

## 6. TypeScript types

```ts
type MerchantType = 'REGIONAL' | 'NATIONAL' | 'GLOBAL';
type MerchantFeePaymentSource = 'REGISTRATION_WALLET' | 'CASH_WALLET' | 'PAYSTACK';

interface MerchantUpgradeOption {
  merchantType: MerchantType;
  /** Full target tier registration fee in user's currency */
  upgradeAmount: number;
  registrationPV: number;
  deliveryCommissionPct: number;
  productCommissionPct: number;
}

interface MerchantUpgradeOptionsResponse {
  currentType: MerchantType;
  eligibleUpgrades: MerchantUpgradeOption[];
}

interface InitiateMerchantUpgradeBody {
  source: MerchantFeePaymentSource;
  targetType: MerchantType;
  callbackUrl?: string;
}

interface PaymentInitiationResponse {
  paymentId: string;
  reference: string;
  amount: number;
  currency: 'NGN' | 'USD';
  gatewayUrl?: string;
}

interface VerifyMerchantUpgradeBody {
  reference: string;
}

interface VerifyMerchantUpgradeResponse {
  success: true;
  payment: {
    id: string;
    reference: string;
    amount: number;
    currency: string;
    type: 'MERCHANT_UPGRADE';
    status: 'SUCCESS';
  };
  message: string;
}
```

---

## 7. Comparison with initial merchant application

| | Initial application | Category upgrade |
|--|---------------------|------------------|
| Status required | `DRAFT` / unpaid `PENDING` | `ACTIVE` |
| Change tier before pay | `PATCH /merchants/me` | N/A — use upgrade endpoints |
| Pay endpoint | `POST /merchants/merchant-fee/initiate` | `POST /merchants/merchant-upgrade/initiate` |
| Verify endpoint | `POST /merchants/merchant-fee/verify` | `POST /merchants/merchant-upgrade/verify` |
| Admin approval | Required after fee | **Not required** |
| Price basis | Full tier fee | Full **target** tier fee |
| PV credit timing | On admin approve | Immediately on payment (delta) |
| Stock | On admin approve | New tier allocations on payment |

---

## 8. Migration checklist

- [ ] Add merchant upgrade page/section (settings or merchant dashboard)
- [ ] Call `GET /merchants/me/upgrade-options` for pricing (do not compute fee difference client-side)
- [ ] Show full target tier price in confirmation modal
- [ ] Wire wallet + Paystack flows; verify only for Paystack
- [ ] Separate or route Paystack callbacks for `merchant-fee` vs `merchant-upgrade`
- [ ] Remove any UI that lets users change `type` via `PATCH /merchants/me` after payment
- [ ] After success, refresh `GET /merchants/me`, allocations, and earnings/PV
- [ ] Handle `403` on profile tier change with link to upgrade page

---

## Related

- [Merchant flow (frontend)](./merchant-flow-frontend.md) — application, fee payment, onboarding stock
- [Frontend integration — package upgrade](./frontend-integration-package-upgrade.md) — same "pay full target amount" rule for members
- [Merchant category config](./merchant-category-config.md) — admin tier configuration
