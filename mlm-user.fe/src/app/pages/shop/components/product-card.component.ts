import { Component, Input, Output, EventEmitter, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Product } from '../../../services/product.service';

@Component({
  selector: 'app-product-card',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div 
      (click)="onProductClick()"
      class="group bg-white rounded-2xl border border-gray-100 overflow-hidden cursor-pointer transition-all duration-300 hover:shadow-lg hover:border-gray-200 hover:-translate-y-1">
      
      <!-- Product Image -->
      <div class="relative aspect-square overflow-hidden bg-mlm-warm-50">
        <img 
          [src]="product.images[0]" 
          [alt]="product.name"
          class="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          loading="lazy">
        
        <!-- Out of Stock Overlay -->
        @if (!product.inStock) {
          <div class="absolute inset-0 bg-white/80 flex items-center justify-center">
            <span class="text-xs font-bold text-mlm-secondary uppercase tracking-wide">Out of Stock</span>
          </div>
        }

        <!-- PV Badge -->
        <div class="absolute top-3 right-3 px-2.5 py-1 bg-mlm-warm-100 rounded-full">
          <span class="text-[10px] font-bold text-mlm-warm-700 uppercase tracking-wide">{{ product.pv }} PV</span>
        </div>

        <!-- Quick Add Button (appears on hover) -->
        @if (product.inStock) {
          <div class="absolute bottom-0 left-0 right-0 p-3 translate-y-full group-hover:translate-y-0 transition-transform duration-300">
            <button 
              (click)="onAddToCart($event)"
              class="w-full py-2.5 bg-mlm-text text-white text-xs font-bold uppercase tracking-wide rounded-xl hover:bg-mlm-text/90 transition-colors">
              View Details
            </button>
          </div>
        }
      </div>
      
      <!-- Product Info -->
      <div class="p-4">
        <!-- Category Tag -->
        <span class="text-[10px] font-semibold text-mlm-secondary uppercase tracking-wider">
          {{ product.category }}
        </span>
        
        <!-- Product Name -->
        <h3 class="text-sm font-semibold text-mlm-text mt-1 line-clamp-2 leading-snug group-hover:text-mlm-primary transition-colors">
          {{ product.name }}
        </h3>
        
        <!-- Price -->
        <div class="mt-3 flex items-center justify-between">
          <span class="text-base font-bold text-mlm-text">
            {{ formatCurrency(product.price) }}
          </span>
          
          <!-- Wallet Badges -->
          <div class="flex items-center gap-1">
            @if (product.eligibleWallets.includes('voucher')) {
              <span class="w-5 h-5 rounded-full bg-mlm-warm-100 flex items-center justify-center" title="Voucher eligible">
                <i class="pi pi-ticket text-[8px] text-mlm-warm-600"></i>
              </span>
            }
            @if (product.eligibleWallets.includes('autoship')) {
              <span class="w-5 h-5 rounded-full bg-mlm-teal-100 flex items-center justify-center" title="Autoship eligible">
                <i class="pi pi-sync text-[8px] text-mlm-teal-600"></i>
              </span>
            }
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    :host {
      display: block;
    }
    
    .line-clamp-2 {
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ProductCardComponent {
  @Input({ required: true }) product!: Product;
  @Output() productClick = new EventEmitter<Product>();
  @Output() addToCart = new EventEmitter<Product>();

  onProductClick(): void {
    this.productClick.emit(this.product);
  }

  onAddToCart(event: Event): void {
    event.stopPropagation();
    this.productClick.emit(this.product);
  }

  formatCurrency(amount: number): string {
    return `₦${amount.toLocaleString('en-US')}`;
  }
}

