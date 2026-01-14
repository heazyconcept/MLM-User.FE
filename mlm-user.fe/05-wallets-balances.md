# 05-wallets-balances

<a id="05-wallets-balancesmd"></a>

# 05-wallets-balances.md

**User Interface Specification – Wallets & Balances**

* * *

<a id="1-purpose"></a>

## 1\. Purpose

This document defines the **Wallets & Balances UI**, which allows users to:

- View all wallet balances
- Understand wallet types
- Navigate to funding and withdrawals
- See currency display rules

> ⚠️ UI-only specification  
> All balances are mocked. No financial transactions occur.

* * *

<a id="2-entry-points"></a>

## 2\. Entry Points

| Trigger | Route |
| --- | --- |
| Sidebar → Wallet | `/wallet` |
| Dashboard shortcut | `/wallet/overview` |

* * *

<a id="3-wallet-types-overview"></a>

## 3\. Wallet Types Overview

The system exposes **three wallet types** to users:

| Wallet Type | Description | Withdrawable |
| --- | --- | --- |
| Cash Wallet | Main earnings wallet | Yes |
| Voucher Wallet | Product vouchers | No  |
| Autoship Wallet | Auto product credits | No  |

* * *

<a id="4-wallet-overview"></a>

## 4\. Wallet Overview

<a id="route"></a>

### Route

```
/wallet/overview

```

<a id="ui-components"></a>

### UI Components

- Wallet cards (one per wallet)
- Total balance display
- Currency indicator (USD / NGN)
- Quick action buttons

<a id="wallet-card-elements"></a>

### Wallet Card Elements

- Wallet name
- Balance
- Info tooltip
- Primary action button

* * *

<a id="5-cash-wallet"></a>

## 5\. Cash Wallet

<a id="route"></a>

### Route

```
/wallet/cash

```

<a id="ui-components"></a>

### UI Components

- Available balance
- Withdraw button
- Fund Wallet button
- Info banner (withdrawal rules)

<a id="behavior"></a>

### Behavior

- Withdraw button:
  - Enabled if balance > 0
  - Redirect → `/withdrawals`
- Fund Wallet:
  - Redirect → `/payments/fund`

* * *

<a id="6-voucher-wallet"></a>

## 6\. Voucher Wallet

<a id="route"></a>

### Route

```
/wallet/voucher

```

<a id="ui-components"></a>

### UI Components

- Voucher balance
- Usage info
- Browse Products button

<a id="behavior"></a>

### Behavior

- Button redirects → `/marketplace`
- Withdrawal disabled permanently

* * *

<a id="7-autoship-wallet"></a>

## 7\. Autoship Wallet

<a id="route"></a>

### Route

```
/wallet/autoship

```

<a id="ui-components"></a>

### UI Components

- Autoship balance
- Autoship description
- Eligible products preview

<a id="behavior"></a>

### Behavior

- Informational only
- No transfer or withdrawal options

* * *

<a id="8-currency-display-rules-ui"></a>

## 8\. Currency Display Rules (UI)

- Display primary currency based on registration
- Show secondary currency equivalent (mock)
- Currency switcher disabled (read-only)

* * *

<a id="9-empty-states"></a>

## 9\. Empty States

<a id="scenarios"></a>

### Scenarios

- Zero balance wallets
- New user

<a id="ui-actions"></a>

### UI Actions

- Fund Wallet CTA
- Invite Friends CTA
- Browse Products CTA

* * *

<a id="10-reusable-components"></a>

## 10\. Reusable Components

- `WalletCard`
- `BalanceDisplay`
- `Tooltip`
- `Button`
- `InfoBanner`
- `CurrencyBadge`

* * *

<a id="11-state-management-mock"></a>

## 11\. State Management (Mock)

```
wallets: {
  cash: { balance: number }
  voucher: { balance: number }
  autoship: { balance: number }
  currency: 'USD' | 'NGN'
}

```

* * *

<a id="12-ux-accessibility-rules"></a>

## 12\. UX & Accessibility Rules

- Clear withdrawable vs non-withdrawable labels
- Tooltips for wallet rules
- Responsive wallet cards
- Consistent currency formatting

* * *

<a id="13-ui-flow-summary"></a>

## 13\. UI Flow Summary

```
Dashboard
  → Wallet Overview
      → Cash Wallet → Withdrawals / Funding
      → Voucher Wallet → Marketplace
      → Autoship Wallet → Info

```

* * *

<a id="14-future-backend-integration-notes"></a>

## 14\. Future Backend Integration Notes

When backend is introduced:

- Enforce currency lock
- Real-time balance updates
- Withdrawal eligibility checks
- Ledger synchronization

* * *

<a id="15-status"></a>

## 15\. Status

✅ Wallet UI defined  
✅ User-safe  
✅ Backend-independent