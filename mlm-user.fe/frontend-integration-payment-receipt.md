# Frontend Integration — Payment Receipt / Invoice

**Commit:** `fbdd627` (`fix: receipt`)  
**Date:** 2026-06-19  
**Backend endpoint:** `GET /payments/:id/receipt`

---

## Summary

Users can view, print, and download a structured invoice/receipt for completed payments. The backend returns a single JSON payload that maps directly to a printable invoice layout.

| Surface | Trigger | `paymentId` source |
|---------|---------|-------------------|
| Transactions page | Receipt icon on eligible rows | `GET /dashboard/transactions` → `items[].paymentId` |
| Order detail page | "View Receipt" in Order Actions | `GET /orders/:id` → `paymentId` |

The receipt endpoint is **live** after commit `fbdd627`. Wire the frontend API client and invoice modal to this contract.

---

## 1. API — `GET /payments/:id/receipt`

### Request

```
GET /payments/:id/receipt
Authorization: Bearer <token>
```

| Param | Type | Description |
|-------|------|-------------|
| `id` | UUID string | Payment ID (not reference) |

No query parameters.

### Auth rules

- Requires a valid Bearer token.
- **Does not** require registration payment completion (`RegistrationPaidGuard` is skipped). Registration receipts are available before activation.
- Users may only access their own payments.

### Error responses

| Status | Body | When |
|--------|------|------|
| `401` | `{ "message": "Unauthorized" }` | Missing or invalid token |
| `403` | `{ "message": "Access denied" }` | Payment belongs to another user |
| `404` | `{ "message": "Payment not found" }` | Invalid payment ID |

---

## 2. Response shape

### TypeScript types (recommended)

```typescript
type ReceiptInvoiceStatus = 'PAID' | 'PENDING' | 'FAILED';
type ReceiptPaymentMethod = 'PAYSTACK' | 'WALLET' | 'USDT' | 'FLUTTERWAVE';
type ReceiptItemType =
  | 'ACTIVATION'
  | 'UPGRADE'
  | 'MERCHANT_REGISTRATION'
  | 'PRODUCT_PURCHASE';

interface PaymentReceiptResponse {
  invoice: {
    invoiceNumber: string;
    date: string; // ISO 8601
    status: ReceiptInvoiceStatus;
  };
  payer: {
    name: string;
    email: string;
    phone: string | null;
    userId: string;
    username: string | null;
  };
  company: {
    name: string;
    address: string | null;
    email: string | null;
    phone: string | null;
    logoUrl: string | null;
    taxId: string | null;
  };
  payment: {
    id: string;
    reference: string;
    amount: number;
    currency: 'NGN' | 'USD';
    method: ReceiptPaymentMethod;
    provider: string;
    paidAt: string | null; // ISO 8601 when paid
  };
  items: Array<{
    description: string;
    type: ReceiptItemType;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
    metadata?: Record<string, unknown> | null;
  }>;
  totals: {
    subtotal: number;
    tax: number | null;
    deliveryFee: number | null;
    discount: number | null;
    total: number;
    currency: 'NGN' | 'USD';
  };
}
```

### Example response

```json
{
  "invoice": {
    "invoiceNumber": "PSK_abc123def456",
    "date": "2026-06-18T14:30:00.000Z",
    "status": "PAID"
  },
  "payer": {
    "name": "John Doe",
    "email": "john@example.com",
    "phone": "+2348012345678",
    "userId": "uuid-here",
    "username": "johndoe"
  },
  "company": {
    "name": "Segulah Technologies",
    "address": "Lagos, Nigeria",
    "email": "support@segulah.ng",
    "phone": null,
    "logoUrl": null,
    "taxId": null
  },
  "payment": {
    "id": "uuid-here",
    "reference": "PSK_abc123def456",
    "amount": 50000,
    "currency": "NGN",
    "method": "PAYSTACK",
    "provider": "PAYSTACK",
    "paidAt": "2026-06-18T14:32:00.000Z"
  },
  "items": [
    {
      "description": "Gold Package Activation",
      "type": "ACTIVATION",
      "quantity": 1,
      "unitPrice": 50000,
      "totalPrice": 50000,
      "metadata": { "packageName": "Gold" }
    }
  ],
  "totals": {
    "subtotal": 50000,
    "tax": null,
    "deliveryFee": null,
    "discount": null,
    "total": 50000,
    "currency": "NGN"
  }
}
```

### Field notes

| Field | Backend behavior |
|-------|------------------|
| `invoice.invoiceNumber` | Payment `reference` (v1). Sequential `INV-YYYY-NNNNN` deferred. |
| `invoice.status` | `SUCCESS` → `PAID`, `FAILED` → `FAILED`, else `PENDING` |
| `payment.paidAt` | `verifiedAt`, or `createdAt` if status is SUCCESS but not verified, else `null` |
| `payment.method` | `WALLET` for wallet debits; otherwise mapped from provider (`PAYSTACK`, `FLUTTERWAVE`, `USDT`) |
| `totals.currency` | Original payment display currency — **not** the user's UI preference |
| `company.*` | Hardcoded Segulah details; `logoUrl` may be `null` until configured |

---

## 3. Line item types and badges

The backend sets `items[].type` from payment context. Use it for color-coded badges in the line-items table.

| `type` | Payment context | Example `description` | `metadata` |
|--------|-----------------|----------------------|------------|
| `ACTIVATION` | Registration | `"Gold Package Activation"` | `{ packageName: "Gold" }` |
| `UPGRADE` | Package upgrade | `"Package Upgrade: Silver → Gold"` | `{ previousPackage, newPackage }` |
| `MERCHANT_REGISTRATION` | Merchant fee | `"Regional Merchant Registration Fee"` | `{ merchantType: "REGIONAL" }` |
| `PRODUCT_PURCHASE` | Order checkout | Product name per line | `{ orderId, productId, sku? }` |

**Product orders:** `items` contains **one row per order line**, not a single aggregate row. Wallet-paid orders (`POST /orders/:id/pay-wallet`) create a linked `PRODUCT_PURCHASE` payment.

Suggested badge colors (adjust to design system):

| Type | Suggested label |
|------|-----------------|
| `ACTIVATION` | Activation |
| `UPGRADE` | Upgrade |
| `MERCHANT_REGISTRATION` | Merchant |
| `PRODUCT_PURCHASE` | Product |

---

## 4. Where `paymentId` comes from

### Dashboard transactions

`GET /dashboard/transactions` now includes optional `paymentId` on each row when the ledger metadata contains it.

```typescript
interface DashboardTransactionItem {
  id: string;
  date: string;
  description: string;
  type: 'Credit' | 'Debit';
  amount: number;
  currency: 'NGN' | 'USD';
  status: 'Completed' | 'Pending' | 'Failed';
  categoryGroup: string;
  category: string;
  paymentId?: string; // present when receipt is available
}
```

**UI rule:** Show the receipt action only when `paymentId` is defined. Not every ledger row has a linked payment (e.g. earnings credits, transfers).

Typical rows with `paymentId`:

- Registration / upgrade debits
- Wallet funding
- Product purchase debits (including wallet pay)
- Merchant registration fees

### Order detail

`GET /orders/:id` includes `paymentId` when the order has a linked payment record.

```typescript
interface OrderDetail {
  // ...existing fields
  paymentId?: string;
}
```

**UI rule:** Show "View Receipt" in Order Actions when `paymentId` is present. On click, open the invoice modal with that ID.

---

## 5. Frontend implementation

### 5.1 API client

```typescript
async function getPaymentReceipt(
  paymentId: string,
  token: string,
): Promise<PaymentReceiptResponse> {
  const res = await fetch(`${API_BASE}/payments/${paymentId}/receipt`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new ReceiptError(res.status, err.message ?? res.statusText);
  }
  return res.json();
}
```

Consider React Query / SWR:

```typescript
useQuery({
  queryKey: ['payment-receipt', paymentId],
  queryFn: () => getPaymentReceipt(paymentId, token),
  enabled: !!paymentId && isModalOpen,
});
```

### 5.2 Invoice modal component

Recommended sections (top to bottom):

1. **Header** — Company name/logo (`company.logoUrl` if set), invoice number, date, status pill (`PAID` / `PENDING` / `FAILED`)
2. **Bill to** — `payer.name`, `payer.email`, `payer.phone`
3. **Payment details** — Reference, method, paid date (`payment.paidAt`), provider
4. **Line items table** — Description, type badge, qty, unit price, line total
5. **Totals** — Subtotal, optional tax/delivery/discount rows (hide when `null`), grand total
6. **Footer** — Company address, support email

**Formatting:**

- Format amounts with `payment.currency` / `totals.currency` (use existing `formatMoney` helper).
- Format dates with locale-aware formatter on `invoice.date` and `payment.paidAt`.
- Status pill colors: green (`PAID`), amber (`PENDING`), red (`FAILED`).

### 5.3 Print and download

**Print**

- Add a "Print" button that calls `window.print()` on a print-scoped CSS layout.
- Use `@media print` to hide nav, modal chrome, and action buttons.
- Prefer a dedicated `#receipt-print-root` container so only invoice content prints.

**Download (PDF)**

- Option A: Browser print → "Save as PDF" (no extra dependency).
- Option B: Client-side PDF (`html2canvas` + `jspdf`) if product requires one-click download.

### 5.4 Transactions page integration

```
[Transaction row]
  ... amount, status ...
  [Receipt icon]  ← visible only if item.paymentId
       ↓
  open InvoiceModal(paymentId)
       ↓
  GET /payments/:id/receipt
```

Handle loading and error states inside the modal:

- Loading: skeleton or spinner
- `404`: "Receipt not found"
- `403`: "You don't have access to this receipt"
- Network error: retry button

### 5.5 Order detail integration

```
Order Actions
  [View Receipt]  ← visible when order.paymentId
       ↓
  InvoiceModal(order.paymentId)
```

Same modal component as the Transactions page — one shared `PaymentReceiptModal`.

---

## 6. Edge cases

| Scenario | Expected behavior |
|----------|-------------------|
| Pending payment | Receipt loads with `invoice.status: "PENDING"`, `payment.paidAt: null` |
| Failed payment | Status `FAILED`; still allow viewing for user records |
| Registration before activation | Endpoint works without registration-paid guard |
| Multi-item product order | Multiple `PRODUCT_PURCHASE` rows in `items` |
| Missing `paymentId` on transaction | Hide receipt button (no fallback guess from reference) |
| `company.logoUrl` is `null` | Show text-only company header |
| Nullable totals (`tax`, `deliveryFee`, `discount`) | Omit rows when `null` (reserved for future VAT/promos) |

---

## 7. Implementation checklist

- [ ] Add `getPaymentReceipt(paymentId)` to payments API module
- [ ] Add `PaymentReceiptResponse` types (or generate from OpenAPI)
- [ ] Build shared `PaymentReceiptModal` with print styles
- [ ] Transactions page: receipt icon when `paymentId` is present
- [ ] Order detail: "View Receipt" when `order.paymentId` is present
- [ ] Item type badges for `ACTIVATION`, `UPGRADE`, `MERCHANT_REGISTRATION`, `PRODUCT_PURCHASE`
- [ ] Currency formatting uses receipt currency, not user display preference
- [ ] Error handling for 401 / 403 / 404
- [ ] Print layout tested in Chrome and Safari
- [ ] Optional: PDF download if required by product

---

## 8. Testing scenarios

1. **Registration receipt** — Complete registration payment; open receipt from transactions (works even before full activation).
2. **Upgrade receipt** — Upgrade payment shows `UPGRADE` line with package names in description/metadata.
3. **Product order (Paystack)** — Multiple products → multiple line items with SKUs in metadata.
4. **Product order (wallet pay)** — Order detail exposes `paymentId`; receipt shows `method: "WALLET"`.
5. **Merchant registration** — Single line with merchant type in metadata.
6. **Access control** — Another user's payment ID returns 403.
7. **Print** — Print preview shows invoice only, no app chrome.

---

## Related docs

- [backend-receipt-api-spec.md](../Febugs/backend-receipt-api-spec.md) — Original API contract spec
- [08-payments.md](../features/08-payments.md) — Payment receipt section (§18)
- [API.md](../API.md) — Route listing and auth guards
