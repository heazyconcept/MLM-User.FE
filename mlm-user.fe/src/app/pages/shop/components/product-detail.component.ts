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
  template: `
    <div class="flex flex-col lg:flex-row gap-8">
      
      <!-- Image Gallery -->
      <div class="lg:w-1/2">
        <!-- Main Image -->
        <div class="aspect-square rounded-2xl overflow-hidden bg-mlm-warm-50 mb-4">
          <img 
            [src]="selectedImage()" 
            [alt]="product.name"
            class="w-full h-full object-cover">
        </div>
        
        <!-- Thumbnail Gallery -->
        @if (product.images.length > 1) {
          <div class="flex gap-3">
            @for (image of product.images; track image; let i = $index) {
              <button
                (click)="selectImage(image)"
                [class]="selectedImage() === image ? 'ring-2 ring-mlm-primary' : 'ring-1 ring-gray-200 hover:ring-mlm-primary/50'"
                class="w-16 h-16 rounded-xl overflow-hidden transition-all">
                <img [src]="image" [alt]="product.name + ' thumbnail'" class="w-full h-full object-cover">
              </button>
            }
          </div>
        }
      </div>
      
      <!-- Product Details -->
      <div class="lg:w-1/2 space-y-6">
        
        <!-- Category & Stock -->
        <div class="flex items-center gap-3">
          <span class="text-xs font-bold text-mlm-secondary uppercase tracking-wider">{{ product.category }}</span>
          @if (product.inStock) {
            <span class="text-xs font-semibold text-mlm-primary bg-mlm-green-50 px-2 py-0.5 rounded-full">In Stock</span>
          } @else {
            <span class="text-xs font-semibold text-mlm-error bg-mlm-red-50 px-2 py-0.5 rounded-full">Out of Stock</span>
          }
        </div>
        
        <!-- Price & PV -->
        <div class="flex items-baseline gap-4">
          <span class="text-3xl font-bold text-mlm-text">{{ formatCurrency(product.price) }}</span>
          <span class="text-sm font-semibold text-mlm-warm-600 bg-mlm-warm-100 px-3 py-1 rounded-full">
            {{ product.pv }} PV
          </span>
        </div>
        
        <!-- Description -->
        <div>
          <h4 class="text-xs font-bold text-mlm-secondary uppercase tracking-wider mb-2">Description</h4>
          <p class="text-sm text-mlm-secondary leading-relaxed">{{ product.description }}</p>
        </div>
        
        <!-- Wallet Selection -->
        <div>
          <h4 class="text-xs font-bold text-mlm-secondary uppercase tracking-wider mb-3">Pay With</h4>
          <div class="grid grid-cols-3 gap-3">
            @for (wallet of walletOptions; track wallet.type) {
              <button
                (click)="selectWallet(wallet.type)"
                [disabled]="!product.eligibleWallets.includes(wallet.type)"
                [class]="getWalletButtonClass(wallet.type)"
                class="p-4 rounded-xl text-center transition-all">
                <i [class]="'pi ' + wallet.icon + ' text-lg mb-2 block'"></i>
                <span class="text-xs font-semibold block">{{ wallet.label }}</span>
              </button>
            }
          </div>
        </div>
        
        <!-- Quantity Selector -->
        <div>
          <h4 class="text-xs font-bold text-mlm-secondary uppercase tracking-wider mb-3">Quantity</h4>
          <div class="flex items-center gap-3">
            <button 
              (click)="decrementQuantity()"
              [disabled]="quantity() <= 1"
              class="w-10 h-10 rounded-xl border border-gray-200 flex items-center justify-center text-mlm-text hover:bg-mlm-background disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
              <i class="pi pi-minus text-sm"></i>
            </button>
            <span class="w-16 text-center text-lg font-bold text-mlm-text">{{ quantity() }}</span>
            <button 
              (click)="incrementQuantity()"
              [disabled]="quantity() >= 10"
              class="w-10 h-10 rounded-xl border border-gray-200 flex items-center justify-center text-mlm-text hover:bg-mlm-background disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
              <i class="pi pi-plus text-sm"></i>
            </button>
          </div>
        </div>
        
        <!-- Total -->
        <div class="bg-mlm-background rounded-2xl p-4">
          <div class="flex items-center justify-between">
            <div>
              <span class="text-xs font-bold text-mlm-secondary uppercase tracking-wider block mb-1">Total</span>
              <span class="text-2xl font-bold text-mlm-text">{{ formatCurrency(product.price * quantity()) }}</span>
            </div>
            <div class="text-right">
              <span class="text-xs font-bold text-mlm-secondary uppercase tracking-wider block mb-1">Total PV</span>
              <span class="text-lg font-bold text-mlm-warm-600">{{ product.pv * quantity() }} PV</span>
            </div>
          </div>
        </div>
        
        <!-- Action Buttons -->
        <div class="flex gap-3 pt-2">
          <button
            (click)="onBuyNow()"
            [disabled]="!product.inStock"
            class="flex-1 py-4 bg-mlm-primary text-white text-sm font-bold uppercase tracking-wide rounded-xl hover:bg-mlm-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
            Buy Now
          </button>
          <button
            (click)="onClose()"
            class="px-6 py-4 border border-gray-200 text-mlm-secondary text-sm font-bold uppercase tracking-wide rounded-xl hover:bg-mlm-background transition-colors">
            Cancel
          </button>
        </div>
        
        <!-- Info Note -->
        <p class="text-[10px] text-mlm-secondary text-center">
          <i class="pi pi-info-circle mr-1"></i>
          This is a UI preview. Orders are not processed in this demo.
        </p>
      </div>
    </div>
  `,
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
      return 'bg-mlm-primary text-white border-2 border-mlm-primary';
    }
    return 'bg-white text-mlm-text border border-gray-200 hover:border-mlm-primary/50';
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
    // In real app, this would initiate purchase flow
    console.log('Purchase:', {
      product: this.product,
      quantity: this.quantity(),
      wallet: this.selectedWallet(),
      total: this.product.price * this.quantity(),
      totalPV: this.product.pv * this.quantity()
    });
    this.dialogRef.close({ action: 'buy', product: this.product, quantity: this.quantity() });
  }

  onClose(): void {
    this.dialogRef.close();
  }

  formatCurrency(amount: number): string {
    return `₦${amount.toLocaleString('en-US')}`;
  }
}

