# Business Rule — Product Voucher Balance Gate Before Cashout

**Effective date:** 1 November 2026 (00:00 Africa/Lagos, unless leadership specifies otherwise)  
**Status:** Documented only — **not implemented** in backend or member app as of this writing  
**Source:** Client / leadership discussion (October 2026); final Inaka course meeting expected to confirm edge cases  
**Area:** Network **Product Voucher** (`WalletType.VOUCHER`) vs member **cashout** (bank withdrawal / cashout wallet outflows)

**Related (separate, urgent track):** Transfers between **network Product Voucher** and **Legacy product voucher** (`VOUCHER` ↔ `LEGACY_VOUCHER`, same member only). That work is **not** covered by this document.

---

## 1. Summary

From **1 November 2026**, a member may **only cash out** (withdraw earnings to bank / complete the relevant cashout flow) if their **network Product Voucher** balance is **at most ₦10,000**.

If the **network Product Voucher** balance is **₦10,001 or more**, cashout must be **blocked** until the member **uses voucher balance to buy products** (network marketplace orders paid from Product Voucher), bringing the voucher balance down to **₦10,000 or below**.

This rule is meant to ensure members spend voucher value on products before withdrawing cash, not to hide or confiscate voucher money.

---

## 2. Client wording (plain language)

| Voucher balance (network Product Voucher) | Cashout allowed? |
|-------------------------------------------|------------------|
| **₦10,000 or less** (e.g. ₦0, ₦5,000, ₦10,000) | **Yes** — member may proceed with cashout (subject to all other existing rules). |
| **₦10,001 or more** (e.g. ₦10,001, ₦60,000, ₦70,000) | **No** — member must buy products from Product Voucher first, then cash out once balance is ≤ ₦10,000. |

**Examples from discussion:**

- ₦60,000 in Product Voucher → must buy products first; cannot cash out until voucher is reduced.
- ₦10,000 in Product Voucher → may cash out.
- Member with ₦70,000 network voucher and ₦60,000 Legacy product voucher: the **₦10,000 gate applies to the network Product Voucher only** (Legacy voucher balance is a separate wallet; see §4).

---

## 3. Scope

### In scope (intended)

- **Wallet:** Network **Product Voucher** only — backend type `VOUCHER`, member-facing label **Product Voucher** / **Product Voucher Wallet**.
- **Threshold:** **₦10,000** in the wallet’s **display currency** when display currency is **NGN** (confirm USD / dual-currency members with product before implementation).
- **Comparison:** Block when `voucherDisplayBalance > 10_000`; allow when `voucherDisplayBalance <= 10_000`.
- **Effective date:** Enforcement must **not** apply before **2026-11-01** (use config or feature flag so the rule can be deployed earlier but remain off until go-live).

### Out of scope for this rule

- **Legacy product voucher** (`LEGACY_VOUCHER`) — different wallet; not part of this ₦10,000 cashout gate unless leadership explicitly extends the rule later.
- **Peer transfers** (`POST /wallets/fund-transfer`) from Product Voucher — remains disallowed; unrelated to this gate.
- **Same-user moves** between `VOUCHER` and `LEGACY_VOUCHER` — separate product change (urgent); does not replace this November rule.

---

## 4. Open questions (confirm at Inaka / leadership meeting)

These must be answered before implementation; do not guess in code.

1. **Which “cashout” flows are gated?**
   - **Likely:** Bank withdrawal from **Cashout (CASH)** wallet — `POST /withdrawals` (or equivalent).
   - **Confirm:** Legacy **LEGACY_CASHOUT** transfers to CASH / bank, internal “cashout” moves, or Legacy-specific withdrawal paths.
2. **Currency:** Apply only when voucher `displayCurrency === NGN`, or convert USD voucher balance to NGN equivalent for the comparison?
3. **Pending withdrawals:** If a member submits withdrawal on 31 Oct and it is approved on 2 Nov with voucher now > ₦10,000, allow or reject?
4. **Messaging:** Exact member-facing copy (English; local language if required).
5. **Admin override:** Can support waive the gate for a specific member (audit trail required)?

---

## 5. Intended behavior (for future engineering — not built yet)

### Backend (HerbApi — future)

- Before accepting a **cashout / withdrawal** request covered by this rule:
  - If `now < effectiveDate` → skip check.
  - Else load member’s **VOUCHER** wallet available balance in display terms.
  - If balance **> 10_000** (NGN) → reject with stable error code, e.g. `VOUCHER_BALANCE_BLOCKS_CASHOUT`, HTTP 400 or 403, message explaining they must spend Product Voucher on products first.
- Do **not** change voucher balances automatically; only **gate** cashout.

### Member app (mlm-user.fe — future)

- On **withdraw / cashout** UI: surface API error with clear explanation and link to **shop / orders** (network marketplace).
- Optional (after go-live): banner on wallet or dashboard when `voucherBalance > 10000` and date ≥ effective date.

### Admin app

- No requirement unless product asks for a report or override tool (see open questions).

---

## 6. Acceptance criteria (when implemented)

- [ ] Before **2026-11-01**, members with any Product Voucher balance can cash out as today (gate disabled).
- [ ] On/after **2026-11-01**, member with **₦10,000** network voucher can request cashout (other rules permitting).
- [ ] On/after **2026-11-01**, member with **₦10,001+** network voucher receives a clear block and no withdrawal record is created (or request is rejected at submission).
- [ ] After member pays down voucher via **network product purchase**, cashout succeeds once balance ≤ ₦10,000.
- [ ] Legacy product voucher balance does **not** by itself trigger this gate (unless product changes scope in §4).

---

## 7. Timeline

| Milestone | Date |
|-----------|------|
| Rule documented | October 2026 |
| Inaka / leadership confirmation of §4 | TBD (evening meeting referenced by client) |
| Target go-live | **1 November 2026** |
| Implementation | **Not started** — backend and FE work deferred per product direction |

---

## 8. Change log

| Date | Change |
|------|--------|
| 2026-10-15 | Initial documentation from client discussion; no code changes. |
