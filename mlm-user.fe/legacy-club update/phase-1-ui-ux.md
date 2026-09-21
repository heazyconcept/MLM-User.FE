# Legacy Club — Phase 1 UI/UX

**Status:** Ready for implementation  
**Date:** 2026-09-18  
**Updated:** 2026-09-18 — Instant + bonuses in Legacy account; no cashout lock; auto-sponsor; Legacy voucher  
**Apps:** `mlm-user.fe` (member) and admin panel  
**Context:** [phase-1-context.md](./phase-1-context.md)

This document is the screen contract. Copy, layout, empty states, and what must never appear. API shapes are in [phase-1-frontend-integration.md](./phase-1-frontend-integration.md).

---

## 1. Design principles

- Treat Legacy Club as its **own home**, not a tab inside the matrix or the normal shop.
- Use the flyer language: **VIP / Executive / Supreme**, **Instant Membership Commission**, **Successline**, **Legacy account** (on-screen you may still say **Legacy Cashout** for the withdrawable wallet).
- Do **not** tell people they must refer 3 before they can cash out. That rule was withdrawn.
- Do not show matrix levels, downline trees, or “My DRs” from the network on these screens.
- Do not mention Monthly increase, Autoship, Upgrade, or Reactivate as working actions in Phase 1. A short “coming in your 6-month cycle” note on the package cards is enough.
- Amounts follow the logged-in member’s registration currency (₦ or $). Backend already converted.

Tone: warm, clear, short. Same voice as the flyer: *Buy Products. Build Your Successline. Earn Your Legacy.*

---

## 2. Navigation

### Member app

Add a top-level menu item:

**Label:** Legacy Club  
**Icon:** crown or leaf (match existing menu weight; do not bury under Shop or Team)  
**Visible when:** `isRegistrationPaid === true`  
**Hidden when:** registration not paid — do not tease unpaid users.

No `2/3` lock badge. Optional: Successline count as a quiet chip on the member home only.

Network **Shop** menu stays the network marketplace. Legacy shopping is **only** under Legacy Club.

### Admin app

Add a **Legacy Club** module (sidebar), behind RBAC:

- Packages (config)
- Members
- Seed enroll

---

## 3. Member routes

Suggested routes (Angular):

| Route | Screen | Who |
|---|---|---|
| `/legacy` | Home (not joined vs joined) | Paid member |
| `/legacy/packages` | Package picker | Not yet a Legacy member |
| `/legacy/join` | Sponsor (auto or username) + confirm package | Not yet a Legacy member |
| `/legacy/voucher` | Legacy product voucher (balance, fund) | Join in progress or member |
| `/legacy/shop` | Legacy marketplace | Join in progress **or** already a member (browse closed after join in Phase 1) |
| `/legacy/cart` | Legacy cart | Join in progress |
| `/legacy/checkout` | Checkout (pickup / delivery) | Join in progress |
| `/legacy/success` | Join paid | Just joined |
| `/legacy/successlines` | Direct Successlines | Legacy member |
| `/legacy/cashout` | Legacy account / cashout | Legacy member |

Normal shop routes (`/shop`, `/cart`, …) stay untouched. Switching menus must not mix carts or voucher columns.

---

## 4. Screen-by-screen — member

### 4.1 Home — not yet a member (`GET /legacy/me` → `status: NONE`)

Hero:

- Title: **Segulah Global Legacy Club**
- Line: **Buy Products · Build Your Successline · Earn Your Legacy**
- Body (short): You must already be a Segulah Global member. Choose a package, pick products of your choice, and start your 6-month legacy.

If `sponsorResolution === AUTO`: extra line — *You will join under @{username} (your Segulah sponsor is already in Legacy Club).*

If `MANUAL`: extra line — *Your Segulah sponsor is not in Legacy Club yet. You will need a Legacy Club username. You may want to ask them to join first.*

Three package cards:

| Card | Show |
|---|---|
| Crown + name | VIP / Executive / Supreme |
| Product purchase | ₦60,000 / ₦200,000 / ₦500,000 |
| Instant | Instant Membership Commission — **into your Legacy account** |
| Monthly (grey) | Monthly amount × 6 — **Starts after you join** |
| Successline % | 10% / 20% / 30% of your directs’ Instant (Phase 1) |
| 6-month total | ₦200,000 / ₦800,000 / ₦1,700,000 |
| T&C chips | You can cash out your Legacy account at any time · Autoship for monthly (coming) |

Do **not** chip “Refer 3 to cash out”.

Primary CTA: **Join as VIP** (etc.) → `/legacy/join?package=VIP`

Footer: *USD members: ₦1,000 = $1, same as the network.*

If `PENDING_JOIN`: banner **Finish your Legacy join** with remaining amount and **Continue shopping**.

---

### 4.2 Join — sponsor + package (`/legacy/join`)

1. Package summary (read-only; change link back to packages).

2. **Who is registering you?** — two layouts from `GET /legacy/me` (or `GET /legacy/join-preview`) **before** they submit:

**A. Automatic** (`sponsorResolution === AUTO`)

- Read-only: *You will join under @{username}.*
- Helper: *This is your Segulah sponsor. They are already in Legacy Club, so you are placed under them automatically.*
- No username field. No “choose someone else”.

**B. Username required** (`sponsorResolution === MANUAL`)

- Field: Legacy sponsor **username**.
- Helper: *Your Segulah sponsor is not in Legacy Club. Enter the username of a member who is. You may call your sponsor and ask them to join first so you stay under them.*
- Validate on blur / Continue: `POST /legacy/sponsors/validate`.

| API | Message on screen |
|---|---|
| Sponsor not found | We could not find that username. |
| Sponsor not in Legacy Club | That member has not joined Legacy Club yet. |
| Self | You cannot register yourself. |
| Already a member | You are already in Legacy Club. |
| `SPONSOR_MUST_BE_AUTO` | Should not happen in UI — hide the field |

3. Continue → `POST /legacy/join/start`  
   - AUTO: omit `sponsorUsername` (or send it matching the auto sponsor).  
   - MANUAL: require `sponsorUsername`.  
   → `/legacy/shop`.

Do not start Legacy shopping without a stored join intent (package + resolved sponsor).

---

### 4.3 Legacy marketplace (`/legacy/shop`)

Visually distinct from the network shop:

- Header: **Legacy Club marketplace** + package chip (e.g. *VIP · ₦60,000*)
- Sticky bar: **Cart ₦45,000 of ₦60,000** with a progress bar. Green when `>=` required.
- Same product cards as the network catalogue (name, image, member price, PV).
- Add to cart uses the **Legacy cart**, never the network cart.
- If they open `/shop` in another tab, that cart must stay network-only.

Empty catalogue: *No products available. Please try again later.*

Do not show merchant-only products.

---

### 4.4 Legacy cart (`/legacy/cart`)

- Line items, qty, remove — same patterns as network cart.
- Subtotal vs **Required for [package]**.
- If subtotal `<` required: disable **Checkout**, message: *Add products worth at least ₦XX more to join as VIP.*
- If subtotal `>=` required: **Checkout** enabled. Note: *You can add more than the package amount. Extra products still earn PV.*
- Clear cart does not cancel the join intent; they can shop again.

---

### 4.5 Checkout (`/legacy/checkout`)

Reuse the **existing** pickup / delivery checkout (country, subdivision, merchant, address, disclaimer).

Differences:

- Title: **Legacy Club checkout**
- Summary: package, sponsor username + *Automatic* or *You chose this username*, Instant they will receive **in the Legacy account**.
- Pay with **Legacy product voucher** only — never the network Product Voucher.  
  If short: *Fund your Legacy product voucher, then return here.* Link `/legacy/voucher`. Do not send them to the network voucher screen as the pay source.
- Paying must call Legacy checkout + `walletType: LEGACY_VOUCHER`.

On pay success → `/legacy/success`.

---

### 4.6 Legacy voucher (`/legacy/voucher`)

- Title: **Legacy product voucher**
- Line: *This is not your network Product Voucher. It is only for the Legacy Club marketplace.*
- Balance, fund CTA (transfer from CASH / existing funding pattern with this wallet type).
- Do not show network voucher balance on this page (optional small link: *Network voucher is under Wallet*).

---

### 4.7 Join success (`/legacy/success`)

- Checkmark: **Welcome to Legacy Club**
- Package name
- **Instant Membership Commission ₦XX is in your Legacy account. You can cash it out now.**
- Primary: **Go to Legacy Club**
- Secondary: **Open Legacy account** → `/legacy/cashout`

---

### 4.8 Home — already a member (`status: ACTIVE`)

Header:

- Package badge (VIP / Executive / Supreme)
- Joined date
- Sponsor: *Registered by @username* + chip **Automatic** or **Chosen**

Cards:

1. **Legacy account**  
   Balance (Instant + any Successline bonuses received).  
   *You can cash out or move this money at any time.*  
   CTA: **Open Legacy account**

2. **Legacy product voucher**  
   Balance. CTA: **Fund voucher**

3. **My Successlines**  
   Count only (e.g. `2`). No lock / unlock. Optional quiet note: *3 Successlines will raise your monthly commission later.*  
   CTA: **View Successlines**  
   Secondary: **Register someone** → §4.11

Do **not** show monthly countdown, Autoship tracker, Upgrade, Reactivate, or a locked padlock.

---

### 4.9 Successlines (`/legacy/successlines`)

Title: **My Direct Successlines**  
Subtitle: *Level 1 only. These are people placed under you in Legacy Club (automatic or by username).*

| Column | Show |
|---|---|
| Username | Required |
| Package | VIP / Executive / Supreme |
| Joined | Date |
| How | Automatic / Chosen — optional |

Do **not** show email, phone, real name, matrix position, or “view their team”.

Empty: *You have not registered anyone yet.*  
Do **not** say they cannot cash out.

Search: username only.

---

### 4.10 Legacy account (`/legacy/cashout`)

Balance (large). Always treat as **unlocked** in Phase 1 (`canCashoutLegacy === true` whenever the wallet exists).

- **Cash out** → withdrawal UI, source Legacy account (PIN, amount, admin approval — same as CASH).
- **Move to another wallet** → own CASH, network Product Voucher, Autoship, or Legacy product voucher. PIN required. Not send-to-member.

History: *Instant Membership Commission (VIP)*; *Successline bonus — Instant from @bode*.

No locked state. Do not implement `LEGACY_CASHOUT_LOCKED` in the UI.

---

### 4.11 Register someone else

From member home: **Register a Successline**.

1. *If you are their Segulah sponsor and you are in Legacy Club, they will join under you automatically — they will not type a username.*
2. *If you are not their Segulah sponsor, or you join after they do, they will need your username only when their own sponsor is not in Legacy Club.*
3. Show **your username** large, copy button.
4. Optional lookup: `GET /legacy/members/lookup?username=` → *Ready to join* / *Already in Legacy Club* / *Not a Segulah member*.
5. They still complete join on their own login. You cannot pay their pack from this screen.

---

## 5. States and errors (member)

| State | UI |
|---|---|
| Registration not paid | Menu hidden |
| Paid, not in Legacy | Marketing + packages + auto/manual sponsor hint |
| Join pending, unpaid | Resume banner |
| Legacy voucher short | Checkout error + link to `/legacy/voucher` |
| Join pay failed | Stay on checkout |
| Already ACTIVE | Member home |
| Impersonation | Read-only: hide pay, cash out, transfer |
| 401 | Existing login redirect |

Do not leak network-shop cart or network-voucher errors on Legacy screens.

---

## 6. Admin UI

### 6.1 Packages (`/admin/legacy/packages`)

Super Admin (`legacy.configure_packages`) can edit:

- Product purchase (NGN) — USD preview = NGN ÷ 1,000
- Instant commission (NGN)
- Monthly commission (NGN) — *Used from Phase 2*
- Successline bonus %
- Autoship amount (NGN) — *Used from Phase 2*
- Cycle months (default 6)
- Min Successlines to **raise monthly** (default 3) — *Used from Phase 2. Does not lock cashout.*
- Active flag

Save confirm: *Members who already joined keep their current package until they upgrade (Phase 3). New joins use these figures.*

### 6.2 Members (`/admin/legacy/members`)

Filters: package, username, placement (automatic / chosen). **No** locked/unlocked.

Columns: username, Segulah package, Legacy package, sponsor username, placement, Successline count, Legacy account balance, Legacy voucher balance, joined at.

Row → detail: both Legacy wallets, join order id, Instant reference, Successline list.

### 6.3 Seed enroll (`/admin/legacy/enroll`)

- User username (paid Segulah, not already Legacy)
- Package
- Sponsor username (optional for the **first** seed only; if omitted and they have a Segulah sponsor in Legacy, use auto)
- Checkbox: **Waive product purchase** (seed only)

Confirm: *Seed enroll creates Legacy membership without a marketplace order. Use only to start the tree.*

Permission: `legacy.enroll_seed`.

---

## 7. Copy bank (member)

- Menu: **Legacy Club**
- Instant: **Instant Membership Commission**
- Wallet: **Legacy account** / **Legacy Cashout** (withdrawable)
- Voucher: **Legacy product voucher** (never just “Product Voucher” on these screens)
- People: **Direct Successlines**
- Auto: **You will join under @{username} automatically**
- Manual: **Your Segulah sponsor is not in Legacy Club. Enter a username, or ask them to join first.**
- Cashout: **You can cash out your Legacy account at any time**
- Shop header: **Legacy Club marketplace**
- T&C: *Monthly commission and Autoship start after you join (6-month cycle).*

**Retired copy (do not use):** *Refer 3 direct Successlines to use your Legacy Cashout.*

---

## 8. What not to build in Phase 1 UI

- Monthly due / pending / **increased monthly** tracker
- Autoship progress
- Upgrade / Reactivate
- Matrix / level 2–13
- Email, phone, or profile of Successlines
- Mixing Legacy cart into the network cart badge
- Mixing Legacy voucher into the network voucher widget
- Lock / unlock Legacy cashout
- Instant shown as hitting normal CASH
- Opening Legacy marketplace from the network Shop menu
