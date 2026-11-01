# Frontend Integration: Cashout charge and voucher gate

Date: 2026-10-25

Every bank cashout now shows a payout notice, a 5% charge, and the amount that will reach the bank. Cashout is blocked while the network product voucher is ₦10,000 or more.

Applies to:

- Withdrawals (`POST /withdrawals/request`)
- Legacy cashout (`POST /legacy/cashout/withdraw`)
- Caucus cashout (`POST /caucus/cashout/withdraw`)

Related: [Admin profit reports](./frontend-integration-admin-profit-reports.md)

---

## Policy

`GET /withdrawals/cashout-policy`

Auth: Bearer token, registration paid. No cash-wallet eligibility check. Call it from all three cashout pages.

```json
{
  "feeRate": 0.05,
  "voucherLimitNgn": 10000,
  "voucherBalanceNgn": 4500,
  "canCashout": true,
  "blockReason": null,
  "payoutNotice": "Withdrawals are paid within 24 to 72 hours on working days. We do not pay on weekends."
}
```

| Field | Use |
|-------|-----|
| `payoutNotice` | Show this sentence on the withdrawals page, the Legacy cashout page, and the Caucus cashout page |
| `feeRate` | `0.05`. Preview while the member types |
| `canCashout` | `false` disables submit |
| `blockReason` | Show this when `canCashout` is false. It is null when cashout is allowed |
| `voucherBalanceNgn` | Network product voucher, in naira, including for a USD member |
| `voucherLimitNgn` | `10000`. Cashout is allowed only while the voucher is **under** this |

A missing product voucher is balance `0` and cashout is allowed. The Legacy product voucher does not count.

When blocked, submit returns `400` with message: `Cashout is available when your product voucher is under ₦10,000.`

The same check runs again when an admin approves. A member who funds the voucher up to ₦10,000 after requesting cannot be paid until the voucher is back under the limit.

---

## Charge preview

The member types the amount that leaves the wallet. The bank receives 95%.

While typing, in the withdrawal currency:

- fee = half-up to 2 decimal places of `amount * feeRate`
- net = amount − fee

Example: ₦100,000 requested, ₦5,000 charge, **₦95,000** expected in the bank.

Show three figures on the form: requested amount, 5% deduction, expected bank amount.

USD members use the same 5% in USD. Caucus cashout is always naira.

---

## After submit

Cash and Legacy withdrawals return the withdrawal object. New rows always include:

| Field | Meaning |
|-------|---------|
| `amount` | Amount leaving the wallet |
| `feeAmount` | 5% charge |
| `netAmount` | Amount the office sends to the bank |

Caucus `POST /caucus/cashout/withdraw` returns the same split on `data`:

```json
{
  "status": "success",
  "data": {
    "id": "withdrawal-uuid",
    "amountNgn": 100000,
    "feeAmount": 5000,
    "netAmount": 95000,
    "currency": "NGN",
    "status": "PENDING"
  }
}
```

History (`GET /withdrawals`, `GET /withdrawals/:id`, and the admin withdrawal queue) returns `feeAmount` and `netAmount`.

`feeAmount: null` is a withdrawal created before this charge. There is no deduction. The bank amount is `amount`. Do not invent a 5% line on those rows.

---

## Admin queue

On each withdrawal row show:

- Wallet amount (`amount`)
- Fee (`feeAmount`, or none when null)
- Bank amount (`netAmount`, or `amount` when `netAmount` is null)

Mark paid is unchanged. It means the transfer was sent. The office sends the bank amount, not the wallet amount.

The wallet is debited the full `amount` on approve. The 5% is company profit and appears on the profit report as `CASHOUT_FEE`.
