# Legacy Club — Phase 1 Context

**Status:** Ready for implementation  
**Date:** 2026-09-18  
**Updated:** 2026-09-18 — client voice adjustment (everything in Legacy account; cashout with no referrals; auto-sponsor; separate Legacy voucher)  
**Audience:** Product, backend, frontend, admin  
**Canonical sources:** [Flow.txt](../Flow.txt), flyer, client answers (18 Sep 2026), client call (18 Sep 2026 evening)

Related:

- [UI/UX](./phase-1-ui-ux.md)
- [Backend](./phase-1-backend.md)
- [Frontend integration](./phase-1-frontend-integration.md)
- [Compensation rules](../../COMPENSATION_AND_EARNINGS_RULES.md) — existing Segulah network (unchanged)

---

## 1. What Phase 1 is

Segulah Global Legacy Club is a **product-based membership** on top of an already-activated Segulah account.

Phase 1 puts **Legacy Club on the member dashboard** and makes this real:

1. An activated Segulah member can **join** by picking products from a **separate Legacy marketplace**, paid from a **separate Legacy product voucher** (not the network voucher).
2. **Instant Membership Commission** goes into the **Legacy account**. They can **cash it out with zero referrals**.
3. Their **Legacy sponsor** receives a **Successline bonus** on that Instant into the same **Legacy account**.
4. The buyer and the Legacy sponsor receive **PV only** on that purchase. No product or registration cash commissions.
5. If their Segulah **direct sponsor** is already in Legacy Club, they **join under that person automatically**. They only type a username if that sponsor is **not** in Legacy Club.

Do not open the menu until this slice works end to end.

---

## 2. Out of scope (Phase 2 and 3)

Do **not** build these in Phase 1:

| Later | What |
|---|---|
| Phase 2 | Monthly Membership Commission every 30 days |
| Phase 2 | Autoship gate (₦10,000 / ₦40,000 / ₦80,000) and pending monthly |
| Phase 2 | Successline bonus on monthly commissions |
| Phase 2 | Monthly **increases** after 3 Successlines (from the next month; not retroactive) |
| Phase 3 | Upgrade by paying the difference; clock restarts |
| Phase 3 | Reactivate every 6 months (keeps the increased monthly if they already have 3) |
| Phase 3 | Upgrade / reactivation history report |

Admin config **stores** monthly, Autoship, cycle length, and **min directs to raise monthly** (default 3) in Phase 1. Phase 1 **counts** Successlines and does **not** lock cashout on them. The raise is Phase 2.

---

## 3. Who can join

- Must already be a **paid Segulah Global member** (`isRegistrationPaid = true`).
- Any of the existing 6 packages (Nickel–Diamond).
- NGN and USD members. Convert with the same network rate: **₦1,000 = $1**.
- One Legacy membership per person. One Legacy sponsor for life.
- A person cannot register themselves.
- The first people in the tree are enrolled by **Super Admin** (seed). After that, members sponsor members.

### 3.1 Who is the Legacy sponsor (client call)

Use the Segulah **direct sponsor** (`User.referredById`) first:

| Segulah direct sponsor | What happens |
|---|---|
| Already an **ACTIVE** Legacy Club member | New member is placed **under them automatically**. No username field. They cannot pick someone else. |
| Not in Legacy Club, or no Segulah sponsor | New member must enter a **username** of someone who **is** already in Legacy Club. |

That is the pressure: if the upline does not join Legacy Club, the downline registers under somebody else and is gone.

The username they type (when required) can be **any** ACTIVE Legacy member — not only someone in their matrix. Once set, the sponsor does not change.

---

## 4. Packages (flyer)

Amounts are stored in NGN. USD display = NGN ÷ 1,000.

| | VIP | Executive | Supreme |
|---|---|---|---|
| Product purchase | ₦60,000 / $60 | ₦200,000 / $200 | ₦500,000 / $500 |
| Instant commission | ₦20,000 / $20 | ₦80,000 / $80 | ₦200,000 / $200 |
| Monthly × 6 (Phase 2) | ₦30,000 / $30 | ₦120,000 / $120 | ₦250,000 / $250 |
| Successline bonus | 10% | 20% | 30% |
| Monthly Autoship (Phase 2) | ₦10,000 / $10 | ₦40,000 / $40 | ₦80,000 / $80 |
| 3 Successlines | Raises **monthly** from the next month (Phase 2). Does **not** lock cashout. | same | same |
| Cycle | 6 months | 6 months | 6 months |

**6-month package total** (Instant + monthly, for display only in Phase 1): VIP ₦200,000 · Executive ₦800,000 · Supreme ₦1,700,000.

Flyer monthly figures are stored as the Phase 2 default. Base vs increased monthly (after 3) is a Phase 2 config split — not paid in Phase 1.

Super Admin can change every figure later without a code change.

---

## 5. How they join (member language)

1. Become a Segulah member (already exists).
2. Open **Legacy Club** on the dashboard (not the normal shop menu).
3. Choose VIP, Executive, or Supreme.
4. Sponsor:
   - Shown as **automatic** if their Segulah sponsor is already in Legacy Club, or
   - They **enter a username** if that sponsor is not in Legacy Club.
5. Fund the **Legacy product voucher** (separate column from the network product voucher).
6. Go into the **Legacy marketplace** from the Legacy Club menu only.
7. Choose products of their choice **worth at least** the package amount.
8. Checkout and pay from **Legacy product voucher** (pickup or delivery).
9. Instant Commission lands in the **Legacy account**. They can cash out at once, even with no Successlines. Membership is active.

If the cart is below the package amount, they cannot checkout.

If they pick more than the package amount, they pay the cart total (more products = more PV). Instant Commission stays the **package** Instant, not the extra.

---

## 6. Money — Legacy account (not two Cashouts)

The client dropped “Instant to normal Cashout” and the “wait for 3 before Legacy cashout” rule.

**All Legacy earnings in Phase 1 go to the Legacy account** (`LEGACY_CASHOUT`):

- The member’s **own Instant Commission**
- **Successline bonus** on each direct’s Instant (sponsor’s 10% / 20% / 30%)

They may **cash out** that account with **zero referrals** (same approval flow as CASH: PIN, admin).

They may **move** Legacy account money to their own CASH, network VOUCHER, AUTOSHIP, or Legacy voucher. No 3-Successline gate.

**No** Autoship-wallet split on these credits (not the Segulah earnings split).

Normal **CASH** is unchanged for network earnings. Instant does **not** go there.

### 6.1 Legacy product voucher (new column)

Separate from the network **Product Voucher**.

| Wallet | Used for |
|---|---|
| VOUCHER (existing) | Normal network shop only |
| LEGACY_VOUCHER (new) | Legacy Club marketplace only (join in Phase 1; Autoship / upgrade / reactivate later) |

Do not debit the network voucher for a Legacy cart. Do not debit Legacy voucher for a network cart.

Members fund Legacy voucher by transfer from CASH (and admin fund / existing deposit rails with `walletType: LEGACY_VOUCHER`). Create the wallet when they first open Legacy join (or on first fund), so they can load it **before** checkout.

---

## 7. Successline bonus (Phase 1)

Unilevel **level 1 only**. Not the matrix. No levels 2–13.

When Ada (Executive, 20%) is Bode’s Legacy sponsor and Bode’s join order is paid:

- Bode gets Bode’s Instant → Bode’s **Legacy account**.
- Ada gets 20% of Bode’s Instant → Ada’s **Legacy account**.

The bonus uses the **sponsor’s** package rate, not the new member’s package.

Phase 1 does **not** pay Successline bonus on monthly (no monthly yet).

Count Successlines (paid joins you personally sponsored). Show the count. **Do not** lock cashout on it. Phase 2 uses the count to **raise monthly**.

---

## 8. Products, PV, and commissions

Join is a **real product order** from the same catalogue. Fulfilment (merchant pickup / delivery) is unchanged.

Two doors, two carts, two voucher columns:

- Network menu → network marketplace → network voucher → network commissions + PV (unchanged).
- Legacy Club menu → Legacy marketplace → Legacy voucher → **PV only**.

| On a Legacy join purchase | Yes / no |
|---|---|
| Buyer personal PV | Yes |
| Legacy sponsor direct PV | Yes |
| Segulah referrer PV (if different person) | No |
| Matrix community CPV (levels 1–13) | No |
| PPPC / DRPPC / CPPC (cash) | No |
| Merchant product cash commissions | No |
| Business consultant product cash | No |
| Instant Commission (buyer) | Yes → **Legacy account** |
| Successline Instant bonus (Legacy sponsor) | Yes → **Legacy account** |

“Direct sponsor” for PV and bonus means the **Legacy Club sponsor**. That is often the Segulah `referredById` (auto case), but not always.

---

## 9. What members can see

- Their own Legacy package, join date, Instant received, **Legacy account** balance, **Legacy voucher** balance.
- How they were placed (automatic under Segulah sponsor vs username they entered).
- How many Successlines they have (informational in Phase 1).
- **Usernames** of people they personally registered (level 1 only).
- No matrix, no level 2–13, no browsing another member’s tree.
- No “locked until 3” message.

---

## 10. Assumptions (do not re-ask the client)

1. Legacy Autoship is **not** the existing Segulah Autoship wallet. Phase 2 will be a Legacy marketplace purchase of ₦10k / ₦40k / ₦80k from **Legacy voucher**.
2. One Legacy sponsor for life. Auto-placement cannot be overridden if the Segulah sponsor is already in Legacy Club.
3. Members still receive **their own** Instant (and later Monthly). No Segulah registration/product **cash** commissions from Legacy activity.
4. Cart must be **≥** package price, not necessarily exact.
5. Instant and Successline Instant bonus pay when the join **order is paid**, not when the parcel is received.
6. Super Admin seed enroll is required so the first sponsor exists.
7. “Cash out even with no referrals” = withdraw and move from the Legacy account with no Successline gate.
8. 3 Successlines in Phase 1 = display + stored count only. The monthly **increase** is Phase 2. Base vs increased monthly amounts are not required to pay Instant.
9. “Product voucher column is different” = new `LEGACY_VOUCHER` wallet, not a UI-only label on the same VOUCHER row.

---

## 11. Success for Phase 1

- Legacy Club is on the member menu (separate from the network shop).
- Auto-sponsor when the Segulah direct sponsor is in Legacy Club; otherwise username.
- Join paid from **Legacy voucher**; network voucher untouched.
- Instant and Successline Instant bonus both hit the **Legacy account**, no Autoship split.
- Member can cash out / move Legacy account money with **zero** Successlines.
- Buyer + Legacy sponsor get PV; no product cash commissions on that order.
- Super Admin can change package figures and seed the first members.
- Network shop behaviour is unchanged.
