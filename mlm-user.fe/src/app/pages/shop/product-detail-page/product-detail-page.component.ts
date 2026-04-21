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
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ProductService, Product } from '../../../services/product.service';
import { OrderService } from '../../../services/order.service';
import { MessageService } from 'primeng/api';
import { DialogService } from 'primeng/dynamicdialog';
import { ProductGalleryComponent } from '../../../components/product-gallery/product-gallery.component';
import { QuantitySelectorComponent } from '../../../components/quantity-selector/quantity-selector.component';
import { BadgeComponent } from '../../../components/badge/badge.component';
import { PurchaseSummaryModalComponent } from '../components/purchase-summary-modal.component';
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
    OrderPreviewComponent,
  ],
  templateUrl: './product-detail-page.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProductDetailPageComponent implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private productService = inject(ProductService);
  private orderService = inject(OrderService);
  private messageService = inject(MessageService);
  private dialogService = inject(DialogService);

  product = signal<Product | null>(null);
  selectedWallet = signal<WalletType>('cash');
  quantity = signal(1);
  fulfilmentDrawerVisible = signal(false);
  pendingOrderData = signal<any>(null);
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
  totalCPV = computed(() => {
    const p = this.product();
    const q = this.quantity();
    return p ? p.cpv * q : 0;
  });

  walletOptions = [
    { type: 'cash' as WalletType, label: 'Cash', icon: 'pi-wallet' },
    { type: 'voucher' as WalletType, label: 'Voucher', icon: 'pi-ticket' },
    { type: 'autoship' as WalletType, label: 'Autoship', icon: 'pi-sync' },
  ];

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
      const eligible = p.eligibleWallets;
      if (eligible.length && !eligible.includes(this.selectedWallet())) {
        this.selectedWallet.set(eligible[0]);
      }
    });
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
        quantity: this.quantity(),
      },
      header: 'Purchase Summary',
      width: '90vw',
      style: { maxWidth: '420px' },
      baseZIndex: 10000,
    });
    if (ref) {
      ref.onClose.subscribe((result: { action?: string; orderData?: any } | undefined) => {
        if (result?.action === 'choose-fulfilment' && result.orderData) {
          this.pendingOrderData.set(result.orderData);
          this.fulfilmentDrawerVisible.set(true);
        }
      });
    }
  }

  submitOrder(fulfilmentDetails: any): void {
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

    const payload = {
      items: [{ productId: orderData.product.id, quantity: orderData.quantity }],
      paymentMethod: 'WALLET',
      fulfilmentMode: isPickup ? 'PICKUP' : 'OFFLINE_DELIVERY',
      selectedMerchantId: isPickup ? selectedMerchantId : undefined,
      deliveryAddress:
        fulfilmentDetails.fulfilmentOption === 'delivery'
          ? fulfilmentDetails.deliveryAddress
          : undefined,
      deliveryDisclaimerAccepted: true,
    };

    this.orderSubmitting.set(true);
    this.orderService.createOrder(payload).subscribe({
      next: (order) => {
        this.orderService.payOrderWithWallet(order.id, orderData.wallet).subscribe({
          next: () => {
            this.orderSubmitting.set(false);
            this.fulfilmentDrawerVisible.set(false);
            this.pendingOrderData.set(null);
            this.messageService.add({
              severity: 'success',
              summary: 'Order placed',
              detail: 'Order created successfully. Redirecting to your orders.',
            });
            this.router.navigate(['/orders']);
          },
          error: (err) => {
            this.orderSubmitting.set(false);
            console.error('Payment failed', err);
            this.messageService.add({
              severity: 'error',
              summary: 'Payment failed',
              detail: err?.error?.message ?? 'Could not complete payment. Please try again.',
            });
          },
        });
      },
      error: (err) => {
        this.orderSubmitting.set(false);
        console.error('Order creation failed', err);
        this.messageService.add({
          severity: 'error',
          summary: 'Order failed',
          detail: err?.error?.message ?? 'Could not create order. Please try again.',
        });
      },
    });
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
