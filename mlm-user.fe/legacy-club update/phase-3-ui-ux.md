# Legacy Club — Phase 3 UI/UX

**Status:** Ready for implementation  
**Date:** 2026-09-18  
**Updated:** 2026-09-18 — Instant in Legacy account; Legacy voucher; keep increased monthly; no lock copy  
**Apps:** `mlm-user.fe` (member) and admin panel  
**Context:** [phase-3-context.md](./phase-3-context.md)  
**Earlier screens:** [Phase 1 UI](./phase-1-ui-ux.md) · [Phase 2 UI](./phase-2-ui-ux.md)

---

## 1. What changes for the member

Phase 2 ended with a cycle-complete banner and no button. Phase 3 adds:

- **Upgrade package** (pay the difference, Legacy voucher)
- **Reactivate** (after 6 dues, full pack again)
- **History**

Language: **Upgrade**, **pay the difference only**, **Reactivate**, **starts again from month 1**, **Instant goes to your Legacy account**. Do not say they must refer 3 to cash out. Do not say “new sponsor”.

---

## 2. Navigation

| Route | Screen | Who |
|---|---|---|
| `/legacy` | Home — Upgrade and/or Reactivate | ACTIVE |
| `/legacy/upgrade` | Higher packages + difference | ACTIVE, not Supreme |
| `/legacy/reactivate` | Confirm full pack | Cycle complete |
| `/legacy/shop` | Join / Autoship / Upgrade / Reactivate | `shopMode` |
| `/legacy/history` | History | ACTIVE |

`/legacy/months` remains **this cycle**. Prior pending + History for the rest.

---

## 3. Member home (extends Phase 2)

Keep Phase 1–2 cards (Legacy account unlocked, Legacy voucher, Successlines count, monthly + rate, Autoship).

**Upgrade** (hide on Supreme / no higher active package):

- *Pay the difference in products only (Legacy voucher). Your 6 months start again from month 1. Instant goes to your Legacy account.*
- CTA: **Upgrade**

**Reactivate** (only if `canReactivate`):

- *Buy products worth ₦{fullPurchase} again. Full Instant goes to your Legacy account.*
- If `monthlyQualify.isQualified`: *You keep the increased monthly. You do not need 3 new Successlines.*
- If not qualified: *Refer 3 Successlines to raise monthly on this new cycle. You can already cash out.*
- CTA: **Reactivate**

If both apply: *To move up, use Upgrade. To stay on this package, use Reactivate.*

Keep: *Pending still drops when you do Autoship.*  
Link: **View history**

---

## 4. Upgrade picker

Higher active packages only.

Each card:

- VIP → Executive  
- **You pay** ₦140,000 (Legacy voucher)  
- **Instant** ₦60,000 **to your Legacy account**  
- New monthly: show **base** and **increased** for the target package  
- New Autoship  
- *Waiting months keep their old amount. Months not yet due are replaced. If you already have 3 Successlines, new months use the increased Executive rate.*

CTA → `upgrade/start` → shop `UPGRADE`.

Supreme: *You are on the highest package. Reactivate when your 6 months are complete.*

---

## 5. Reactivate confirm

If `!canReactivate`: redirect home.

Else: full pay + full Instant **to Legacy account**. Qualify copy as on the home card.

CTA → `reactivate/start` → shop `REACTIVATE`.

---

## 6. Shop / checkout by `shopMode`

| `shopMode` | Chip | Floor | Pay |
|---|---|---|---|
| `JOIN` | Package | Join amount | `LEGACY_VOUCHER` |
| `AUTOSHIP` | Autoship | None | `LEGACY_VOUCHER` |
| `UPGRADE` | Upgrade · difference | ≥ difference | `LEGACY_VOUCHER` |
| `REACTIVATE` | Reactivate · full pack | ≥ full purchase | `LEGACY_VOUCHER` |

Optional: *This basket can also release {n} waiting month(s).*

Success:

- Upgrade: *Welcome to Executive. ₦60,000 Instant is in your Legacy account. Your 6 months start today.*
- Reactivate: *Your cycle has started again. Instant is in your Legacy account.* + keep-increased line if qualified.
- If pending dropped: mention Legacy account.

**Cancel upgrade / reactivate** restores Autoship shop.

---

## 7. History

Newest first: Joined / Upgraded / Reactivated / Joined (admin seed). Amounts + Instant. No emails.

---

## 8. Months screen

*This cycle, from {cycleStartedAt}.* Link to History.

After upgrade/reactivate: new 6 slots. Callout **Waiting from previous cycle** (amount, old package, rate chip).

---

## 9. Copy bank

- **Pay the difference only**
- **Your 6 months start again from month 1**
- **Instant goes to your Legacy account**
- **You keep the increased monthly**
- **Waiting months are not cancelled**
- **Pay with your Legacy product voucher**

**Retired:** Instant to normal Cashout · lock until 3 · you need 3 to cash out after reactivate.

---

## 10. Admin

Members: package, cycle start, last event, `monthlyQualifiedAt`. No locked filter.

Detail: timeline, this-cycle periods (rate tier), prior pending, sponsor (read-only).

Packages: difference preview + base/increased for each tier.

No force upgrade without products.

---

## 11. What not to build

- Downgrade · edit sponsor · reactivate before 6 dues · upgrade+reactivate in one cart · cashout lock · matrix
