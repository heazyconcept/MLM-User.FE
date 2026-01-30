import { Component, inject, signal, computed, OnInit, OnDestroy, ChangeDetectionStrategy, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ProductService, Product } from '../../../services/product.service';
import { DialogService } from 'primeng/dynamicdialog';
import { ProductGalleryComponent } from '../../../components/product-gallery/product-gallery.component';
import { QuantitySelectorComponent } from '../../../components/quantity-selector/quantity-selector.component';
import { BadgeComponent } from '../../../components/badge/badge.component';
import { PurchaseSummaryModalComponent } from '../components/purchase-summary-modal.component';
import { OrderSuccessComponent } from '../components/order-success.component';
import { DrawerModule } from 'primeng/drawer';
import { OrderPreviewComponent } from '../../orders/order-preview/order-preview.component';

type WalletType = 'cash' | 'voucher' | 'autoship';

@Component({
  selector: 'app-product-detail-page',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    ProductGalleryComponent,
    QuantitySelectorComponent,
    BadgeComponent,
    DrawerModule,
    OrderPreviewComponent
  ],
  templateUrl: './product-detail-page.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ProductDetailPageComponent implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private productService = inject(ProductService);
  private dialogService = inject(DialogService);

  product = signal<Product | null>(null);
  selectedWallet = signal<WalletType>('cash');
  quantity = signal(1);
  fulfilmentDrawerVisible = signal(false);

  private bodyOverflowPrevious = '';

  constructor() {
    effect(() => {
      const open = this.fulfilmentDrawerVisible();
      if (open) {
        this.bodyOverflowPrevious = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
      } else {
        document.body.style.overflow = this.bodyOverflowPrevious;
      }
    });
  }

  total = computed(() => {
    const p = this.product();
    const q = this.quantity();
    return p ? p.price * q : 0;
  });
  totalPV = computed(() => {
    const p = this.product();
    const q = this.quantity();
    return p ? p.pv * q : 0;
  });

  walletOptions = [
    { type: 'cash' as WalletType, label: 'Cash', icon: 'pi-wallet' },
    { type: 'voucher' as WalletType, label: 'Voucher', icon: 'pi-ticket' },
    { type: 'autoship' as WalletType, label: 'Autoship', icon: 'pi-sync' }
  ];

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      this.router.navigate(['/marketplace']);
      return;
    }
    const p = this.productService.getProductById(id);
    if (!p) {
      this.router.navigate(['/marketplace']);
      return;
    }
    this.product.set(p);
    this.productService.selectProduct(p);
    const eligible = p.eligibleWallets;
    if (eligible.length && !eligible.includes(this.selectedWallet())) {
      this.selectedWallet.set(eligible[0]);
    }
  }

  selectWallet(wallet: WalletType): void {
    const p = this.product();
    if (p?.eligibleWallets.includes(wallet)) {
      this.selectedWallet.set(wallet);
    }
  }

  getWalletButtonClass(wallet: WalletType): string {
    const p = this.product();
    if (!p) return '';
    const isEligible = p.eligibleWallets.includes(wallet);
    const isSelected = this.selectedWallet() === wallet;
    if (!isEligible) {
      return 'bg-gray-50 text-gray-300 cursor-not-allowed border border-gray-100';
    }
    if (isSelected) {
      return 'bg-mlm-primary text-white border-2 border-mlm-primary shadow-lg shadow-mlm-primary/20';
    }
    return 'bg-white text-mlm-text border border-gray-200 hover:border-gray-300 hover:bg-gray-50';
  }

  onQuantityChange(value: number): void {
    this.quantity.set(value);
  }

  onBuyNow(): void {
    const p = this.product();
    if (!p || !p.inStock) return;
    const ref = this.dialogService.open(PurchaseSummaryModalComponent, {
      data: {
        product: p,
        selectedWallet: this.selectedWallet(),
        quantity: this.quantity()
      },
      header: 'Purchase Summary',
      width: '90vw',
      style: { maxWidth: '420px' },
      baseZIndex: 10000
    });
    if (ref) {
      ref.onClose.subscribe((result: { action?: string; orderData?: unknown } | undefined) => {
        if (result?.action === 'order-success' && result.orderData) {
          const successRef = this.dialogService.open(OrderSuccessComponent, {
            data: result.orderData,
            header: '',
            width: '90vw',
            style: { maxWidth: '450px' },
            baseZIndex: 10001,
            closable: false,
            closeOnEscape: false
          });
          if (successRef) {
            successRef.onClose.subscribe((successResult: { action?: string } | undefined) => {
              if (successResult?.action === 'choose-fulfilment') {
                this.fulfilmentDrawerVisible.set(true);
              } else if (successResult?.action === 'view-orders') {
                this.router.navigate(['/orders']);
              }
            });
          }
        }
      });
    }
  }

  formatCurrency(amount: number): string {
    return `₦${amount.toLocaleString('en-US')}`;
  }

  closeFulfilmentDrawer(): void {
    this.fulfilmentDrawerVisible.set(false);
  }

  ngOnDestroy(): void {
    document.body.style.overflow = this.bodyOverflowPrevious || '';
  }
}
