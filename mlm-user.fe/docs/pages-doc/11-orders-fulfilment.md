# 11-orders-fulfilment

<a id="11-orders-fulfilmentmd"></a>

# 11-orders-fulfilment.md

**User Interface Specification – Orders & Fulfilment**

* * *

<a id="1-purpose"></a>

## 1\. Purpose

This document defines the **Orders & Fulfilment UI**, which allows users to:

- View placed orders
- Track fulfilment status
- Select pickup or delivery options
- Monitor logistics progress

> ⚠️ UI-only specification  
> No order processing, no logistics execution.

* * *

<a id="2-entry-points"></a>

## 2\. Entry Points

| Trigger | Route |
| --- | --- |
| Sidebar → Orders | `/orders` |
| Marketplace → Purchase | `/orders/preview` |

* * *

<a id="3-orders-overview"></a>

## 3\. Orders Overview

<a id="route"></a>

### Route

```
/orders

```

<a id="ui-components"></a>

### UI Components

- Orders list
- Status filters
- Order search

<a id="order-list-columns"></a>

### Order List Columns

- Order ID
- Date
- Items
- Total amount
- Fulfilment method
- Status

* * *

<a id="4-order-details"></a>

## 4\. Order Details

<a id="route"></a>

### Route

```
/orders/:id

```

<a id="ui-components"></a>

### UI Components

- Order summary
- Items list
- Payment method
- Fulfilment option
- Delivery or pickup details
- Order timeline

* * *

<a id="5-fulfilment-selection-ui"></a>

## 5\. Fulfilment Selection (UI)

<a id="route"></a>

### Route

```
/orders/preview

```

<a id="options"></a>

### Options

1. Pickup
2. Home Delivery

* * *

<a id="6-pickup-option"></a>

## 6\. Pickup Option

<a id="ui-components"></a>

### UI Components

- Nearby merchant list
- Distance indicator
- Select pickup location button

<a id="behavior"></a>

### Behavior

- Selection saved locally
- No location validation

* * *

<a id="7-home-delivery-option"></a>

## 7\. Home Delivery Option

<a id="ui-components"></a>

### UI Components

- Delivery address
- Delivery fee display
- Delivery notice banner

> Banner example:  
> “Delivery cost will be added to your order total.”

* * *

<a id="8-order-status-tracking"></a>

## 8\. Order Status Tracking

<a id="statuses-ui"></a>

### Statuses (UI)

- Pending
- Processing
- Ready for Pickup
- Out for Delivery
- Delivered
- Cancelled

<a id="ui"></a>

### UI

- Stepper / timeline
- Status badges

* * *

<a id="9-empty-states"></a>

## 9\. Empty States

<a id="scenarios"></a>

### Scenarios

- No orders
- Filter returns none

<a id="ui-actions"></a>

### UI Actions

- Browse Marketplace CTA

* * *

<a id="10-reusable-components"></a>

## 10\. Reusable Components

- `OrderCard`
- `OrderTimeline`
- `StatusBadge`
- `LocationSelector`
- `Modal`
- `Button`

* * *

<a id="11-state-management-mock"></a>

## 11\. State Management (Mock)

```
orders: {
  list: []
  selectedOrder: {}
  fulfilmentOption: 'pickup' | 'delivery'
}

```

* * *

<a id="12-ux-accessibility-rules"></a>

## 12\. UX & Accessibility Rules

- Clear fulfilment labels
- Delivery fee visibility
- Mobile-friendly order cards
- Accessible status indicators

* * *

<a id="13-ui-flow-summary"></a>

## 13\. UI Flow Summary

```
Marketplace
  → Order Preview
      → Fulfilment Selection
          → Order Created (mock)
              → Order List
                  → Order Detail

```

* * *

<a id="14-future-backend-integration-notes"></a>

## 14\. Future Backend Integration Notes

When backend is introduced:

- Real merchant proximity
- Logistics pricing
- Order state transitions
- Delivery tracking

* * *

<a id="15-status"></a>

## 15\. Status

✅ Orders & fulfilment UI defined  
✅ Logistics-aware  
✅ Backend-independent