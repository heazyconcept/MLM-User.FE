# Legacy Club — Phase 3 Context

**Status:** Ready for implementation  
**Date:** 2026-09-18  
**Updated:** 2026-09-18 — Instant to Legacy account; Legacy voucher; no cashout lock; reactivate keeps increased monthly  
**Depends on:** Phase 1 and Phase 2 shipped (evening-call rules)  
**Audience:** Product, backend, frontend, admin  
**Canonical sources:** [Flow.txt](../Flow.txt), flyer, client answers (18 Sep 2026) points 12–15, client call (18 Sep 2026 evening)

Related:

- [UI/UX](./phase-3-ui-ux.md)
- [Backend](./phase-3-backend.md)
- [Frontend integration](./phase-3-frontend-integration.md)
- [Phase 1 context](./phase-1-context.md)
- [Phase 2 context](./phase-2-context.md)

---

## 1. What Phase 3 is

Phase 3 is the **lifecycle** after a member is already in Legacy Club.

**Upgrade** — move to a higher package by paying **only the difference** in products (from **Legacy product voucher**). Instant is also **only the difference**, into the **Legacy account**. The 6-month clock **starts again from month 1**. Keep a **history**.

**Reactivate** — after this cycle’s 6 monthly dues are issued, buy the **full** pack again, get **full** Instant again (Legacy account), start a **new** 6 months. If they already have 3 Successlines, they **keep the increased monthly** on the new cycle. They do not need 3 new people. Cashout was never locked (Phase 1).

Sponsor does not change. One Legacy sponsor for life.

---

## 2. Out of scope

- Downgrade
- Changing Legacy sponsor
- A second membership
- Matrix / extra levels
- New wallets beyond Phase 1 (Legacy account + Legacy voucher already exist)

---

## 3. Upgrade (client 12–13)

Only **up**: VIP → Executive → Supreme.

Products from the Legacy marketplace, paid with **Legacy voucher**, worth **at least the difference**:

| From → To | They pay (products) | Instant to **Legacy account** |
|---|---|---|
| VIP → Executive | ₦140,000 | ₦60,000 |
| VIP → Supreme | ₦440,000 | ₦180,000 |
| Executive → Supreme | ₦300,000 | ₦120,000 |

USD: ÷ 1,000.

On pay:

1. Package becomes the new one (Autoship + **base/increased monthly** follow the **new** package).
2. Instant **difference** → **Legacy account** (no Autoship-wallet split).
3. Sponsor Successline bonus on that Instant difference (their %) → their Legacy account.
4. Clock **resets**: this date is day 0. Next monthly is 30 days later. New months 1–6.
5. `monthlyQualifiedAt` is **not** cleared. If they already have 3, new-cycle months use the **new package increased** rate (Phase 2 rule: `dueAt > qualifiedAt`). If they do not have 3 yet, new months use the **new package base** until they hit 3.
6. History row: from, to, paid, Instant, date, order.
7. PV for buyer + Legacy sponsor. No product cash commissions.

### Pending from the old cycle

Clock restart is the **calendar**, not a clawback.

- Already in the Legacy account stays there.
- Still **waiting** stays waiting at the **snapshotted** old amount (base or increased). Drops on Autoship, FIFO (old pending before new-cycle pending).
- Not-yet-due old months are **not** created.

Example: VIP, month 2 waiting (whatever was snapshotted), month 3 not due. Upgrade to Executive.

- Month 2 still waits at the old VIP snapshot.
- No VIP months 3–6.
- Instant ₦60,000 → Legacy account.
- New Executive month 1 due in 30 days: increased if they already have 3, else Executive base.

---

## 4. Reactivate (client 14 + evening call)

Allowed when the **current** cycle has issued all 6 dues (`isCycleComplete`). Open pending does not block it.

Products worth **at least the full current package**, Legacy voucher.

On pay:

1. **Full** Instant → **Legacy account**.
2. Sponsor % of that Instant → sponsor Legacy account.
3. New clock, **same** package.
4. `monthlyQualifiedAt` **kept**. If they already had 3 (even if those people did not reactivate), **all six** new monthlies use the **increased** rate when they become due. If they never hit 3, new months stay **base** until they do.
5. History row.
6. PV only; no product cash commissions.

Higher package when the cycle is over = **Upgrade**, not Reactivate. One checkout, one intent.

Cashout does **not** depend on 3. The 3 only matter for the **monthly raise**, and that raise **survives** reactivation.

---

## 5. Autoship around upgrade / reactivate

After upgrade, Autoship amount is the **new** package.

The upgrade/reactivate basket may also release waiting months: units = `floor(subtotal / autoship of package **before** change)`, FIFO. A ₦140,000 VIP→Exec cart can clear several waiting VIP months, then the clock starts as Executive.

Early extra products do not bank toward **new** month 1.

Pay always **LEGACY_VOUCHER**.

---

## 6. What members see

- **Upgrade** if a higher package exists (not Supreme).
- **Reactivate** when 6 dues are complete.
- Both, if cycle is complete and they are not Supreme.
- History: join / upgrade / reactivate.
- This-cycle months table + **prior pending** callout.
- Successline usernames only. No lock copy.

---

## 7. Assumptions

1. Upgrade only **up**.  
2. Reactivate = same package, full price, full Instant.  
3. One sponsor for life (auto or chosen at join — never edited).  
4. Old pending kept; old not-due months dropped from the plan.  
5. Instant difference / full Instant → Legacy account; Successline % of that Instant → sponsor Legacy account.  
6. `monthlyQualifiedAt` never resets on upgrade or reactivate. Lifetime Successline **joins** still count toward 3.  
7. New-cycle monthlies use **new package** base/increased + Phase 2 `dueAt > qualifiedAt` rule.  
8. PV only on these orders.  
9. Difference uses **current** config at pay time.  
10. No admin waive of upgrade/reactivate products in Phase 3.

---

## 8. Success for Phase 3

- VIP→Exec: pay ₦140,000 on Legacy voucher; Instant ₦60,000 in Legacy account; clock month 1.  
- History shows it.  
- Old pending still drops at snapshot.  
- After 6 dues, Reactivate: full Instant in Legacy account; if they had 3, new months are increased.  
- Supreme: Reactivate only.  
- Phase 1–2 join, auto-sponsor, Autoship, and network shop unchanged.
