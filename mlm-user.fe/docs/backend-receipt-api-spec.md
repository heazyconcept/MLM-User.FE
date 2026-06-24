# Backend API Specification: Payment Receipt / Invoice

> **Purpose:** This document specifies the backend endpoint the frontend needs in order to display printable invoices/receipts for user transactions. The frontend is already built against this contract — please implement accordingly.

---

## Endpoint

```
GET /payments/:id/receipt
```

### Description

Returns structured receipt/invoice data for a single completed payment. This powers the invoice modal that users can view, print, and download from the Transactions page and Order Detail page.

### Authentication

Requires a valid Bearer token. Users may only access receipts for their own payments.

### Path Parameters

| Parameter | Type   | Description                    |
|-----------|--------|--------------------------------|
| `id`      | string | The payment ID (UUID)          |

### Query Parameters

None.

---

## Response

### `200 OK`

```jsonc
{
  "invoice": {
    "invoiceNumber": "INV-2026-00042",   // Sequential or use payment reference
    "date": "2026-06-18T14:30:00.000Z",  // Payment creation date
    "status": "PAID"                     // "PAID" | "PENDING" | "FAILED"
  },
  "payer": {
    "name": "John Doe",                 // firstName + " " + lastName
    "email": "john@example.com",
    "phone": "+2348012345678",           // nullable
    "userId": "uuid-here",
    "username": "johndoe"               // nullable
  },
  "company": {
    "name": "Segulah Technologies",
    "address": "Lagos, Nigeria",         // nullable
    "email": "support@segulah.ng",       // nullable
    "phone": "+234...",                  // nullable
    "logoUrl": "https://...",            // nullable, absolute URL
    "taxId": null                        // nullable
  },
  "payment": {
    "id": "uuid-here",
    "reference": "PSK_abc123def456",
    "amount": 50000,
    "currency": "NGN",
    "method": "PAYSTACK",               // "PAYSTACK" | "WALLET" | "USDT" | "FLUTTERWAVE"
    "provider": "PAYSTACK",
    "paidAt": "2026-06-18T14:32:00.000Z" // nullable if pending
  },
  "items": [
    {
      "description": "Gold Package Activation",
      "type": "ACTIVATION",              // See type table below
      "quantity": 1,
      "unitPrice": 50000,
      "totalPrice": 50000,
      "metadata": {                      // nullable, extra context per type
        "packageName": "Gold"
      }
    }
  ],
  "totals": {
    "subtotal": 50000,
    "tax": null,                         // nullable, future-proofed for VAT
    "deliveryFee": null,                 // nullable, for product orders
    "discount": null,                    // nullable, for promo codes
    "total": 50000,
    "currency": "NGN"
  }
}
```

### Item Type Mapping

The `items[].type` field determines the category of the purchase. The frontend uses this to display color-coded badges.

| Payment Context         | `type`                  | `description` Examples                           | `metadata` Fields                                      |
|-------------------------|-------------------------|--------------------------------------------------|--------------------------------------------------------|
| Account activation      | `ACTIVATION`            | "Gold Package Activation"                        | `{ packageName: "Gold" }`                              |
| Package upgrade         | `UPGRADE`               | "Package Upgrade: Silver → Gold"                 | `{ previousPackage: "Silver", newPackage: "Gold" }`    |
| Merchant registration   | `MERCHANT_REGISTRATION` | "Regional Merchant Registration Fee"             | `{ merchantType: "REGIONAL" }`                         |
| Product purchase (order) | `PRODUCT_PURCHASE`     | "Premium Health Pack"                            | `{ orderId: "uuid", productId: "uuid", sku: "PH-001" }` |

### How to Determine `type`

The backend should determine the type from the payment's context:

1. **ACTIVATION** — Payment records with `type = 'REGISTRATION'` or linked to the registration flow
2. **UPGRADE** — Payment records with `type = 'UPGRADE'` or initiated via `POST /payments/upgrade/initiate`
3. **MERCHANT_REGISTRATION** — Payment records linked to merchant fee payments (`merchants/merchant-fee/initiate`)
4. **PRODUCT_PURCHASE** — Payment records linked to an order (has an associated `orderId`). Each order item becomes a separate entry in the `items` array.

### Error Responses

| Status | Body                                          | When                            |
|--------|-----------------------------------------------|---------------------------------|
| `401`  | `{ "message": "Unauthorized" }`               | No/invalid token                |
| `403`  | `{ "message": "Access denied" }`              | Payment belongs to another user |
| `404`  | `{ "message": "Payment not found" }`          | Invalid payment ID              |

---

## Implementation Notes

1. **Company details** can be hardcoded or loaded from a config/settings table. They rarely change.
2. **Invoice numbering**: Prefer sequential (`INV-YYYY-NNNNN`) for formal invoices. If not feasible in v1, the payment `reference` field is acceptable.
3. **For product orders**: The `items` array should contain one entry per order item (product line), not a single aggregate entry.
4. **Currency**: Must match the original payment currency, not the user's display preference.
5. **`paidAt`**: Should be the `verifiedAt` timestamp from the payment record, falling back to `createdAt` if not available.

---

## Frontend Integration Points

The frontend calls this endpoint from:
- **Transactions page** — Receipt icon button per row (for payment/debit transactions)
- **Order Detail page** — "View Receipt" button in Order Actions section
- **Invoice Modal** — Renders the response into a printable invoice layout

The frontend is already built against this contract. Once the endpoint is live, receipts will work automatically.
