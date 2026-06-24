import { Component, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PurchaseThankYouService } from '../../services/purchase-thank-you.service';

@Component({
  selector: 'app-purchase-thank-you-modal',
  imports: [CommonModule],
  templateUrl: './purchase-thank-you-modal.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PurchaseThankYouModalComponent {
  thankYouService = inject(PurchaseThankYouService);

  visible = this.thankYouService.visible;
  summary = this.thankYouService.summary;
  hasReceipt = this.thankYouService.hasReceipt;

  referenceCopied = signal(false);

  formatCurrency(amount: number, currency: 'NGN' | 'USD'): string {
    return this.thankYouService.formatCurrency(amount, currency);
  }

  onViewReceipt(): void {
    this.thankYouService.viewReceipt();
  }

  onDownloadReceipt(): void {
    this.thankYouService.downloadReceipt();
  }

  onDone(): void {
    this.thankYouService.close();
  }

  onCopyReference(reference: string): void {
    if (!reference || !navigator.clipboard) return;
    navigator.clipboard.writeText(reference).then(() => {
      this.referenceCopied.set(true);
      setTimeout(() => this.referenceCopied.set(false), 2000);
    });
  }

  onCardClick(event: Event): void {
    event.stopPropagation();
  }
}
