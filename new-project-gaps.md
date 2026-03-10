# Business Requirements vs Current Implementation — Gap Analysis

> **Source:** `project.md` — Segulah Global Premium Solutions Ltd Compensation Plan  
> **Date:** 2026-02-21

---

## Legend

| Symbol | Meaning |
|--------|---------|
| ✅ | Implemented and functional |
| ⚠️ | Partially implemented or UI exists but data is hardcoded/missing |
| ❌ | Not implemented at all |

---

## 1. Registration Packages

| Requirement | Status | Notes |
|------------|--------|-------|
| 6 packages: Nickel, Silver, Gold, Platinum, Ruby, Diamond | ✅ | Registration payment page exists with package selection |
| Package amounts + admin fee (not distributed) | ✅ | `payment.service.ts` handles initiation |
| Instant Product Voucher (60% of registration) | ⚠️ | Voucher wallet exists, but no UI shows *how much* voucher was credited at registration |
| Instant Registration PV (2–1,000 PV per package) | ⚠️ | Backend assigns PV. No UI displays registration PV received |
| Community Registration PV (0.4–200 PV per package) | ⚠️ | Mapped in CPV transaction, but frontend doesn't distinguish personal vs community PV |
| Package upgrade | ✅ | Upgrade page at `settings/upgrade` with package cards, confirmation dialog, and Paystack redirect |

---

## 2. The 17 Earning Gateways

### Registration & Daily Allocations

| # | Earning Type | Status | Notes |
|---|-------------|--------|-------|
| 1 | **PDPA** — Personal Daily Proceeds Allocation | ❌ | Zero references in frontend code. No display of daily PDPA rate or accumulated PDPA earnings. |
| 2 | **CDPA** — Community Daily Proceeds Allocation | ❌ | Zero references in frontend code. No UI for CDPA. |

### Referral Commissions

| # | Earning Type | Status | Notes |
|---|-------------|--------|-------|
| 3 | Direct Referral Bonus | ✅ | Displayed in commission breakdown; `normalizeEarningType` handles `DIRECT_REFERRAL` |
| 4 | Community Referral Bonus (13 levels, 24%) | ⚠️ | Type `Community Bonus` exists in normalizer, but no UI shows level-by-level breakdown (which level each bonus came from) |

### Product Purchase Commissions

| # | Earning Type | Status | Notes |
|---|-------------|--------|-------|
| 5 | Personal Product Purchase Commission (PPPC) | ❌ | No earning type references PPPC. Product purchase exists but commission from own purchases isn't tracked in UI |
| 6 | Direct Referral Product Purchase Commission (DRPPC) | ❌ | Not referenced. No UI shows commission earned from direct referrals' product purchases |
| 7 | Community Product Purchase Commission (CPPC) | ❌ | Not referenced. No UI shows community product purchase commissions |
| 8 | Repeat Product Purchase Bonus | ❌ | Not referenced anywhere. No concept of repeat purchase tracking |

### Matching & Ranking

| # | Earning Type | Status | Notes |
|---|-------------|--------|-------|
| 9 | Matching Bonus | ⚠️ | Type exists in normalizer (`MATCHING`). Requirement: "member must refer 3 accounts within same/higher package" — this qualification logic is **not** shown to users |
| 10 | Ranking Bonus (Stage Completion) | ⚠️ | Ranking page exists; shows progress. But ranking bonus amount and whether it's been earned/paid is not shown |

### CPV & Milestones

| # | Earning Type | Status | Notes |
|---|-------------|--------|-------|
| 11 | CPV Cash Bonus | ⚠️ | Field exists in DTO but API returns 0 and milestone data is empty |
| 12 | CPV Milestone Incentives | ⚠️ | UI template exists with empty state. API doesn't return the 12 milestone tiers defined in project.md |

### Merchant Commissions

| # | Earning Type | Status | Notes |
|---|-------------|--------|-------|
| 13 | Merchant Personal Product Purchase Bonus | ⚠️ | `merchant-earnings.component.ts` exists but commission types are not granular |
| 14 | Merchant Direct Referral Product Purchase Bonus | ❌ | Not broken out separately |
| 15 | Merchant Community Product Purchase Bonus | ❌ | Not broken out separately |
| 16 | Merchant Product Delivery Bonus | ⚠️ | Merchant deliveries page exists. Delivery commission display unclear |

> **Note:** Project mentions 17 gateways but only lists 16 above. Gateway #17 is likely **Leadership Bonus** (referenced in `normalizeEarningType` but not in the project doc numbering).

---

## 3. 3×1 / 3×2 Team Forced Matrix

| Requirement | Status | Notes |
|------------|--------|-------|
| Matrix tree visualization | ✅ | `matrix-tree.component.ts` exists |
| 13 levels, 6 stages | ⚠️ | Ranking page shows stages/levels, but doesn't display the full level commission table (percentages per level per package) |
| "Follow Your Leader" principle | ⚠️ | Logic is backend-only. Frontend doesn't explain the placement algorithm to users |
| Spillover from 4th+ referral | ⚠️ | No UI explains spillover behavior |
| Member refers 3 each, excess go left-to-right | ⚠️ | Matrix tree shows structure but no explanation of this rule |

---

## 4. Level Commission Table

| Requirement | Status | Notes |
|------------|--------|-------|
| Show commission % per level (1–13) per package | ❌ | No page displays the level commission table from project.md. Users cannot see what % they earn at each level |
| Stage names (Stakeholder → Mentor → Manager → Director → Consultant) | ⚠️ | Ranking page shows current rank, but doesn't display the full rank progression table |
| Ranking bonuses per stage completion | ❌ | Stage completion bonus amounts ($1 to $4M+) not shown |

---

## 5. CPV Milestone Awards

The project defines **12 milestone tiers**:

| CPV Threshold | Cash Award | Material Award | Implemented? |
|--------------|-----------|----------------|:---:|
| 40 CPVs | $2 | None | ❌ |
| 100 CPVs | $6 | None | ❌ |
| 1,000 CPVs | $70 | None | ❌ |
| 5,000 CPVs | $100 | Washing Machine ($300) | ❌ |
| 20,000 CPVs | $300 | LED Smart TV ($1,000) | ❌ |
| 50,000 CPVs | $500 | Car ($5,000) | ❌ |
| 120,000 CPVs | $1,000 | Car ($12,000) | ❌ |
| 500,000 CPVs | $5,000 | Car ($50,000) | ❌ |
| 1,000,000 CPVs | $20,000 | Landed Property ($100,000) | ❌ |
| 5,000,000 CPVs | $50,000 | Duplex ($600,000) | ❌ |
| 10,000,000 CPVs | $100,000 | Mini Estate ($1,200,000) | ❌ |

> **API Gap:** `GET /earnings/cpv` returns no milestones array. Frontend has the UI template ready but needs backend data. These can be hardcoded in frontend as a reference table since they are static business rules.

---

## 6. Cashout / Autoship Split

| Requirement | Status | Notes |
|------------|--------|-------|
| Earnings split: Cash (62–70%) + Autoship Voucher (30–38%) | ❌ | No UI shows the split ratio. Users don't know what % goes to cash vs autoship |
| Split varies by package | ❌ | No package-specific split display |
| Monthly Autoship payment ($10–$50 by package) | ❌ | No autoship subscription management page. No autoship due date, status, or payment history |
| Autoship admin fee | ❌ | Not shown |

---

## 7. Merchant System

| Requirement | Status | Notes |
|------------|--------|-------|
| 3 merchant categories (Regional, National, Global) | ⚠️ | Merchant application page exists. Type selection may be limited |
| Merchant registration fees ($600 / $3K / $10K) | ❌ | Not shown in merchant application flow |
| Merchant product purchase commission (3% / 4.5% / 7.5%) | ❌ | No breakdown by merchant tier |
| Product delivery commission (4% / 6% / 10%) | ❌ | Not shown per merchant tier |
| MDRPPC (Direct Referral Product Purchase) | ❌ | Not tracked separately |
| MCPPC (Community Product Purchase, 1% per level L2–L13) | ❌ | Not tracked separately |
| Merchants earn as account owners + merchants | ⚠️ | Merchant earnings page exists but doesn't show dual-role breakdown |

---

## 8. Currency & Payment

| Requirement | Status | Notes |
|------------|--------|-------|
| Fixed conversion: ₦1,000 = $1 | ⚠️ | `displayCurrency` exists. Conversion logic unclear — may use market rate instead of fixed 1000:1 |
| Dashboard shows in user's selected currency | ✅ | User selects currency at registration. Dashboard shows in that single currency (not dual USD+NGN as project.md originally describes) |
| Fund wallet in local currency, system converts to USD | ⚠️ | Wallet funding exists. Conversion display unclear |
| Admin can fund wallets manually | ✅ | Admin endpoint exists (`POST /admin/payments/fund`) |
| USDT (Crypto) payments | ❌ | No crypto wallet or USDT payment integration exists |
| Currency lock: registrants cash out in their selected currency | ✅ | Currency is set at registration and used throughout |

---

## 9. System Features Mentioned in project.md

| Feature | Status | Notes |
|---------|--------|-------|
| Reporting Systems | ❌ | No dedicated reports page for earnings, team, or period-based reports |
| Product Upload, Purchase & Delivery | ✅ | Products, orders, merchant delivery pages exist |
| Income/Expense/P&L Systems | ❌ | No financial reporting page |
| Super Admin / Sub-Admins | N/A | This is the user dashboard (not admin) |
| CPV Systems | ⚠️ | Basic CPV page, but missing milestone data from backend |
| Monthly Autoship Report | ❌ | No autoship tracking or reports |
| Awards/Milestones | ⚠️ | Template ready, no data |
| Commission System | ⚠️ | Basic commission breakdown exists, but not all 17 gateways are tracked |
| Matrix System | ✅ | Matrix tree component exists |
| Registration & Upgrades | ✅ | Registration works. Upgrade page implemented at `settings/upgrade` |
| User Details / Settings | ✅ | Profile, KYC, bank details, preferences pages exist |

---

## Priority Summary

### 🔴 Critical (Core business logic not visible to users)

1. **PDPA / CDPA earnings** — Two of the 17 gateways are completely invisible
2. **Level commission table** — Users can't see their earning percentages per level
3. **CPV milestone awards table** — 12 tiers defined in business plan, none shown
4. **Cashout/Autoship split** — Users don't know their earnings are being split

### 🟡 Important (Features exist but incomplete)

5. ~~**Package upgrade flow**~~ — ✅ Implemented at `settings/upgrade`
6. **Matching bonus qualification** — Rule (3 direct referrals in same/higher package) not shown
7. **Product purchase commission types** — PPPC, DRPPC, CPPC not tracked separately
8. **Monthly autoship management** — No subscription page
9. **Ranking bonus amounts** — Stage completion bonuses not shown

### 🟢 Nice to Have (Enhancements)

10. **Dual currency display** — handled via user-selected currency at registration
11. **Spillover explanation** in matrix view
12. **Merchant tier-specific commission rates**
13. **USDT/Crypto payment support**
14. **Reporting/P&L systems**
```
