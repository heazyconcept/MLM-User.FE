# Legacy Club — Phase 2 UI/UX

**Status:** Ready for implementation  
**Date:** 2026-09-18  
**Updated:** 2026-09-18 — Legacy account / voucher; monthly raise after 3; no cashout lock  
**Apps:** `mlm-user.fe` (member) and admin panel  
**Context:** [phase-2-context.md](./phase-2-context.md)  
**Phase 1 screens:** [phase-1-ui-ux.md](./phase-1-ui-ux.md) — still apply; this doc only adds or changes what Phase 2 needs.

---

## 1. What changes for the member

Phase 1 home stayed quiet on monthly. Phase 2 adds:

- A **this month** card (due date, pending, **base or increased** amount)
- **Do Autoship** → Legacy marketplace (shop open again; pay **Legacy voucher**)
- A **6-month** list (due / waiting / paid + rate chip)
- Copy that pending **waits**, it does not vanish
- Copy that **3 Successlines raise future monthly** — not a cashout lock

Do not add Upgrade or Reactivate.

Language: **Monthly Membership Commission**, **pending**, **Autoship**, **Legacy account**. Never call Autoship “the Autoship wallet”. Never say they must refer 3 to cash out.

---

## 2. Navigation

Same **Legacy Club** menu as Phase 1.

| Route | Screen | Who |
|---|---|---|
| `/legacy` | Home — monthly + Autoship + qualify hint | ACTIVE |
| `/legacy/months` | Six-month cycle | ACTIVE |
| `/legacy/shop` | Join **or** Autoship | PENDING_JOIN or ACTIVE |
| `/legacy/cart` | Legacy cart | same |
| `/legacy/checkout` | Checkout — **Legacy voucher** | same |
| `/legacy/voucher` | Phase 1 screen — used before Autoship pay | same |

Menu badge (optional): dot if `pendingCount > 0`. Do **not** show `2/3` as a lock.

---

## 3. Member home — ACTIVE (extends Phase 1)

Keep Phase 1 cards: Legacy account (unlocked), Legacy voucher, Successlines (count only).

**Add — Monthly commission**

- Title: **Monthly Membership Commission**
- If pending: **₦XX pending** + chip **Base** or **Increased**  
  Helper: *This waits until you complete Autoship. It will not cancel.*
- If nothing pending, next due in future: **Next month ₦XX on {date}** + **Base** / **Increased**
- If all 6 dropped: **6 of 6 months paid into your Legacy account**
- If `directSuccesslineCount < 3`: *Refer {n} more Successlines to raise your next monthly. You can already cash out.*
- If already 3: *Your next monthly uses the increased amount.*
- CTA: **View 6-month cycle**

**Add — Autoship**

- *Buy products of your choice from the Legacy marketplace, worth at least ₦{autoshipAmount}. Pay with your Legacy product voucher.*
- Need Autoship: CTA **Shop Autoship**
- Caught up: *You are up to date. Shop again after {nextDueAt}.* Extra shop = PV only.
- *This is not the Segulah Autoship wallet or the network Product Voucher.*

**Cycle complete:** *Your 6-month cycle is complete. Pending still drops when you do Autoship.*  
If they have 3: *When you reactivate, you keep the increased monthly.* No button.

---

## 4. Six-month cycle (`/legacy/months`)

Title: **Your 6-month cycle**  
Subtitle: *From {cycleStartedAt}. Each month is 30 days.*

| Month | Due | Amount | Rate | Status |
|---|---|---|---|---|
| 1 | 18 Oct 2026 | ₦… | Base / Increased | Waiting for Autoship / In Legacy account / Not due yet |

Chips: `SCHEDULED` grey · `PENDING` amber · `DROPPED` green.

Footer: pending total + **Do Autoship**.

Day 0–29: *Your first monthly is due on {month1DueAt}. Instant is already in your Legacy account.*

If they have 3: banner *Future months use the increased commission. Months already waiting keep their amount.*

---

## 5. Legacy shop when ACTIVE

Header: **Legacy Club marketplace** + **Autoship · ₦10,000**.

Sticky bar:

- `pendingCount > 0`: **Cart ₦X of ₦Y Autoship** · *This checkout can release {units} waiting month(s).*
- `pendingCount === 0`: *Autoship not required right now. You can still buy (PV only). Early Autoship does not keep a credit.*

PENDING_JOIN still uses Phase 1 join minimum.

---

## 6. Cart & checkout when ACTIVE

- No join-pack floor. Checkout allowed below Autoship (PV only) with a warning if something is pending.
- Summary: *Autoship — no Instant Commission. Pay with Legacy product voucher.*
- Pay: `{ "walletType": "LEGACY_VOUCHER" }` only. Short → `/legacy/voucher`.
- Success: *Autoship received.* If months dropped: *₦XX is now in your Legacy account. You can cash it out.* If PV only: *No monthly dropped. PV added.*

Title: **Legacy Autoship**.

---

## 7. Join success (Phase 1 add)

*Your first monthly is due in 30 days. You will need Autoship of ₦{amount} (Legacy voucher) for it to enter your Legacy account. Refer 3 Successlines to raise later monthlies — you can cash out Instant now.*

---

## 8. Legacy account history

New rows:

- *Monthly Membership Commission — month 2 (base)* / *(increased)*
- *Legacy Successline bonus — Monthly from @bode (month 2)*

Pending must **not** appear as a credit.

---

## 9. Copy bank

- Pending: **Waiting for Autoship**
- Dropped: **In your Legacy account**
- Rate: **Base** / **Increased**
- Qualify: **3 Successlines raise your next monthly. They do not lock cashout.**
- CTA: **Do Autoship** / **Shop Autoship**
- *Monthly does not cancel if you are late.*
- *Pay with Legacy product voucher, not the network voucher.*

**Retired:** *Still locked until 3 Successlines.*

---

## 10. Admin UI

### Members

Columns: month `2/6`, pending amount, rate (base/increased for next due), last Autoship, Successline count. No locked/unlocked.

### Member detail

- `monthlyQualifiedAt`  
- 6 periods: amount, **BASE/INCREASED**, status, due, dropped, order  
- Ledger links  

No force-drop in Phase 2.

### Packages

Live fields:

- **Base monthly** (before 3) — required for production  
- **Increased monthly** (flyer; after 3)  
- Autoship  
- Min directs to raise monthly (default 3)

Confirm: *Waiting months keep the amount they already have. Only months not yet due use new figures.*

---

## 11. What not to build in Phase 2 UI

- Upgrade / Reactivate buttons  
- Cashout lock  
- Pending mixed into withdrawable balance  
- Autoship or Legacy shop from the **network** menu  
- Network voucher as Autoship pay source  
- Matrix / extra Successline fields
