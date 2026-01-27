import { Component, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DynamicDialogConfig, DynamicDialogRef } from 'primeng/dynamicdialog';
import { Product } from '../../../services/product.service';
import { ButtonModule } from 'primeng/button';
import { InputNumberModule } from 'primeng/inputnumber';

type WalletType = 'cash' | 'voucher' | 'autoship';

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
  selectedWallet = signal<WalletType>('cash');
  quantity = signal(1);
  isProcessing = signal(false);

  walletOptions = [
    { type: 'cash' as WalletType, label: 'Cash', icon: 'pi-wallet' },
    { type: 'voucher' as WalletType, label: 'Voucher', icon: 'pi-ticket' },
    { type: 'autoship' as WalletType, label: 'Autoship', icon: 'pi-sync' }
  ];

  selectImage(image: string): void {
    this.selectedImage.set(image);
  }

  selectWallet(wallet: WalletType): void {
    if (this.product.eligibleWallets.includes(wallet)) {
      this.selectedWallet.set(wallet);
    }
  }

  getWalletButtonClass(wallet: WalletType): string {
    const isEligible = this.product.eligibleWallets.includes(wallet);
    const isSelected = this.selectedWallet() === wallet;

    if (!isEligible) {
      return 'bg-gray-50 text-gray-300 cursor-not-allowed border border-gray-100';
    }
    if (isSelected) {
      return 'bg-mlm-primary text-white border-2 border-mlm-primary shadow-lg shadow-mlm-primary/20';
    }
    return 'bg-white text-mlm-text border border-gray-200 hover:border-gray-300 hover:bg-gray-50';
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
