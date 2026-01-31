# Referral & Network: Documentation vs Project Gaps

Comparison of [04-referral-network.md](../../04-referral-network.md) with the current implementation. **Implemented** items are summarized; **gaps** are what has not been done.

---

## Implemented (aligned with doc)

- **Entry: Sidebar → Network** – Sidebar links to `/network`; default redirect to `/network/overview`.
- **Routes** – `/network/overview`, `/network/referrals`, `/network/matrix`, `/network/downline`, `/network/performance` all exist and load the correct components.
- **Network layout** – All five sections (Overview, Referral Link, Matrix, Downline List, Performance) exist as pages.
- **Network Overview** – Header, Invite CTA; stats grid with Total Team Size, Direct Referrals, Active Legs, Current Rank (with next rank); Quick Action cards that link to Matrix, Downline, Performance.
- **Referral Link** – Referral URL (read-only), Copy button (`app-copy-button`), Referral code; Share section with WhatsApp, Telegram, Email, More; Sponsor display (sponsor name).
- **Matrix / Tree** – Tree visualization (PrimeNG OrganizationChart), level indicators (LVL), empty slots (dashed “Open Slot”), zoom controls (desktop), tooltips on nodes; mobile fallback to list view; node click navigates to that node as new root.
- **Downline List** – Table with Member (username + full name), Level, Package, Joined (date), Stats (DR, Team), Status; search by username/full name; Export CSV.
- **Performance & CPV** – Cycle display; stats (Personal CPV, Team CPV, Current Rank, Progress); CPV progress bar (Rank Progression); Next Rank Requirements / checklist; Achievements list.
- **State (mock)** – `NetworkService` has `referralLink`, `networkSummary`, `cpvSummary`, `matrixTree`, `downlineList`; structure matches doc intent.
- **Reusable** – `StatCard`, `CopyButton` exist; tree/table/dialog via PrimeNG.
- **UX** – Zoomable tree, tooltips on nodes, mobile list fallback, clear empty-slot indicators.

---

## 1. Entry points (not done)

| Doc | Project | Gap |
|-----|--------|-----|
| **Dashboard shortcut** → `/network/overview` | Dashboard has no link or button to Network/overview | **Dashboard shortcut to Network** (e.g. “View Network” or card link to `/network/overview`) **not implemented** |

---

## 2. Network Overview (partial)

| Doc | Project | Gap |
|-----|--------|-----|
| **CPV Summary** as overview UI component | Overview has 4 stat cards only (Total Team Size, Direct Referrals, Active Legs, Current Rank); no CPV summary card | **CPV Summary** on Overview page **not implemented** |
| **Summary cards clickable** – redirect to relevant sections | Stat cards are display-only; only Quick Action cards are clickable | **Summary stat cards** (Total Team Size, Direct Referrals, Active Legs, Current Rank) **not clickable**; doc expects each to redirect (e.g. Team Size → downline, Referrals → referrals, etc.) |

---

## 3. Referral Link (partial)

| Doc | Project | Gap |
|-----|--------|-----|
| **Copy → clipboard success toast** | Copy button shows “Copied!” in tooltip for 2s; no toast | **Success toast** on copy **not implemented** (tooltip only) |
| **Share → opens native share modal (mock)** | Share buttons (WhatsApp, Telegram, Email, More) are present but do not open a modal | **Share modal (mock)** **not implemented**; doc expects Share to open a native-share-style modal |

---

## 4. Matrix / Tree View (partial)

| Doc | Project | Gap |
|-----|--------|-----|
| **Node click modal** – Username, Package, Level, Status (Active/Inactive) | Node click **navigates** (sets node as new root); no modal | **Node click modal** with Username, Package, Level, Status **not implemented**; current behavior is drill-down only |

---

## 5. Downline List (partial)

| Doc | Project | Gap |
|-----|--------|-----|
| **Search & filter** | Search by username/full name only | **Filter** (e.g. by Level, Package, Status) **not implemented**; only search exists |

---

## 6. Performance & CPV (partial)

| Doc | Project | Gap |
|-----|--------|-----|
| **Earnings Contribution (visual)** | Progress bar and requirement/achievement lists exist; no dedicated “earnings contribution” visual | **Earnings Contribution (visual)** **not implemented** (e.g. chart or breakdown showing how much earnings come from team/CPV) |

---

## 7. Empty states (not done)

| Doc | Project | Gap |
|-----|--------|-----|
| **No referrals** – UI with Invite Friends CTA, Share referral link | Referral page always shows link and stats; no “no referrals yet” empty state | **Empty state for no referrals** (with Invite/Share CTAs) **not implemented** |
| **No downline** – UI with Invite Friends CTA, Share referral link | Downline shows emptymessage only when **search** has no matches | **Empty state when downline list is truly empty** (with Invite/Share CTAs) **not implemented** |
| **No CPV activity** – empty handling | Performance page does not show a dedicated “no CPV activity” empty state | **Empty state for no CPV activity** **not implemented** |

---

## 8. Reusable components (doc section 10)

| Doc component | Project | Gap |
|---------------|--------|-----|
| TreeNode | PrimeNG tree/organization chart used; no dedicated `TreeNode` component | Optional; doc may mean logical concept – **no standalone TreeNode component** |
| TreeView | Implemented via PrimeNG OrganizationChart + mobile list | OK |
| ProgressBar | Progress bar on Performance page (custom/PrimeNG) | OK |
| StatCard | `app-stat-card` exists and is used | OK |
| Modal | PrimeNG Dialog used elsewhere; no shared “node modal” for matrix | **Node modal** for matrix not implemented (see §4) |
| CopyButton | `app-copy-button` exists | OK (toast is separate gap) |

---

## What has not been done (checklist)

1. **Entry** – Add dashboard shortcut to `/network/overview` (e.g. from dashboard card or header).
2. **Overview** – Add CPV Summary card; make summary stat cards clickable with redirects to the relevant section (e.g. Team Size → downline, Direct Referrals → referrals, Active Legs → matrix, Current Rank → performance).
3. **Referral** – Add clipboard success **toast** on copy (in addition to or instead of tooltip); implement **Share modal (mock)** opened by Share buttons (WhatsApp, Email, etc.).
4. **Matrix** – Add **node click modal** showing Username, Package, Level, Status (Active/Inactive) per doc; keep or adjust current drill-down behavior as needed.
5. **Downline** – Add **filter(s)** (e.g. by Level, Package, Status) in addition to search.
6. **Performance** – Add **Earnings Contribution (visual)** (e.g. chart or summary of earnings from team/CPV).
7. **Empty states** – Add dedicated empty states with Invite Friends + Share referral link for: **no referrals** (referral page), **no downline** (downline page when list is empty), **no CPV activity** (performance page if applicable).

No code changes were made; this is a read-only gap analysis.
