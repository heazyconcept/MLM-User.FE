import { Component, inject, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { InvoiceService, InvoiceItemType, InvoiceStatus } from '../../services/invoice.service';

@Component({
  selector: 'app-invoice-modal',
  imports: [CommonModule, DatePipe],
  templateUrl: './invoice-modal.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InvoiceModalComponent {
  invoiceService = inject(InvoiceService);

  receipt = this.invoiceService.activeReceipt;
  visible = this.invoiceService.modalVisible;
  loading = this.invoiceService.loading;
  error = this.invoiceService.error;

  formatCurrency(amount: number, currency: 'NGN' | 'USD'): string {
    return this.invoiceService.formatCurrency(amount, currency);
  }

  getItemTypeLabel(type: string): string {
    return this.invoiceService.getItemTypeLabel(type as InvoiceItemType);
  }

  getItemTypeBadgeClass(type: string): string {
    return this.invoiceService.getItemTypeBadgeClass(type as InvoiceItemType);
  }

  getStatusBadgeClass(status: string): string {
    return this.invoiceService.getStatusBadgeClass(status as InvoiceStatus);
  }

  getStatusIcon(status: string): string {
    switch (status) {
      case 'PAID':
        return 'pi-check-circle';
      case 'PENDING':
        return 'pi-clock';
      case 'FAILED':
        return 'pi-times-circle';
      default:
        return 'pi-info-circle';
    }
  }

  onClose(): void {
    this.invoiceService.closeModal();
    // Delay clearing so the exit animation can play
    setTimeout(() => this.invoiceService.clearActiveReceipt(), 300);
  }

  onPrint(): void {
    this.invoiceService.printInvoice();
  }

  onDownload(): void {
    const r = this.receipt();
    this.invoiceService.downloadInvoice(r?.invoice.invoiceNumber ?? 'invoice');
  }

  onRetry(): void {
    this.invoiceService.retryFetch();
  }

  /** Prevent click-through on the modal card itself. */
  onCardClick(event: Event): void {
    event.stopPropagation();
  }
}
