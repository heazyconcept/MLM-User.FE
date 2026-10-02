# Backend Request — Fund and Transfer into Legacy Voucher and Legacy Cashout

**Date:** 2026-10-01  
**From:** Member app (`mlm-user.fe`)  
**To:** HerbApi / payments + wallets + Legacy Club  
**Status:** Backend shipped. Member app sends `LEGACY_VOUCHER` and `LEGACY_CASHOUT` on fund and transfer.  
**Priority:** High  
**Area:** Inbound money into `LEGACY_VOUCHER` and `LEGACY_CASHOUT`

**Related member screens (will be updated after this ships):**

- Legacy product voucher: `/legacy/voucher`
- Legacy cashout: `/legacy/cashout`
- Fund wallet: `POST /payments/wallet-funding/initiate` (today `CASH` | `VOUCHER` only)
- Bank transfer deposit: `POST /payments/manual-deposit` (today `REGISTRATION` | `VOUCHER` only)
- Move between own wallets: `POST /wallets/transfer`

---

## 1. Product requirement

A Legacy member must be able to add money to **both** of these wallets, and for **each** wallet they must have **both** of these options:

| Option | Meaning |
|--------|---------|
| **Fund** | Pay in new money (card gateway, USDT, or bank-transfer evidence) and have that payment credit the chosen Legacy wallet. |
| **Transfer** | Move existing balance from one of their own network wallets into the chosen Legacy wallet. |

| Destination | Fund (new payment) | Transfer (own wallets) |
|-------------|--------------------|------------------------|
| **Legacy product voucher** (`LEGACY_VOUCHER`) | Required | Required |
| **Legacy cashout** (`LEGACY_CASHOUT`) | Required | Required |

These credits are the member’s own money. They are **not** commissions.

Member-facing names:

- `LEGACY_VOUCHER` → **Legacy product voucher** (Legacy marketplace only. Not the network Product Voucher.)
- `LEGACY_CASHOUT` → **Legacy cashout**

---

## 2. What works today

| Path | What it does | Gap |
|------|----------------|-----|
| `POST /payments/wallet-funding/initiate` | Credits **network** `CASH` or `VOUCHER` after verify | No `LEGACY_VOUCHER` or `LEGACY_CASHOUT` |
| `POST /payments/manual-deposit` | Admin approval credits **network** `REGISTRATION` or `VOUCHER` | Same gap |
| `POST /wallets/transfer` | Moves between the member’s own network wallets. Sources are `CASH` and `REGISTRATION` | `LEGACY_VOUCHER` is only partially used (Cash → Legacy voucher). `LEGACY_CASHOUT` is not a destination |
| `POST /legacy/cashout/transfer` | Moves **out of** Legacy cashout to `CASH`, `REGISTRATION`, `VOUCHER`, or `LEGACY_VOUCHER` | Outbound only. Do not change this endpoint’s direction |
| Weekly / instant commission | Credits Legacy cashout (and the voucher split of membership commission) | Earnings only. Members cannot top the wallets up themselves |

`GET /legacy/voucher` returns balance only (`currency`, `balance`, `status`). It has no ledger, so a member cannot see that a fund or transfer landed.

`GET /legacy/cashout` already returns `items[]`. New inbound credits must appear there.

---

## 3. Required changes

### 3.1 Fund — card / USDT gateway

Extend the existing initiate call. Do not add a second initiate route.

```http
POST /payments/wallet-funding/initiate
Content-Type: application/json
```

```json
{
  "amount": 25000,
  "provider": "PAYSTACK",
  "walletType": "LEGACY_VOUCHER",
  "callbackUrl": "https://app.example/payments/callback"
}
```

| Field | Type | Required | Rules |
|-------|------|----------|--------|
| `amount` | number | Yes | Same minimum as today’s wallet funding (`> 0`; member app sends at least `0.01`) |
| `provider` | string | Yes | Same set as today: `PAYSTACK`, `FLUTTERWAVE`, `USDT`, `ADMIN`, `DIRECT_ACCOUNT` |
| `walletType` | string | Yes | Add `LEGACY_VOUCHER` and `LEGACY_CASHOUT`. Keep `CASH` and `VOUCHER` |
| `callbackUrl` | string | No | Unchanged |

**On successful `POST /payments/verify` (and the USDT confirm path):**

1. Credit **only** the wallet named in `walletType`.
2. Credit the verified amount once (idempotent on payment reference).
3. A second verify of the same reference must not credit again.
4. Do **not** also credit network `CASH` or network `VOUCHER`.

`walletType: "LEGACY_CASHOUT"` follows the same rules and credits Legacy cashout instead.

Response shape of initiate and verify stays as it is today. The member app only needs the existing authorization / USDT payload, plus a successful verify that credits the requested wallet.

### 3.2 Fund — bank transfer (manual deposit)

Extend the existing manual-deposit wallet type. Approval must credit the same wallet the member selected.

```http
POST /payments/manual-deposit
Content-Type: multipart/form-data
```

`walletType` today: `REGISTRATION` | `VOUCHER`  
**Add:** `LEGACY_VOUCHER` | `LEGACY_CASHOUT`

On admin **approve**:

- Credit that Legacy wallet for the approved amount and currency.
- One approval → one credit.
- Reject must not credit.

`GET /payments/manual-deposit` must return the stored `walletType`, including the two new values, so the member can see which wallet a pending deposit is for.

### 3.3 Transfer — move from the member’s own wallets

Extend `POST /wallets/transfer`. This is an intra-user move (no recipient username, no Transaction PIN), same as Cash → Product Voucher today.

```http
POST /wallets/transfer
Content-Type: application/json
```

```json
{
  "fromWalletType": "CASH",
  "toWalletType": "LEGACY_VOUCHER",
  "amount": 5000,
  "currency": "NGN"
}
```

```json
{
  "fromWalletType": "REGISTRATION",
  "toWalletType": "LEGACY_CASHOUT",
  "amount": 5000,
  "currency": "NGN"
}
```

| Field | Type | Required | Rules |
|-------|------|----------|--------|
| `fromWalletType` | string | Yes | `CASH` or `REGISTRATION` (same sources as today) |
| `toWalletType` | string | Yes | Add `LEGACY_VOUCHER` and `LEGACY_CASHOUT` alongside existing targets |
| `amount` | number | Yes | `≥ 1`, and not above the source balance |
| `currency` | string | Yes | `NGN` or `USD`, matching the source wallet |

**Allowed pairs (all required):**

| From | To |
|------|----|
| `CASH` | `LEGACY_VOUCHER` |
| `CASH` | `LEGACY_CASHOUT` |
| `REGISTRATION` | `LEGACY_VOUCHER` |
| `REGISTRATION` | `LEGACY_CASHOUT` |

**On success:**

1. Debit the source wallet.
2. Credit the destination Legacy wallet for the same amount and currency (1:1, no fee).
3. Both sides commit together. A failure leaves both balances unchanged.
4. Response stays `{ "transferId": "uuid" }`.

Do **not** route these through `POST /legacy/cashout/transfer`. That endpoint debits Legacy cashout. This request credits it.

---

## 4. Who can do this

| Rule | Detail |
|------|--------|
| Caller | Authenticated member. Block during admin impersonation with the existing `IMPERSONATION_ACTION_BLOCKED` response used on other money moves. |
| Legacy membership | Allowed when the member has a Legacy wallet for that destination: active member, **or** a pending join (`pendingJoin` set and the voucher/cashout wallet already exists). Pending members must be able to fund **Legacy product voucher** so they can pay Legacy checkout. |
| Not in Legacy | `400` with code `NOT_LEGACY_MEMBER` (or `LEGACY_JOIN_REQUIRED`). Do not create a Legacy membership as a side effect of a payment. |
| Wallet missing | If the member is in Legacy (active or pending) but the destination wallet row is missing, create it and then credit it. Same as join already does for `LEGACY_VOUCHER` / `LEGACY_CASHOUT`. |
| Cashout lock | `canCashoutLegacy === false` or `LEGACY_CASHOUT` status `LOCKED` blocks **withdraw** and **outbound** `POST /legacy/cashout/transfer` only. It must **not** block funding or inbound transfer into Legacy cashout. Do not return `LEGACY_CASHOUT_LOCKED` for these inbound calls. |
| Currency | Credit in the payment / transfer currency. Follow the same NGN vs USD rules as network wallet funding. Do not convert silently. |
| Amount | Reject `0` and negative. Insufficient source balance on transfer: existing insufficient-balance error. |

---

## 5. What these credits must not do

A fund or inbound transfer is principal, not an earning.

- Do **not** pay instant commission, weekly/monthly commission, Successline bonus, or any other bonus.
- Do **not** award PV.
- Do **not** apply the membership-commission voucher fee (`voucherFee`). That fee stays on commission drops only.
- Do **not** change package, cycle, `monthlyQualifiedAt`, or Successline counts.
- Do **not** mark a pending join as paid. Spending the voucher is still `POST /orders/checkout/:checkoutId/pay-wallet` with `walletType: "LEGACY_VOUCHER"`.

After the credit:

- `LEGACY_VOUCHER` can be spent only on Legacy marketplace checkout (unchanged).
- `LEGACY_CASHOUT` can be withdrawn to bank or moved out with the existing cashout endpoints, subject to the existing PIN, bank, and lock rules.

---

## 6. Ledger

Members need to see the money arrive.

### Legacy cashout — `GET /legacy/cashout` → `items[]`

Append a **Credit** row for every successful inbound fund or transfer:

| Source | `description` | `type` |
|--------|----------------|--------|
| Gateway or verified USDT | `Funded Legacy cashout` | `Credit` |
| Approved manual deposit | `Bank transfer to Legacy cashout` | `Credit` |
| Transfer from Cash | `Transfer from Network Cashout` | `Credit` |
| Transfer from Registration | `Transfer from Registration wallet` | `Credit` |

Use those descriptions (or the same wording). Do not return raw enum strings such as `LEGACY_CASHOUT`.

Each row keeps the current shape: `id`, `date`, `description`, `type`, `amount`, `currency`.

`balance` on `GET /legacy/cashout` and `legacyCashout.balance` on `GET /legacy/me` must include the new credit immediately.

### Legacy voucher

`GET /legacy/voucher` must keep returning the updated `balance` immediately after a credit.

Also add a ledger, same idea as cashout, so the voucher page can list funding history:

```json
{
  "currency": "NGN",
  "balance": 17000,
  "status": "ACTIVE",
  "items": [
    {
      "id": "ledger-uuid",
      "date": "2026-10-01T16:00:00.000Z",
      "description": "Funded Legacy product voucher",
      "type": "Credit",
      "amount": 5000,
      "currency": "NGN"
    }
  ],
  "nextCursor": null
}
```

| Source | `description` |
|--------|----------------|
| Gateway or verified USDT | `Funded Legacy product voucher` |
| Approved manual deposit | `Bank transfer to Legacy product voucher` |
| Transfer from Cash | `Transfer from Network Cashout` |
| Transfer from Registration | `Transfer from Registration wallet` |

`items` may be omitted on old responses. The member app will treat a missing `items` as an empty list. `balance` is still required.

Debit rows for marketplace spend are useful but **not** required for this request.

---

## 7. Errors

Use the existing error envelope (`statusCode`, `message`, `code` or `error`).

| Case | HTTP | Code / message |
|------|------|----------------|
| Unknown `walletType` | 400 | Name the allowed values, including `LEGACY_VOUCHER` and `LEGACY_CASHOUT` |
| Member has not started Legacy | 400 | `NOT_LEGACY_MEMBER` or `LEGACY_JOIN_REQUIRED` |
| Impersonation | 403 | `IMPERSONATION_ACTION_BLOCKED` |
| Transfer amount above source balance | 400 | Existing insufficient-balance payload |
| Currency does not match the source wallet | 400 | Clear message, same as other transfers |
| Duplicate payment verify | 200 | Return the original success. Do not credit again |
| Cashout locked, inbound fund or transfer | — | **Allow.** Do not use `LEGACY_CASHOUT_LOCKED` |

---

## 8. Out of scope

- Sending Legacy voucher or Legacy cashout **to another member** (`POST /wallets/fund-transfer`). This request is the member’s own wallets only.
- Changing outbound `POST /legacy/cashout/withdraw` or `POST /legacy/cashout/transfer`.
- Letting network `VOUCHER` or `AUTOSHIP` be the source of `POST /wallets/transfer`. Sources stay `CASH` and `REGISTRATION`.
- Aliasing `AUTOSHIP` to `LEGACY_VOUCHER` on these inbound calls. That alias exists only on outbound cashout transfer.

---

## 9. Acceptance checks

- [ ] `POST /payments/wallet-funding/initiate` with `walletType: "LEGACY_VOUCHER"` initiates payment. After verify, **only** Legacy product voucher balance increases by that amount.
- [ ] Same call with `walletType: "LEGACY_CASHOUT"` credits **only** Legacy cashout.
- [ ] `walletType: "CASH"` and `walletType: "VOUCHER"` still credit the network wallets.
- [ ] Verifying the same payment reference twice does not double-credit.
- [ ] Manual deposit submitted as `LEGACY_VOUCHER` or `LEGACY_CASHOUT` stays pending, then credits that wallet on approval and does not credit it on reject.
- [ ] `POST /wallets/transfer` succeeds for all four pairs in §3.3. Source balance drops by the amount; destination balance rises by the same amount.
- [ ] A pending Legacy join can transfer or fund into `LEGACY_VOUCHER` and then pay checkout with that balance.
- [ ] A member who has never started Legacy is rejected and no Legacy wallet is created.
- [ ] Inbound credit to a locked Legacy cashout succeeds. Withdraw and outbound transfer stay blocked.
- [ ] No commission, PV, Successline bonus, or voucher fee is created by these credits.
- [ ] `GET /legacy/cashout` `items` includes a Credit row for each inbound fund and transfer.
- [ ] `GET /legacy/voucher` `balance` updates immediately, and `items` includes a Credit row when the ledger is returned.
- [ ] Impersonation cannot fund or transfer.
