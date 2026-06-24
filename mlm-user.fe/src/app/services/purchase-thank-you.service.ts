import { Injectable, inject, signal, computed } from '@angular/core';
import { InvoiceService } from './invoice.service';

export interface PurchaseThankYouSummary {
  orderId: string;
  orderReference: string;
  paymentId?: string;
  productName: string;
  quantity: number;
  paymentMethod: string;
  amount: number;
  currency: 'NGN' | 'USD';
  fulfilmentLabel: string;
  totalPv: number;
}

@Injectable({ providedIn: 'root' })
export class PurchaseThankYouService {
  private invoiceService = inject(InvoiceService);

  private visibleSignal = signal(false);
  private summarySignal = signal<PurchaseThankYouSummary | null>(null);
  private onDoneCallback: (() => void) | null = null;

  readonly visible = this.visibleSignal.asReadonly();
  readonly summary = this.summarySignal.asReadonly();
  readonly hasReceipt = computed(() => !!this.summarySignal()?.paymentId);

  open(summary: PurchaseThankYouSummary, onDone?: () => void): void {
    this.summarySignal.set(summary);
    this.onDoneCallback = onDone ?? null;
    this.visibleSignal.set(true);
  }

  close(): void {
    this.visibleSignal.set(false);
    const callback = this.onDoneCallback;
    this.onDoneCallback = null;
    setTimeout(() => this.summarySignal.set(null), 300);
    callback?.();
  }

  viewReceipt(): void {
    const paymentId = this.summarySignal()?.paymentId;
    if (!paymentId) return;
    this.invoiceService.openInvoice(paymentId);
  }

  downloadReceipt(): void {
    const paymentId = this.summarySignal()?.paymentId;
    if (!paymentId) return;
    this.invoiceService.downloadReceipt(paymentId);
  }

  formatCurrency(amount: number, currency: 'NGN' | 'USD'): string {
    return this.invoiceService.formatCurrency(amount, currency);
  }
}
