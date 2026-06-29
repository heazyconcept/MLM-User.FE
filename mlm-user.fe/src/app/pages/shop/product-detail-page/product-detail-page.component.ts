import {
  Component,
  inject,
  signal,
  computed,
  OnInit,
  OnDestroy,
  ChangeDetectionStrategy,
  effect,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ProductService, Product } from '../../../services/product.service';
import { MessageService } from 'primeng/api';
import { DialogService } from 'primeng/dynamicdialog';
import { CartService } from '../../../services/cart.service';
import {
  CartCheckoutService,
  CheckoutWalletType,
  PendingCheckoutData,
} from '../../../services/cart-checkout.service';
import { ProductGalleryComponent } from '../../../components/product-gallery/product-gallery.component';
import { QuantitySelectorComponent } from '../../../components/quantity-selector/quantity-selector.component';
import { BadgeComponent } from '../../../components/badge/badge.component';
import { PurchaseSummaryModalComponent } from '../components/purchase-summary-modal.component';
import { DrawerModule } from 'primeng/drawer';
import { OrderPreviewComponent } from '../../orders/order-preview/order-preview.component';
import { PurchaseThankYouModalComponent } from '../../../components/purchase-thank-you-modal/purchase-thank-you-modal.component';
import { InvoiceModalComponent } from '../../../components/invoice-modal/invoice-modal.component';

@Component({
  selector: 'app-product-detail-page',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    ProductGalleryComponent,
    QuantitySelectorComponent,
    BadgeComponent,
    DrawerModule,
    OrderPreviewComponent,
    PurchaseThankYouModalComponent,
    InvoiceModalComponent,
  ],
  templateUrl: './product-detail-page.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProductDetailPageComponent implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private productService = inject(ProductService);
  private cartService = inject(CartService);
  private checkoutService = inject(CartCheckoutService);
  private messageService = inject(MessageService);
  private dialogService = inject(DialogService);

  product = signal<Product | null>(null);
  selectedWallet = signal<CheckoutWalletType>('voucher');
  quantity = signal(1);
  fulfilmentDrawerVisible = signal(false);
  pendingOrderData = signal<PendingCheckoutData | null>(null);
  orderSubmitting = signal(false);

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

  readonly walletOptions = [{ type: 'voucher' as CheckoutWalletType, label: 'Product Voucher' }];

  eligibleWalletOptions = computed(() => {
    const p = this.product();
    if (!p) return [];
    return this.walletOptions.filter((w) => p.eligibleWallets.includes(w.type));
  });

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      this.router.navigate(['/marketplace']);
      return;
    }
    this.productService.getProductById(id).subscribe((p) => {
      if (!p) {
        this.router.navigate(['/marketplace']);
        return;
      }
      this.product.set(p);
      this.productService.selectProduct(p);
      const firstPayWallet = this.walletOptions.find((w) =>
        p.eligibleWallets.includes(w.type),
      )?.type;
      if (firstPayWallet) {
        this.selectedWallet.set(firstPayWallet);
      }
    });
  }

  onWalletChange(wallet: CheckoutWalletType): void {
    const p = this.product();
    if (p?.eligibleWallets.includes(wallet)) {
      this.selectedWallet.set(wallet);
    }
  }

  onQuantityChange(value: number): void {
    this.quantity.set(value);
  }

  onAddToCart(): void {
    const p = this.product();
    if (!p || !p.inStock) return;
    const result = this.cartService.addItem(p, this.quantity());
    if (result.success) {
      this.messageService.add({
        severity: 'success',
        summary: 'Added to cart',
        detail: `${p.name} was added to your cart.`,
        life: 3000,
      });
    } else {
      this.messageService.add({
        severity: 'warn',
        summary: 'Could not add to cart',
        detail: result.message ?? 'This product is unavailable.',
        life: 4000,
      });
    }
  }

  onBuyNow(): void {
    const p = this.product();
    if (!p || !p.inStock) return;
    const ref = this.dialogService.open(PurchaseSummaryModalComponent, {
      data: {
        mode: 'single',
        product: p,
        selectedWallet: this.selectedWallet(),
        quantity: this.quantity(),
      },
      showHeader: false,
      width: '90vw',
      style: { maxWidth: '420px' },
      baseZIndex: 10000,
    });
    if (ref) {
      ref.onClose.subscribe((result: { action?: string; orderData?: PendingCheckoutData } | undefined) => {
        if (result?.action === 'choose-fulfilment' && result.orderData) {
          this.pendingOrderData.set(result.orderData);
          this.fulfilmentDrawerVisible.set(true);
        }
      });
    }
  }

  submitOrder(fulfilmentDetails: {
    fulfilmentOption: 'pickup' | 'delivery';
    selectedPickupId?: string | null;
    deliveryAddress?: string;
    deliveryState?: string;
    deliveryFee?: number;
  }): void {
    const orderData = this.pendingOrderData();
    if (!orderData) return;

    const isPickup = fulfilmentDetails.fulfilmentOption === 'pickup';
    const selectedMerchantId = fulfilmentDetails.selectedPickupId;

    if (isPickup && !selectedMerchantId) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Pickup location required',
        detail: 'Please select a pickup location before confirming.',
      });
      return;
    }

    this.orderSubmitting.set(true);
    this.checkoutService.submitOrder(orderData, fulfilmentDetails).subscribe({
      next: () => {
        this.orderSubmitting.set(false);
        this.fulfilmentDrawerVisible.set(false);
        this.pendingOrderData.set(null);
        this.cleanupLingeringDrawerMask();
      },
      error: (err) => {
        this.orderSubmitting.set(false);
        console.error('Order failed', err);
        const errMsg = err?.error?.message ?? '';
        const friendlyMsg =
          errMsg.toLowerCase().includes('no active price') ||
          errMsg.toLowerCase().includes('no effective price')
            ? 'This product is not available for purchase yet.'
            : (err?.error?.message ?? 'Could not complete order. Please try again.');

        this.messageService.add({
          severity: 'error',
          summary: 'Order failed',
          detail: friendlyMsg,
        });
      },
    });
  }

  formatCurrency(amount: number): string {
    return `₦${amount.toLocaleString('en-US')}`;
  }

  formatAvailableDate(dateStr: string | null | undefined): string {
    if (!dateStr) return '';
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' });
    } catch {
      return '';
    }
  }

  closeFulfilmentDrawer(): void {
    this.fulfilmentDrawerVisible.set(false);
  }

  onDrawerVisibleChange(visible: boolean): void {
    this.fulfilmentDrawerVisible.set(visible);
    if (!visible) {
      this.cleanupLingeringDrawerMask();
    }
  }

  private cleanupLingeringDrawerMask(): void {
    const masks = document.querySelectorAll('.p-drawer-mask.p-overlay-mask');
    masks.forEach((mask) => mask.remove());
  }

  ngOnDestroy(): void {
    document.body.style.overflow = this.bodyOverflowPrevious || '';
    this.cleanupLingeringDrawerMask();
  }
}
