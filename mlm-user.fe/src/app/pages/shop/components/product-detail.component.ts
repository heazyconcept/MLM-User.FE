import { Component, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DynamicDialogConfig, DynamicDialogRef } from 'primeng/dynamicdialog';
import { Product } from '../../../services/product.service';
import { ButtonModule } from 'primeng/button';
import { InputNumberModule } from 'primeng/inputnumber';

type WalletType = 'cash' | 'voucher';

@Component({
  selector: 'app-product-detail',
  standalone: true,
  imports: [CommonModule, FormsModule, ButtonModule, InputNumberModule],
  templateUrl: './product-detail.component.html',
  styles: [`
    :host {
      display: block;
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ProductDetailComponent {
  private config = inject(DynamicDialogConfig);
  private dialogRef = inject(DynamicDialogRef);

  product: Product = this.config.data.product;

  selectedImage = signal(this.product.images[0]);
  selectedWallet = signal<WalletType>(this.initialPayWallet());
  quantity = signal(1);
  isProcessing = signal(false);

  readonly walletOptions = [
    { type: 'voucher' as WalletType, label: 'Product Voucher' },
  ];

  get eligibleWalletOptions() {
    return this.walletOptions.filter((w) => this.product.eligibleWallets.includes(w.type));
  }

  private initialPayWallet(): WalletType {
    return 'voucher';
  }

  selectImage(image: string): void {
    this.selectedImage.set(image);
  }

  onWalletChange(wallet: WalletType): void {
    if (this.product.eligibleWallets.includes(wallet)) {
      this.selectedWallet.set(wallet);
    }
  }

  incrementQuantity(): void {
    if (this.quantity() < 10) {
      this.quantity.update(q => q + 1);
    }
  }

  decrementQuantity(): void {
    if (this.quantity() > 1) {
      this.quantity.update(q => q - 1);
    }
  }

  onBuyNow(): void {
    this.isProcessing.set(true);
    
    // Simulate order processing
    setTimeout(() => {
      // Generate order ID
      const orderId = 'ORD-' + Date.now().toString(36).toUpperCase();
      
      // Close dialog and pass order data to open success modal
      this.dialogRef.close({
        action: 'order-success',
        orderData: {
          orderId,
          productName: this.product.name,
          productImage: this.product.images[0],
          quantity: this.quantity(),
          wallet: this.selectedWallet(),
          total: this.product.price * this.quantity(),
          totalPV: this.product.pv * this.quantity()
        }
      });
    }, 1500);
  }

  onClose(): void {
    this.dialogRef.close();
  }

  formatCurrency(amount: number): string {
    return `₦${amount.toLocaleString('en-US')}`;
  }
}
