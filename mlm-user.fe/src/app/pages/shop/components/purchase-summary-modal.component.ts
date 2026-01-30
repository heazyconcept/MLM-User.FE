import { Component, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DynamicDialogRef, DynamicDialogConfig } from 'primeng/dynamicdialog';
import { Product } from '../../../services/product.service';

type WalletType = 'cash' | 'voucher' | 'autoship';

@Component({
  selector: 'app-purchase-summary-modal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './purchase-summary-modal.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PurchaseSummaryModalComponent {
  private dialogRef = inject(DynamicDialogRef);
  private config = inject(DynamicDialogConfig);

  product: Product = this.config.data.product;
  selectedWallet: WalletType = this.config.data.selectedWallet;
  quantity: number = this.config.data.quantity;

  isProcessing = signal(false);

  get total(): number {
    return this.product.price * this.quantity;
  }

  get totalPV(): number {
    return this.product.pv * this.quantity;
  }

  onConfirm(): void {
    this.isProcessing.set(true);
    setTimeout(() => {
      const orderId = 'ORD-' + Date.now().toString(36).toUpperCase();
      this.dialogRef.close({
        action: 'order-success',
        orderData: {
          orderId,
          productName: this.product.name,
          productImage: this.product.images[0],
          quantity: this.quantity,
          wallet: this.selectedWallet,
          total: this.total,
          totalPV: this.totalPV
        }
      });
    }, 1500);
  }

  formatCurrency(amount: number): string {
    return `₦${amount.toLocaleString('en-US')}`;
  }
}
