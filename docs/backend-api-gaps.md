# Backend API Gap Analysis for New Project Features

This document outlines the specific missing data, endpoints, and properties required from the backend API to fulfil the business requirements outlined in `new-project-gaps.md`. It evaluates the existing frontend integration points and details what needs to change on the backend.

---

## 1. Registration Packages

### What the backend already provides

- **`GET /users/me`**
  - Returns the authenticated user profile, including:
    - `package`: `'NICKEL' | 'SILVER' | 'GOLD' | 'PLATINUM' | 'RUBY' | 'DIAMOND'`
    - `registrationCurrency`: `'NGN' | 'USD'`
    - `isRegistrationPaid: boolean`
    - plus standard identity/profile fields (e.g. `registration`, `matrix`, `earnings`, `rank`).
  - **Does not** return registration PV or community PV; use `GET /earnings/summary` for those.

- **`GET /wallets`**
  - Returns all of the user’s wallets with balances, e.g.:
    - `wallets: Array<{ id: string; walletType: 'CASH' | 'AUTOSHIP' | 'PRODUCT_VOUCHER' | ...; currency: 'NGN' | 'USD'; balance: number }>`.

- **`GET /earnings/summary`**
  - Returns:
    - `totalEarned`
    - `cashoutEligible`
    - `autoshipBalance`
    - `cashoutPercentage`, `autoshipPercentage`
    - `monthlyAutoshipAmountUsd`
    - `byType: Record<LedgerEarningType, number>`
    - `pdpaEarnings`, `cdpaEarnings`
    - `communityBonusByLevel: { level: number; amount: number; currency: 'NGN' | 'USD' }[]` (levels 1–13).
    - **`instantRegistrationPv`** (number) – registration PV for the user’s package.
    - **`communityRegistrationPv`** (number) – community registration CPV for the user’s package.
    - `productVoucherBalance`, `pppcEarnings`, `drppcEarnings`, `cppcEarnings`, `leadershipBonus`.

### How the frontend should use this

- Use **`GET /users/me`** for profile and package only:
  - Show current `package`, `registrationCurrency`, and `isRegistrationPaid`.
  - **Do not** use `/users/me` for registration PV or community PV; that endpoint does not return them.
- Use **`GET /earnings/summary`** for registration and community PV:
  - **`instantRegistrationPv`** – use for “registration PV” (per package).
  - **`communityRegistrationPv`** – use for “community registration PV” (per package).
- Use **`GET /wallets` + `GET /earnings/summary`** to show:
  - Wallet balances and how much is locked for autoship vs cashout.

---

## 2. The 17 Earning Gateways

### What the backend already provides

- **`GET /earnings`**
  - Returns an array of `Earning` records (Prisma model), including:
    - `id: string`
    - `earningType: LedgerEarningType`
    - `amount: number`
    - `currency: 'NGN' | 'USD'`
    - optional `level: number` (for community referral levels 1–13)
    - optional `stage: number`
    - optional `cpv: number`
    - optional `metadata: Json`
    - `createdAt: Date`

- **`GET /earnings/summary`**
  - Returns:
    - `byType: Record<LedgerEarningType, number>` – totals per earning gateway.
    - `pdpaEarnings`, `cdpaEarnings` – convenience fields for PDPA/CDPA.

- **`GET /earnings/matching-bonus-status`**
  - Returns matching bonus qualification + amounts (shape defined in `EarningsService.getMatchingBonusStatus`).

### Canonical earning types (LedgerEarningType enum)

From `prisma/schema.prisma`:

- **Registration & community**
  - `PDPA`
  - `CDPA`
  - `DIRECT_REFERRAL`
  - `COMMUNITY_REFERRAL`
- **Product**
  - `PERSONAL_PRODUCT_PURCHASE`
  - `DIRECT_REFERRAL_PRODUCT_PURCHASE`
  - `COMMUNITY_PRODUCT_PURCHASE`
  - `REPEAT_PRODUCT_PURCHASE`
- **Bonuses**
  - `MATCHING_BONUS`
  - `RANKING_BONUS`
  - `CPV_CASH_BONUS`
  - `CPV_MILESTONE_INCENTIVE`
  - `LEADERSHIP_BONUS`
- **Merchant**
  - `MERCHANT_PERSONAL_PRODUCT`
  - `MERCHANT_DIRECT_REFERRAL_PRODUCT`
  - `MERCHANT_COMMUNITY_PRODUCT`
  - `MERCHANT_DELIVERY_BONUS`

### How the frontend should use this

- **For summary tiles:**
  - Use `GET /earnings/summary.byType`:
    - PPPC: `byType.PERSONAL_PRODUCT_PURCHASE ?? 0`
    - DRPPC: `byType.DIRECT_REFERRAL_PRODUCT_PURCHASE ?? 0`
    - CPPC: `byType.COMMUNITY_PRODUCT_PURCHASE ?? 0`
    - Leadership bonus: `byType.LEADERSHIP_BONUS ?? 0`
- **For the transaction list:**
  - Use `earningType` as the canonical code (no need for `'PPPC'`/`'DRPPC'`/`'CPPC'` string hacks).
  - For community referral levels 1–13, **use `level`** and display e.g. `"Level 3"`; the backend doesn’t generate a verbose `source` string like `"Level 3 Bonus from UserX"` today.

---

## 3 & 4. 3×1 / 3×2 Team Forced Matrix & Level Commission Table

### What the backend already provides

- **`GET /earnings/ranking`**
  - Returns:
    - `rank: string` – human readable (Mentor, Manager, etc.)
    - `level: number` – matrix level
    - `stage: number`
    - `achievedAt: Date | null`
    - `history: { id; rank; stage; level; achievedAt; metadata }[]`
    - `stageBonuses: { stage: number; bonusAmount: number; achievedAt?: Date }[]`

- **`GET /earnings/summary`**
  - Returns:
    - `communityBonusByLevel: { level: number; amount: number; currency: 'NGN' | 'USD' }[]`

- **`GET /settings/commission-rules`**
  - Returns `CommissionRulesResponseDto`:
    - `rules: { id; level; percentage; currency; isActive; createdAt }[]`
    - `pdpaRates: Record<Package, number>` (0–1, e.g. `0.05 = 5%`)
    - `cdpaRates: Record<Package, number>` (percentage points, e.g. `5 = 5%`).

- **`GET /settings/ranking-rules`**
  - Returns `RankingRulesResponseDto`:
    - `rules: { id; stage; rankName; requiredLevel; bonusAmount?; isActive; createdAt }[]`.

### How the frontend should use this

- Use **`GET /earnings/ranking`** for **user‑specific matrix state**:
  - current level & stage
  - rank name
  - history timeline
  - actual earned stage bonuses.
- Use **`GET /earnings/summary.communityBonusByLevel`** to build **community bonus by level** charts (levels 1–13).
- Use **`GET /settings/commission-rules`** to build the **Level Commission Table UI** per level & package.
- Use **`GET /settings/ranking-rules`** to show the **full stage ladder** and potential stage completion bonuses.

---

## 5. CPV Milestone Awards

### What the backend already provides

- **`GET /earnings/cpv`**
  - Returns:
    - `totalCpv: number`
    - `lastUpdated: Date | null`
    - `transactions: CPV[]` (from `CpvRepository.findTransactions`):
      - `id`, `amount`, `source`, `sourceId?`, `metadata?`, `createdAt`
    - `milestonesTable: { threshold; rewardType; rewardAmount?; materialDescription? }[]`
    - `milestonesAchieved: number[]` (thresholds reached)
    - `milestones: { name; cpvRequired; reward; rewardAmount?; achieved; achievedDate; progressPercent }[]`
    - `cpvCashBonus: number`

- **`GET /settings/cpv-milestones`**
  - Returns `CpvRulesResponseDto`:
    - `rules: { id; threshold; rewardType; rewardAmount?; materialDescription?; isActive; createdAt; name?; reward? }[]`.

### How the frontend should use this

- For the **user CPV dashboard**:
  - Use `GET /earnings/cpv`:
    - Render tiles from `milestones[]` (name, cpvRequired, reward, progressPercent, achieved, achievedDate).
    - Show cumulative CPV from `totalCpv`.
    - Show CPV cash rewards from `cpvCashBonus`.
- For **config / static displays**:
  - Use `GET /settings/cpv-milestones` to show the underlying table of thresholds and rewards.
- **Not implemented yet**:
  - There is no explicit `pvType: 'PERSONAL' | 'TEAM'` field. To distinguish personal vs team CPV, you would need:
    - either to read a convention from `transactions[].metadata`, or
    - add a dedicated field in a future backend change.

---

## 6. Cashout / Autoship Split

### What the backend already provides

- **`GET /earnings/summary`**
  - Already exposes:
    - `cashoutPercentage`
    - `autoshipPercentage`
    - `cashoutEligible`
    - `autoshipBalance`
    - `monthlyAutoshipAmountUsd`.

### How the frontend should use this

- Use `GET /earnings/summary` as the **single source of truth** for:
  - autoship vs cashout percentages
  - autoship balance
  - how much must be reserved monthly in USD.
- **Not implemented yet**:
  - There is no `GET /autoship` endpoint with:
    - `nextAutoshipDate`
    - autoship status
    - auto‑deduction preferences.  
  - These would require new backend features if needed.

---

## 7. Merchant System

### What the backend already provides

- **`GET /merchants/me`**
  - Returns the current user’s merchant profile, including:
    - `category: 'REGIONAL' | 'NATIONAL' | 'GLOBAL'` (merchant tier)
    - status and other merchant metadata.

- **`GET /merchants/category-config`**
  - Returns configuration per merchant category:
    - `registrationFee`
    - `productPurchaseCommissionPercent`
    - `deliveryCommissionPercent`.

- **`GET /merchants/earnings/summary`**
  - Returns merchant‑only earnings totals, broken down by:
    - `MERCHANT_PERSONAL_PRODUCT`
    - `MERCHANT_DIRECT_REFERRAL_PRODUCT`
    - `MERCHANT_COMMUNITY_PRODUCT`
    - `MERCHANT_DELIVERY_BONUS`
    - plus aggregates.

### How the frontend should use this

- Use **`GET /merchants/me`** to:
  - determine if user is a merchant
  - read merchant tier (`REGIONAL` / `NATIONAL` / `GLOBAL`).
- Use **`GET /merchants/category-config`** to display:
  - registration fees per tier (configured, e.g. $600 / $3K / $10K equivalents)
  - commission percentages per tier.
- Use **`GET /merchants/earnings/summary`** to build merchant income dashboards, separate from MLM `GET /earnings/summary`.

---

## Priority Endpoints & Adjustments Summary (Frontend View)

1. **Registration & packages**
   - Use `GET /users/me` for package and registration state only (no registration/community PV there).
   - Use `GET /earnings/summary` for **registration and community PV**: `instantRegistrationPv`, `communityRegistrationPv`.
   - Use `GET /wallets` + `GET /earnings/summary` for balances and autoship split.

2. **Earning gateways**
   - Use `GET /earnings` and the `earningType: LedgerEarningType` enum as the **17 gateway codes**.
   - Use `GET /earnings/summary.byType` to compute PPPC/DRPPC/CPPC and leadership bonus aggregates.

3. **Matrix, commissions, and ranks**
   - Use `GET /earnings/ranking` for per‑user state and earned stage bonuses.
   - Use `GET /settings/commission-rules` for level percentages & PDPA/CDPA per package.
   - Use `GET /settings/ranking-rules` for the static stage ladder and bonus amounts.

4. **CPV milestones**
   - Use `GET /earnings/cpv` for user progress and `cpvCashBonus`.
   - Use `GET /settings/cpv-milestones` for static tier definitions.

5. **Autoship**
   - Use `GET /earnings/summary` for all currently available autoship data.
   - A richer `GET /autoship` endpoint would be a **future enhancement**.

6. **Merchant system**
   - Use `GET /merchants/me` for tier & status.
   - Use `GET /merchants/category-config` for fees & percentages.
   - Use `GET /merchants/earnings/summary` for merchant‑only earnings breakdown.