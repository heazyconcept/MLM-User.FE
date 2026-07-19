import { Injectable, inject, signal, computed } from '@angular/core';
import { Observable, of, firstValueFrom } from 'rxjs';
import { tap, catchError, finalize } from 'rxjs/operators';
import { downloadReceiptPdf } from '../core/utils/receipt-pdf';
import { ApiService } from './api.service';

/* ── Interfaces ────────────────────────────────────────────────── */

export type InvoiceItemType =
  | 'ACTIVATION'
  | 'UPGRADE'
  | 'MERCHANT_REGISTRATION'
  | 'PRODUCT_PURCHASE';

export type InvoiceStatus = 'PAID' | 'PENDING' | 'FAILED';

export type ReceiptPaymentMethod = 'PAYSTACK' | 'WALLET' | 'USDT' | 'FLUTTERWAVE' | 'KORAPAY';

export interface InvoiceInfo {
  invoiceNumber: string;
  date: string;
  dueDate?: string;
  status: InvoiceStatus;
}

export interface InvoicePayer {
  name: string;
  email: string;
  phone?: string | null;
  userId: string;
  username?: string | null;
}

export interface InvoiceCompany {
  name: string;
  address?: string | null;
  email?: string | null;
  phone?: string | null;
  logoUrl?: string | null;
  taxId?: string | null;
}

export interface InvoicePayment {
  id: string;
  reference: string;
  amount: number;
  currency: 'NGN' | 'USD';
  method: ReceiptPaymentMethod;
  provider: string;
  paidAt?: string | null;
}

export interface InvoiceItem {
  description: string;
  type: InvoiceItemType;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  metadata?: Record<string, unknown> | null;
}

export interface InvoiceTotals {
  subtotal: number;
  tax?: number | null;
  deliveryFee?: number | null;
  discount?: number | null;
  total: number;
  currency: 'NGN' | 'USD';
}

export interface ReceiptResponse {
  invoice: InvoiceInfo;
  payer: InvoicePayer;
  company: InvoiceCompany;
  payment: InvoicePayment;
  items: InvoiceItem[];
  totals: InvoiceTotals;
}

/* ── Service ───────────────────────────────────────────────────── */

@Injectable({ providedIn: 'root' })
export class InvoiceService {
  private api = inject(ApiService);

  /* ── State ─────────────────────────────────────────────────── */
  private cache = new Map<string, ReceiptResponse>();
  private loadingSignal = signal(false);
  private errorSignal = signal<string | null>(null);
  private activeReceiptSignal = signal<ReceiptResponse | null>(null);
  private modalVisibleSignal = signal(false);
  private activePaymentIdSignal = signal<string | null>(null);

  readonly loading = this.loadingSignal.asReadonly();
  readonly error = this.errorSignal.asReadonly();
  readonly activeReceipt = this.activeReceiptSignal.asReadonly();
  readonly modalVisible = this.modalVisibleSignal.asReadonly();
  readonly activePaymentId = this.activePaymentIdSignal.asReadonly();

  readonly hasActiveReceipt = computed(() => this.activeReceiptSignal() !== null);

  /* ── Public API ────────────────────────────────────────────── */

  /** Fetch receipt data for a payment, using cache if available. */
  fetchReceipt(paymentId: string): Observable<ReceiptResponse | null> {
    const cached = this.cache.get(paymentId);
    if (cached) {
      this.activeReceiptSignal.set(cached);
      this.errorSignal.set(null);
      this.loadingSignal.set(false);
      return of(cached);
    }

    this.loadingSignal.set(true);
    this.errorSignal.set(null);

    return this.api.get<ReceiptResponse>(`payments/${paymentId}/receipt`).pipe(
      tap((receipt) => {
        this.cache.set(paymentId, receipt);
        this.activeReceiptSignal.set(receipt);
      }),
      catchError((err) => {
        console.error('[InvoiceService] fetchReceipt failed', err);
        const message =
          err?.error?.message ?? 'Failed to load receipt. Please try again.';
        this.errorSignal.set(typeof message === 'string' ? message : String(message));
        this.activeReceiptSignal.set(null);
        return of(null);
      }),
      finalize(() => this.loadingSignal.set(false)),
    );
  }

  /** Open the invoice modal for a given payment ID. */
  openInvoice(paymentId: string): void {
    this.activePaymentIdSignal.set(paymentId);
    this.activeReceiptSignal.set(null);
    this.errorSignal.set(null);
    this.modalVisibleSignal.set(true);
    this.fetchReceipt(paymentId).subscribe();
  }

  /** Retry loading the active receipt after a failure. */
  retryFetch(): void {
    const paymentId = this.activePaymentIdSignal();
    if (!paymentId) return;
    this.invalidateCache(paymentId);
    this.activeReceiptSignal.set(null);
    this.errorSignal.set(null);
    this.fetchReceipt(paymentId).subscribe();
  }

  /** Close the invoice modal. */
  closeModal(): void {
    this.modalVisibleSignal.set(false);
  }

  /** Clear the active receipt (e.g. on modal close animation end). */
  clearActiveReceipt(): void {
    this.activeReceiptSignal.set(null);
    this.errorSignal.set(null);
    this.activePaymentIdSignal.set(null);
  }

  /** Trigger the browser print dialog for the invoice content. */
  printInvoice(): void {
    document.body.classList.add('printing-receipt');
    const cleanup = (): void => {
      document.body.classList.remove('printing-receipt');
    };
    window.addEventListener('afterprint', cleanup, { once: true });
    setTimeout(() => window.print(), 150);
  }

  /** Download the invoice as a PDF file. */
  downloadInvoice(invoiceNumber: string): void {
    void this.exportReceiptPdfByNumber(invoiceNumber);
  }

  /** Fetch receipt if needed and download as PDF. */
  downloadReceipt(paymentId: string): void {
    void this.exportReceiptPdf(paymentId);
  }

  private async exportReceiptPdfByNumber(invoiceNumber: string): Promise<void> {
    const receipt = this.activeReceiptSignal();
    if (!receipt) {
      console.warn('[InvoiceService] No receipt loaded for PDF export');
      return;
    }

    try {
      downloadReceiptPdf(receipt, this.buildReceiptFilename(invoiceNumber));
    } catch (err) {
      console.error('[InvoiceService] PDF export failed', err);
    }
  }

  private async exportReceiptPdf(paymentId: string): Promise<void> {
    try {
      let receipt: ReceiptResponse | null = this.activeReceiptSignal();
      if (!receipt || this.activePaymentIdSignal() !== paymentId) {
        receipt = await firstValueFrom(this.fetchReceipt(paymentId));
      }
      if (!receipt) {
        return;
      }

      downloadReceiptPdf(receipt, this.buildReceiptFilename(receipt.invoice.invoiceNumber));
    } catch (err) {
      console.error('[InvoiceService] PDF export failed', err);
    }
  }

  private buildReceiptFilename(reference: string): string {
    const safe = reference.replace(/[^\w.-]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
    return `receipt-${safe || 'invoice'}.pdf`;
  }

  /** Invalidate cached receipt for a payment (e.g. after status change). */
  invalidateCache(paymentId: string): void {
    this.cache.delete(paymentId);
  }

  /** Clear all cached receipts. */
  clearCache(): void {
    this.cache.clear();
  }

  /* ── Helpers ───────────────────────────────────────────────── */

  /** Format currency amount for display. */
  formatCurrency(amount: number, currency: 'NGN' | 'USD'): string {
    const symbol = currency === 'USD' ? '$' : '₦';
    const formatted = new Intl.NumberFormat('en-NG', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(Math.abs(amount));
    return `${symbol}${formatted}`;
  }

  /** Get human-readable label for an item type. */
  getItemTypeLabel(type: InvoiceItemType): string {
    const labels: Record<InvoiceItemType, string> = {
      ACTIVATION: 'Activation',
      UPGRADE: 'Upgrade',
      MERCHANT_REGISTRATION: 'Merchant',
      PRODUCT_PURCHASE: 'Product',
    };
    return labels[type] ?? type;
  }

  /** Get Tailwind CSS classes for an item type badge. */
  getItemTypeBadgeClass(type: InvoiceItemType): string {
    const classes: Record<InvoiceItemType, string> = {
      ACTIVATION: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      UPGRADE: 'bg-blue-50 text-blue-700 border-blue-200',
      MERCHANT_REGISTRATION: 'bg-purple-50 text-purple-700 border-purple-200',
      PRODUCT_PURCHASE: 'bg-amber-50 text-amber-700 border-amber-200',
    };
    return classes[type] ?? 'bg-gray-50 text-gray-700 border-gray-200';
  }

  /** Get status badge classes. */
  getStatusBadgeClass(status: InvoiceStatus): string {
    const classes: Record<InvoiceStatus, string> = {
      PAID: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      PENDING: 'bg-amber-50 text-amber-700 border-amber-200',
      FAILED: 'bg-red-50 text-red-700 border-red-200',
    };
    return classes[status] ?? 'bg-gray-50 text-gray-700 border-gray-200';
  }
}
