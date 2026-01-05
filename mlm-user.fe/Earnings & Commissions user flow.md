(Read-only calculation | Currency-aware | Admin-approved)
User Dashboard
→ Click "Earnings" / "Commissions"

Access Control
IF RegistrationFeeStatus = UNPAID
  → Block access
  → Show message:
    "Complete registration to access earnings"
ELSE
  → Open Earnings Overview


EARNINGS OVERVIEW (PAID USERS)
Earnings Overview Page
- Total Earnings (NGN)
- Total Earnings (USD)
- Pending Commissions
- Approved Commissions
- Withdrawn Amounts

- Earnings are grouped by currency
- No combined totals across currencies
- Currency symbol always visible

COMMISSION BREAKDOWN
Earnings Overview
→ Click "View Commission Breakdown"

Commission Breakdown Page
- Tabs:
  - Direct Referral
  - Level / Team Commission
  - Bonuses (if enabled)

Each row shows:
- Date
- Commission Type
- Source (User / Order Ref)
- Amount
- Currency (NGN / USD)
- Status (Pending / Approved / Locked)

