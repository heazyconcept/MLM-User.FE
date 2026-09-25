# Legacy Club — Admin remaining work

**Date:** 2026-09-21 (updated 2026-09-25)  
**From:** Member app (`mlm-user.fe`)  
**Audience:** Admin panel + anyone who owns seed / package config  
**Canonical specs:** this folder’s `phase-*-backend.md`, `phase-*-ui-ux.md`, `phase-*-frontend-integration.md`

> **New (2026-09-25):** [ADMIN_CANCEL_PENDING_JOIN.md](./ADMIN_CANCEL_PENDING_JOIN.md) — admin cancels `PENDING_JOIN` registration; member notification + FE contract.

---

## 1. Why this doc exists

The **member app** has implemented Phases 1–3 against the live `/legacy/*` APIs (join, Legacy cart + `LEGACY_VOUCHER` pay, cashout, months/Autoship, upgrade/reactivate/history).

Member QA is **blocked** until at least one **ACTIVE** Legacy member exists. Almost all new paid testers see `sponsorResolution: MANUAL` and must enter a Legacy sponsor username — with an empty tree, validate always fails.

**Admin seed enroll is the intended bootstrap.** Member FE cannot invent the first sponsor.

---

## 2. What the member app already ships (do not rebuild in admin)

| Area | Member routes / behaviour |
|---|---|
| Feature gate | Side menu from paid + `GET /legacy/me` |
| Packages / join | `/legacy`, `/legacy/packages`, `/legacy/join` (AUTO vs MANUAL) |
| Marketplace | `/legacy/shop`, cart, checkout — `channel=LEGACY`, pay `LEGACY_VOUCHER` only |
| Voucher | `/legacy/voucher` — CASH → Legacy voucher |
| Instant + cashout | Instant → Legacy account; `/legacy/cashout` withdraw/transfer; **no** Successline lock |
| Successlines | `/legacy/successlines` |
| Phase 2 | Monthly card, `/legacy/months`, Autoship shop when `shopMode === AUTOSHIP` |
| Phase 3 | `/legacy/upgrade`, `/legacy/reactivate`, `/legacy/history` |
| Isolation | Network Marketplace / network voucher / PPPC unchanged |

Mocks are **off** in development and production (`useLegacyClubMocks: false`).

---

## 3. Blocker for member QA (build first)

### Seed enroll — **P0**

| Item | Detail |
|---|---|
| Screen | Admin → Legacy Club → **Seed enroll** (e.g. `/admin/legacy/enroll`) |
| API | `POST /admin/legacy/enroll` |
| Permission | `legacy.enroll_seed` |
| Purpose | Create the **first** ACTIVE Legacy members without a marketplace order |

**Form fields (from Phase 1 UI):**

- Target user username (paid Segulah, not already Legacy)
- Package (`VIP` / `EXECUTIVE` / `SUPREME`)
- Sponsor username — **optional for the first seed only**; if omitted and user has AUTO Segulah-in-Legacy sponsor, use AUTO; first tree root may be **null sponsor**
- Checkbox: **Waive product purchase** (seed only)

**Confirm copy:** *Seed enroll creates Legacy membership without a marketplace order. Use only to start the tree.*

**On success backend must:**

- Membership `ACTIVE`
- Create `LEGACY_CASHOUT` + `LEGACY_VOUCHER` wallets
- Credit Instant to **Legacy account** (not CASH)
- Sponsor Successline bonus if a sponsor was set
- No order / no PV when waived
- Audit admin user id
- History kind `SEED` (Phase 3 history)

Without this, MANUAL join in the member app cannot progress.

---

## 4. Admin module to build (sidebar)

Add a **Legacy Club** section behind RBAC (all granted to Super Admin):

| Permission key | Label |
|---|---|
| `legacy.view_members` | View Legacy members |
| `legacy.configure_packages` | Configure Legacy packages |
| `legacy.enroll_seed` | Seed enroll Legacy member |
| `legacy.view_wallets` | View Legacy wallets |

No extra RBAC keys in Phase 2/3.

---

## 5. Screens & APIs by phase

### 5.1 Phase 1 — required

#### Packages — `/admin/legacy/packages`

| | |
|---|---|
| APIs | `GET /admin/legacy/packages`, `PUT /admin/legacy/packages` (or per-package PUT as backend ships) |
| Permission | `legacy.configure_packages` |

**Editable fields (NGN; show USD preview = NGN ÷ 1,000):**

- Product purchase  
- Instant commission  
- Monthly commission (Phase 1 may still show one field; Phase 2 splits base/increased — see §5.2)  
- Successline bonus %  
- Autoship amount (used from Phase 2)  
- Cycle months (default 6)  
- **Min Successlines to raise monthly** (default 3) — label: *Raises monthly in Phase 2. Does **not** lock cashout.*  
- Active flag  

**Save confirm:** *Members who already joined keep their current package until they upgrade (Phase 3). New joins use these figures.*

#### Members list — `/admin/legacy/members`

| | |
|---|---|
| API | `GET /admin/legacy/members?page&limit&search=&package=&sponsorSource=` |
| Permission | `legacy.view_members` |

**Filters:** package, username, placement (`AUTO` / `CHOSEN` / seed). **No** locked/unlocked filter.

**Columns:** username, Segulah package, Legacy package, sponsor username, placement, Successline count, Legacy account balance, Legacy voucher balance, joined at.

#### Member detail — `/admin/legacy/members/:userId`

| | |
|---|---|
| API | `GET /admin/legacy/members/:userId` |
| Permission | `legacy.view_members` (+ `legacy.view_wallets` for balances) |

**Show:** both Legacy wallets, join order id, Instant reference, Successline list.

#### Seed enroll

See §3.

---

### 5.2 Phase 2 — extend packages + member detail

**Packages (live fields):**

- **Base monthly** (before 3 Successlines) — **required before production** (flyer figures are the *increased* rate; Super Admin must set base)  
- **Increased monthly** (flyer)  
- Autoship  
- Min directs to raise monthly (default 3)  

**Confirm:** *Waiting months keep the amount they already have. Only months not yet due use new figures.*

**Members list extras:** month progress e.g. `2/6`, pending amount, next-due rate (base/increased), last Autoship, Successline count.

**Member detail extras:**

- `monthlyQualifiedAt`  
- 6 periods: amount, **BASE / INCREASED**, status, due, dropped, order  
- Ledger links  

**Do not build:** force-drop of pending months in Phase 2.

---

### 5.3 Phase 3 — timeline + package helpers

**Members list:** package, cycle start, last event, `monthlyQualifiedAt`. Still no locked filter.

**Member detail:**

- Event timeline (`JOIN` / `UPGRADE` / `REACTIVATE` / `SEED`)  
- This-cycle periods with rate tier  
- Prior pending (from previous cycle)  
- Sponsor read-only  

**Packages:** upgrade **difference preview** + base/increased per tier.

**Do not build:** force upgrade/reactivate without products; downgrade; edit sponsor; waive upgrade/reactivate purchase.

---

## 6. Suggested admin build order

1. **RBAC** keys + Super Admin grants  
2. **Seed enroll** (unblocks member QA)  
3. **Packages** list/edit (Phase 1 fields → then base/increased for Phase 2)  
4. **Members** list + detail (Phase 1 → Phase 2 periods → Phase 3 timeline)  
5. Production checklist: set **base monthly** per package before go-live  

---

## 7. Explicitly out of scope for admin (per docs)

- Member marketplace, cart, Legacy voucher fund UI, member cashout UI  
- Cashout lock UI / “refer 3 to unlock”  
- Force-drop pending / force upgrade without products  
- Mixing network Product Voucher or network Autoship wallet into Legacy config labels as the same thing  
- Changing network Marketplace / PPPC behaviour  

---

## 8. Handoff note for leadership

| Layer | Status |
|---|---|
| Member FE Phases 1–3 | Built against live APIs |
| Backend `/legacy/*` (member) | Assumed shipped (member app cut over) |
| Admin UI + seed enroll | **Remaining** — required to start the tree and configure base monthly |

**Ask for seed:** enroll at least one paid Segulah user as ACTIVE Legacy (waive purchase OK) so other testers can join under that username (MANUAL) or get AUTO once their Segulah upline is in Legacy.

---

## 9. Spec pointers

| Topic | Doc |
|---|---|
| Seed + packages + members UI | [phase-1-ui-ux.md](./phase-1-ui-ux.md) §6 |
| Admin APIs + RBAC + seed rules | [phase-1-backend.md](./phase-1-backend.md) §10–11 |
| Admin FE contract | [phase-1-frontend-integration.md](./phase-1-frontend-integration.md) §9 |
| Base vs increased monthly | [phase-2-context.md](./phase-2-context.md), [phase-2-ui-ux.md](./phase-2-ui-ux.md) §10 |
| Phase 2 admin | [phase-2-frontend-integration.md](./phase-2-frontend-integration.md) §6 |
| Phase 3 admin | [phase-3-ui-ux.md](./phase-3-ui-ux.md) §10, [phase-3-frontend-integration.md](./phase-3-frontend-integration.md) §9 |
