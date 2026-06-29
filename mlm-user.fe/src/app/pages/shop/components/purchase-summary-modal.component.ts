import { Component, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DynamicDialogRef, DynamicDialogConfig } from 'primeng/dynamicdialog';
import { Product } from '../../../services/product.service';
import { CartLineItem } from '../../../services/cart.service';
import {
  CartCheckoutData,
  CheckoutWalletType,
  PendingCheckoutData,
  SingleCheckoutData,
} from '../../../services/cart-checkout.service';

@Component({
  selector: 'app-purchase-summary-modal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './purchase-summary-modal.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PurchaseSummaryModalComponent {
  private dialogRef = inject(DynamicDialogRef);
  private config = inject(DynamicDialogConfig);

  mode: 'single' | 'cart' = this.config.data.mode ?? 'single';
  product: Product | null = this.config.data.product ?? null;
  cartItems: CartLineItem[] = this.config.data.items ?? [];
  selectedWallet: CheckoutWalletType = this.config.data.selectedWallet ?? 'voucher';
  quantity: number = this.config.data.quantity ?? 1;

  isProcessing = signal(false);

  get total(): number {
    if (this.mode === 'cart') {
      return this.cartItems.reduce((sum, line) => sum + line.product.price * line.quantity, 0);
    }
    return (this.product?.price ?? 0) * this.quantity;
  }

  get totalPV(): number {
    if (this.mode === 'cart') {
      return this.cartItems.reduce((sum, line) => sum + line.product.pv * line.quantity, 0);
    }
    return (this.product?.pv ?? 0) * this.quantity;
  }

  get lineCount(): number {
    return this.cartItems.length;
  }

  get itemCount(): number {
    return this.cartItems.reduce((sum, line) => sum + line.quantity, 0);
  }

  onConfirm(): void {
    this.isProcessing.set(true);
    setTimeout(() => {
      let orderData: PendingCheckoutData;
      if (this.mode === 'cart') {
        orderData = {
          mode: 'cart',
          items: this.cartItems,
          wallet: this.selectedWallet,
        } satisfies CartCheckoutData;
      } else if (this.product) {
        orderData = {
          mode: 'single',
          product: this.product,
          quantity: this.quantity,
          wallet: this.selectedWallet,
        } satisfies SingleCheckoutData;
      } else {
        this.isProcessing.set(false);
        return;
      }

      this.dialogRef.close({
        action: 'choose-fulfilment',
        orderData,
      });
    }, 500);
  }

  onClose(): void {
    this.dialogRef.close();
  }

  formatCurrency(amount: number): string {
    return `₦${amount.toLocaleString('en-US')}`;
  }

  walletLabel(): string {
    return this.selectedWallet === 'voucher' ? 'product voucher' : this.selectedWallet;
  }
}
