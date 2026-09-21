# Legacy Club — Phase 2 Context

**Status:** Ready for implementation  
**Date:** 2026-09-18  
**Updated:** 2026-09-18 — align with Phase 1 (Legacy account, no cashout lock, Legacy voucher) + monthly **increase** after 3 Successlines  
**Depends on:** Phase 1 shipped (updated 18 Sep 2026 evening rules)  
**Audience:** Product, backend, frontend, admin  
**Canonical sources:** [Flow.txt](../Flow.txt), flyer, client answers (18 Sep 2026), client call (18 Sep 2026 evening)

Related:

- [UI/UX](./phase-2-ui-ux.md)
- [Backend](./phase-2-backend.md)
- [Frontend integration](./phase-2-frontend-integration.md)
- [Phase 1 context](./phase-1-context.md)

---

## 1. What Phase 2 is

After a member has joined Legacy Club, they earn **Monthly Membership Commission** for **6 months**.

That money does **not** enter the Legacy account on the calendar date alone. It **waits** until they complete that month’s **Autoship** (products from the Legacy marketplace, paid from **Legacy product voucher**). The day they do Autoship, waiting months **drop** into the **Legacy account**. They can cash that out **without** 3 Successlines (Phase 1).

Their Legacy sponsor earns a **Successline bonus** on those monthly amounts **when they drop**, into the sponsor’s Legacy account.

**3 Successlines do not unlock cashout.** They **raise the monthly amount** from the **next** month (not retroactive). After they reactivate (Phase 3), they **keep** the higher monthly.

Phase 1 closed the Legacy shop after join so Instant could not double-pay. Phase 2 **opens it again** for Autoship only — not a second join.

---

## 2. Out of scope (Phase 3)

| Later | What |
|---|---|
| Phase 3 | Upgrade by paying the difference; 6-month clock starts again |
| Phase 3 | Reactivate after 6 months; full Instant again; **keep increased monthly** if they already have 3 |
| Phase 3 | Upgrade / reactivation history |
| Phase 3 | Pending months across an upgrade (keep at snapshotted rate) |

Do not build Upgrade or Reactivate buttons in Phase 2. After 6 monthly periods are issued, stop creating new months until Phase 3.

---

## 3. The 6-month clock

Clock starts at **join paid** (`cycleStartedAt` from Phase 1). Not calendar months. **30 days** per month.

| Day | What |
|---|---|
| 0 | Join paid. Instant → **Legacy account**. No monthly yet. |
| 30 | Month 1 monthly becomes **due** (pending) |
| 60 | Month 2 due |
| 90 | Month 3 due |
| 120 | Month 4 due |
| 150 | Month 5 due |
| 180 | Month 6 due — last monthly of this cycle |

Exactly **six** monthly commissions per cycle. Join Instant is separate and already paid in Phase 1.

---

## 4. Two monthly rates (client call)

Until they have **3 paid direct Successlines**, each new due month uses the **base** monthly.  
Once they have 3, **later** months use the **increased** monthly. Months already due stay at the amount they were given. No back-pay.

Client examples:

| When they complete 3 | Increased months |
|---|---|
| Before month 1 is due | Months 1–6 (all six) |
| During month 3 (month 3 already due) | Months **4, 5, 6** only |
| During month 5 | Month **6** only (one month) |

Then they reactivate (Phase 3) and **continue** on the increased rate.

**Rule:** a month uses the increased rate if `dueAt` is **strictly after** the moment the 3rd Successline’s join was paid. Otherwise base.

### What are the two numbers?

The flyer ₦30,000 / ₦120,000 / ₦250,000 is the **increased** (advertised) rate.

The client did **not** give the **base** (before 3) figures. Super Admin must set `monthlyCommissionBaseNgn` per package **before production**. Dev seed may copy the increased amount so jobs run; replace it before go-live.

| Package | Base (before 3) | Increased (after 3) |
|---|---|---|
| VIP | Admin | ₦30,000 / $30 |
| Executive | Admin | ₦120,000 / $120 |
| Supreme | Admin | ₦250,000 / $250 |

When a month becomes due, **snapshot** amount + `BASE` | `INCREASED` on that row. Config changes do not rewrite waiting or paid months.

---

## 5. Pending vs dropped

**Due (pending)**  
On the 30-day date, that month’s commission (base or increased, already snapshotted) is **owed**. It does **not** enter the Legacy account yet.

**It never cancels** because they were late, and it does not change if they later hit 3.

**Dropped**  
Pending money moves into the **Legacy account** only after a qualifying **Autoship** purchase.

If Autoship is already done for that release, it drops the same day it becomes due.  
If they miss Autoship, it **waits**, then drops immediately when Autoship is done.

They can **cash out** dropped money with zero Successlines. Pending is **not** withdrawable.

---

## 6. What Autoship is

Autoship is **not** the Segulah Autoship wallet and **not** the network Product Voucher.

Each qualifying purchase: products of their choice from the **Legacy marketplace** (Legacy Club menu only), paid from **Legacy product voucher**, worth **at least**:

| Package | Autoship |
|---|---|
| VIP | ₦10,000 / $10 |
| Executive | ₦40,000 / $40 |
| Supreme | ₦80,000 / $80 |

Same as Phase 1 Legacy orders: PV for buyer + Legacy sponsor, **no** product cash commissions, pickup or delivery.

The **join pack** does **not** count as monthly Autoship.

Extra above one Autoship unit can release **more than one** waiting month in the same checkout. Leftover under one unit does **not** bank.

No Instant on Autoship orders.

---

## 7. One Autoship, how many months

Each **full** Autoship amount in a paid Legacy order releases **one** pending month, **oldest first**.

Examples (VIP, ₦10,000):

- One pending, cart ₦10,000 → that month drops.  
- Three pending, cart ₦10,000 → oldest only.  
- Three pending, cart ₦30,000 → all three.  
- Cart ₦15,000 with one pending → one drop; ₦5,000 is PV only.

---

## 8. Successline bonus on monthly

When Bode’s monthly **drops** into Bode’s Legacy account, Ada (Legacy sponsor) gets her % of **that dropped amount** (whatever was snapshotted — base or increased) into Ada’s Legacy account.

- Sponsor’s current package % (10 / 20 / 30).  
- Does **not** pay while Bode is only pending.  
- Instant Successline bonus from Phase 1 is unchanged.  
- Level 1 only. No matrix.  
- Sponsor can cash that bonus out immediately (no lock).

---

## 9. After month 6 (until Phase 3)

- No 7th monthly.  
- Pending 1–6 can still drop on later Autoship.  
- Home: *Your 6-month cycle is complete. Pending commission still drops when you do Autoship.*  
- If they already have 3: *When you reactivate, you keep the increased monthly.* (Copy only — no button.)

---

## 10. Assumptions (do not re-ask the client)

1. 30 days from `cycleStartedAt`.  
2. Six monthlies after Instant; Instant is not month 1.  
3. Join purchase ≠ Autoship.  
4. Autoship = Legacy shop + Legacy voucher, ≥ package Autoship.  
5. One full unit = one pending month (FIFO).  
6. No forfeiture. No banking leftover.  
7. Amount + rate tier snapshotted at due. Hitting 3 later does not rewrite that row.  
8. Increase starts on the **next** due after the 3rd Successline (strict `dueAt > qualifiedAt`).  
9. Flyer monthly = **increased**. Base = admin before production.  
10. Seed enroll uses the same clock.  
11. Sponsor % is sponsor’s package at **drop** time.  
12. Network shop, network voucher, and Segulah Autoship wallet are unchanged.

---

## 11. Success for Phase 2

- ACTIVE members see month progress, **base vs increased**, pending, Autoship.  
- Legacy shop accepts Autoship on **Legacy voucher** (no second Instant).  
- Due months wait; Autoship drops them into the Legacy account.  
- 3 Successlines raise **future** monthlies only.  
- Sponsor monthly bonus pays on drop, into Legacy account, no cashout lock.  
- After 6 dues, no more months; leftover pending can still drop.  
- Phase 1 join, auto-sponsor, Instant-in-Legacy, and network shop still behave the same.
