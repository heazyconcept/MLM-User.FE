# Frontend Integration — Legacy Club Phase 1

**Date:** 2026-09-18  
**Updated:** 2026-09-18 — Instant in Legacy account; no cashout lock; auto-sponsor; `LEGACY_VOUCHER`  
**Status:** **Not shipped** — contract for `mlm-user.fe` and admin  
**Audience:** Member app + admin app

Related:

- [Context](./phase-1-context.md)
- [UI/UX](./phase-1-ui-ux.md)
- [Backend](./phase-1-backend.md)
- Network cart: [frontend-integration-server-side-cart.md](../../../api/frontend-integration-server-side-cart.md)
- Checkout: [frontend-integration-customer-checkout-pickup.md](../../../api/frontend-integration-customer-checkout-pickup.md)
- Withdrawals: [Feature 07](../../../features/07-withdrawals.md)

---

## 1. Summary

Phase 1 adds a **Legacy Club** area. The member:

1. Picks VIP / Executive / Supreme.
2. Joins **automatically** under their Segulah sponsor if that person is already in Legacy Club; otherwise types a username.
3. Shops in a **separate** marketplace (`channel=LEGACY`).
4. Pays with **Legacy product voucher** (`LEGACY_VOUCHER`), not the network voucher.
5. Receives Instant (and the sponsor receives Successline Instant bonus) on the **Legacy account**.
6. Can **cash out with zero Successlines**.

Do not call network `/cart` or `/orders/checkout` without `channel` from Legacy screens. Do not send `walletType: VOUCHER` on a Legacy pay.

---

## 2. Feature detection

`GET /legacy/me` (paid member):

| HTTP | Meaning |
|---|---|
| `200` | Backend shipped. Render Legacy menu. |
| `404` / `501` | Hide Legacy menu. |
| `403` registration unpaid | Hide menu. |

---

## 3. Auth

- Bearer + registration paid
- Block pay / withdraw / transfer during impersonation (`403`)
- Admin: JWT + `legacy.*` permissions

---

## 4. Member endpoints

### 4.1 `GET /legacy/packages`

Amounts in the caller’s registration currency.

```http
GET /legacy/packages
```

```json
{
  "status": "success",
  "data": {
    "currency": "NGN",
    "fxRateNgnPerUsd": 1000,
    "packages": [
      {
        "code": "VIP",
        "name": "VIP Member",
        "isActive": true,
        "purchaseAmount": 60000,
        "instantCommission": 20000,
        "monthlyCommission": 30000,
        "sixMonthTotal": 200000,
        "successlineBonusPercent": 10,
        "autoshipAmount": 10000,
        "cycleMonths": 6,
        "minDirectsToIncreaseMonthly": 3
      }
    ]
  }
}
```

(`EXECUTIVE` / `SUPREME` same shape.) Do not bind `minDirectsToIncreaseMonthly` as a cashout lock. Show monthly / Autoship as cycle info only.

---

### 4.2 `GET /legacy/me`

```json
{
  "status": "success",
  "data": {
    "status": "NONE",
    "currency": "NGN",
    "sponsorResolution": "AUTO",
    "defaultSponsor": {
      "username": "ada",
      "legacyPackage": "SUPREME"
    },
    "membership": null,
    "legacyCashout": null,
    "legacyVoucher": { "balance": 0, "status": "ACTIVE" },
    "instantReceived": 0,
    "directSuccesslineCount": 0,
    "minDirectsToIncreaseMonthly": 3,
    "canCashoutLegacy": false,
    "pendingJoin": null
  }
}
```

`status`: `NONE` | `PENDING_JOIN` | `ACTIVE`  
`sponsorResolution`: `AUTO` | `MANUAL`  
`defaultSponsor`: null when `MANUAL`.

When `PENDING_JOIN`:

```json
"pendingJoin": {
  "package": "VIP",
  "sponsorUsername": "ada",
  "sponsorSource": "AUTO",
  "purchaseRequired": 60000,
  "legacyCartSubtotal": 12000,
  "remainingToJoin": 48000
}
```

When `ACTIVE`:

```json
{
  "status": "ACTIVE",
  "currency": "NGN",
  "sponsorResolution": "AUTO",
  "defaultSponsor": null,
  "membership": {
    "package": "EXECUTIVE",
    "sponsorUsername": "ada",
    "sponsorSource": "AUTO",
    "joinedAt": "2026-09-18T10:00:00.000Z",
    "cycleStartedAt": "2026-09-18T10:00:00.000Z",
    "joinOrderId": "uuid"
  },
  "legacyCashout": { "balance": 80000, "status": "ACTIVE" },
  "legacyVoucher": { "balance": 5000, "status": "ACTIVE" },
  "instantReceived": 80000,
  "directSuccesslineCount": 2,
  "minDirectsToIncreaseMonthly": 3,
  "canCashoutLegacy": true,
  "pendingJoin": null
}
```

`canCashoutLegacy` is **true** whenever `legacyCashout` exists. Do not disable cashout when `directSuccesslineCount < 3`.

| Field | UI |
|---|---|
| `status` | Marketing / resume / member home |
| `sponsorResolution` + `defaultSponsor` | Auto vs username on join |
| `legacyCashout.balance` | Legacy account (includes Instant) |
| `legacyVoucher.balance` | Legacy voucher card |
| `instantReceived` | Optional breakdown, **not** a CASH link |
| `directSuccesslineCount` | Count only |
| `canCashoutLegacy` | Enable cash out / move when true |

---

### 4.3 `POST /legacy/sponsors/validate`

Only when `sponsorResolution === MANUAL`.

```json
{ "username": "ada" }
```

**200:** `{ "valid": true, "username": "ada", "legacyPackage": "SUPREME" }`

| Code | Message |
|---|---|
| `SPONSOR_NOT_FOUND` | We could not find that username. |
| `SPONSOR_NOT_LEGACY` | That member has not joined Legacy Club yet. |
| `SPONSOR_SELF` | You cannot register yourself. |

---

### 4.4 `POST /legacy/join/start`

```json
{ "package": "VIP", "sponsorUsername": "ada" }
```

`sponsorUsername`:

- **AUTO:** omit, or send the auto sponsor’s username only
- **MANUAL:** required

**400:** `PACKAGE_INACTIVE`, `ALREADY_ACTIVE`, `SPONSOR_*`, `SPONSOR_USERNAME_REQUIRED`, `SPONSOR_MUST_BE_AUTO`, `REGISTRATION_UNPAID`

**200** → `/legacy/shop`. Replacing package/sponsor while `PENDING_JOIN` is allowed.

---

### 4.5 Lookup

```http
GET /legacy/members/lookup?username=bode
```

```json
{
  "username": "bode",
  "exists": true,
  "isRegistrationPaid": true,
  "legacyStatus": "NONE"
}
```

---

### 4.6 Successlines

```http
GET /legacy/successlines?page=1&limit=20&search=
```

```json
{
  "summary": {
    "directSuccesslineCount": 2,
    "minDirectsToIncreaseMonthly": 3
  },
  "pagination": { "totalRecords": 2, "currentPage": 1, "totalPages": 1, "hasNextPage": false, "hasPreviousPage": false },
  "successlines": [
    {
      "username": "bode",
      "package": "VIP",
      "joinedAt": "2026-09-18T12:00:00.000Z",
      "sponsorSource": "AUTO"
    }
  ]
}
```

No `canCashoutLegacy` in this summary. Render username, package, date (optional How).

---

### 4.7 Legacy account

```http
GET /legacy/cashout
```

```json
{
  "currency": "NGN",
  "balance": 80000,
  "walletStatus": "ACTIVE",
  "canCashoutLegacy": true,
  "directSuccesslineCount": 2,
  "items": [
    {
      "id": "ledger-uuid",
      "date": "2026-09-18T12:05:00.000Z",
      "description": "Legacy Club Instant Membership Commission (VIP)",
      "type": "Credit",
      "amount": 20000,
      "currency": "NGN"
    }
  ],
  "nextCursor": null
}
```

Always enable **Cash out** and **Move** when the wallet exists.

---

### 4.8 Withdraw

```http
POST /legacy/cashout/withdraw
```

Same body as CASH withdrawal (amount, currency, pin, payout). No `walletType`.

**Do not** expect `LEGACY_CASHOUT_LOCKED`. If an old backend still returns it, show the message but Phase 1 contract is: **no lock**.

Insufficient / PIN / currency: same as CASH.

---

### 4.9 Transfer from Legacy account

```http
POST /legacy/cashout/transfer
```

```json
{
  "toWalletType": "LEGACY_VOUCHER",
  "amount": 5000,
  "currency": "NGN",
  "pin": "1234"
}
```

`toWalletType`: `CASH` | `VOUCHER` | `AUTOSHIP` | `LEGACY_VOUCHER`

**200:** `{ "transferId": "uuid" }`

---

### 4.10 Legacy voucher

```http
GET /legacy/voucher
```

```json
{ "currency": "NGN", "balance": 12000, "status": "ACTIVE" }
```

Fund: `POST /wallets/transfer` `{ "fromWalletType": "CASH", "toWalletType": "LEGACY_VOUCHER", "amount", "currency" }` (if that route is extended as in the backend doc) or the funding flow the backend ships. Never fund Legacy shop from network `VOUCHER`.

---

## 5. Legacy cart and checkout

Always `channel=LEGACY`.

| Method | Path |
|---|---|
| GET | `/cart?channel=LEGACY` |
| PUT | `/cart/items/:productId?channel=LEGACY` `{ "quantity": n }` |
| DELETE | `/cart?channel=LEGACY` after pay |
| POST `/cart/merge` | **Do not call** for Legacy |

```
remaining = max(0, pendingJoin.purchaseRequired - cart.subtotal)
canCheckout = cart.subtotal >= pendingJoin.purchaseRequired
```

```http
POST /orders/checkout
```

```json
{
  "channel": "LEGACY",
  "countryCode": "NG",
  "subdivisionCode": "LA",
  "state": "Lagos",
  "paymentMethod": "WALLET",
  "groups": [
    {
      "fulfilmentMode": "PICKUP",
      "selectedMerchantId": "merchant-uuid",
      "items": [{ "productId": "uuid", "quantity": 2 }]
    }
  ]
}
```

Fulfilment: same as [customer checkout](../../../api/frontend-integration-customer-checkout-pickup.md).

| Code | UI |
|---|---|
| `LEGACY_CART_BELOW_PACKAGE` | Remaining to package |
| `LEGACY_JOIN_REQUIRED` | Redirect join |
| `LEGACY_SHOP_JOIN_ONLY` | Already ACTIVE — Phase 1 shop closed |

```http
POST /orders/checkout/:checkoutId/pay-wallet
{ "walletType": "LEGACY_VOUCHER" }
```

**Not** `VOUCHER`. Short balance → `/legacy/voucher`.

On 200: `DELETE /cart?channel=LEGACY` → `/legacy/success` → `GET /legacy/me` (`ACTIVE`, Instant inside `legacyCashout`).

---

## 6. Screen → API map

| Screen | Load | Mutations |
|---|---|---|
| Menu | `/users/me` paid + `/legacy/me` | — |
| Packages | `/legacy/packages` + `/legacy/me` (sponsor hint) | — |
| Join | `/legacy/me` | validate (MANUAL) + `join/start` |
| Voucher | `/legacy/voucher` | CASH → LEGACY_VOUCHER |
| Shop / cart | cart `LEGACY` + `/legacy/me` | PUT items |
| Checkout | merchants + checkout | checkout + pay `LEGACY_VOUCHER` |
| Member home | `/legacy/me` | — |
| Successlines | `/legacy/successlines` | — |
| Legacy account | `/legacy/cashout` | withdraw / transfer |

Do not put Legacy cashout or Legacy voucher into the main dashboard hero in Phase 1.

---

## 7. Error handling

| Code | Where | UI |
|---|---|---|
| `SPONSOR_NOT_FOUND` / `NOT_LEGACY` / `SELF` | Join MANUAL | Inline |
| `SPONSOR_USERNAME_REQUIRED` | Join start | Show username field |
| `SPONSOR_MUST_BE_AUTO` | Join start | Hide field; use auto copy |
| `ALREADY_ACTIVE` | Join | `/legacy` |
| `LEGACY_CART_BELOW_PACKAGE` | Checkout | Remaining |
| `LEGACY_VOUCHER_REQUIRED` | Pay | Wrong wallet — send `LEGACY_VOUCHER` |
| `WALLET_LOCKED` | Withdraw | Existing copy |
| Impersonation `403` | Pay/withdraw/transfer | Disable |

Retired: `LEGACY_CASHOUT_LOCKED` — do not build a locked UI.

---

## 8. Types

```ts
type LegacyPackageCode = 'VIP' | 'EXECUTIVE' | 'SUPREME';
type LegacyMemberStatus = 'NONE' | 'PENDING_JOIN' | 'ACTIVE';
type LegacySponsorResolution = 'AUTO' | 'MANUAL';
type LegacySponsorSource = 'AUTO' | 'CHOSEN' | 'SEED';
type ShopChannel = 'NETWORK' | 'LEGACY';
```

Separate `legacyCart.service.ts`. Separate voucher widgets.

---

## 9. Admin

`GET/PUT /admin/legacy/packages` — field `minDirectsToIncreaseMonthly` (not `minDirectsToCashout`). Label: *Raises monthly in Phase 2. Does not lock cashout.*

`GET /admin/legacy/members?page&limit&search=&package=&sponsorSource=`  
No `canCashout` filter.

Seed: `POST /admin/legacy/enroll` — Instant lands on Legacy account.

---

## 10. Notifications (optional)

| Type | Body |
|---|---|
| `LEGACY_INSTANT_COMMISSION` | ₦{amount} is in your Legacy account. You can cash out now. |
| `LEGACY_SUCCESSLINE_INSTANT_BONUS` | ₦{amount} from @{username} is in your Legacy account. |

---

## 11. QA checklist

- Unpaid: no menu.
- AUTO sponsor: no username field; cannot pick someone else (`SPONSOR_MUST_BE_AUTO`).
- MANUAL: username required; copy about asking the Segulah sponsor to join.
- Network cart ≠ Legacy cart; network voucher ≠ Legacy voucher.
- Pay with `VOUCHER` on Legacy checkout fails; `LEGACY_VOUCHER` succeeds.
- After pay: Instant in `legacyCashout`, not CASH; network CASH unchanged by Instant.
- Zero Successlines: cash out and transfer succeed.
- Successline list is usernames only; no lock copy.
- Impersonation cannot pay or cash out.
- Seed enroll: first member, Instant on Legacy account.
- Admin Instant change does not rewrite paid Instant.
- Network `/shop` still pays PPPC.
