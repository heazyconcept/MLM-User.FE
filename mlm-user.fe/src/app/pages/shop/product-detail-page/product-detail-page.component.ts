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
import { OrderService, Order } from '../../../services/order.service';
import { MessageService } from 'primeng/api';
import { DialogService } from 'primeng/dynamicdialog';
import { PurchaseThankYouService, PurchaseThankYouSummary } from '../../../services/purchase-thank-you.service';
import { ProductGalleryComponent } from '../../../components/product-gallery/product-gallery.component';
import { QuantitySelectorComponent } from '../../../components/quantity-selector/quantity-selector.component';
import { BadgeComponent } from '../../../components/badge/badge.component';
import { PurchaseSummaryModalComponent } from '../components/purchase-summary-modal.component';
import { DrawerModule } from 'primeng/drawer';
import { OrderPreviewComponent } from '../../orders/order-preview/order-preview.component';
import { PurchaseThankYouModalComponent } from '../../../components/purchase-thank-you-modal/purchase-thank-you-modal.component';
import { InvoiceModalComponent } from '../../../components/invoice-modal/invoice-modal.component';

type WalletType = 'cash' | 'voucher';

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
  private orderService = inject(OrderService);
  private messageService = inject(MessageService);
  private dialogService = inject(DialogService);
  private thankYouService = inject(PurchaseThankYouService);

  product = signal<Product | null>(null);
  selectedWallet = signal<WalletType>('voucher');
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

  readonly walletOptions = [
    { type: 'voucher' as WalletType, label: 'Product Voucher' },
  ];

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
      const firstPayWallet = this.walletOptions.find((w) => p.eligibleWallets.includes(w.type))?.type;
      if (firstPayWallet) {
        this.selectedWallet.set(firstPayWallet);
      }
    });
  }

  onWalletChange(wallet: WalletType): void {
    const p = this.product();
    if (p?.eligibleWallets.includes(wallet)) {
      this.selectedWallet.set(wallet);
    }
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
      showHeader: false,
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
      deliveryFee:
        fulfilmentDetails.fulfilmentOption === 'delivery'
          ? fulfilmentDetails.deliveryFee
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
            this.cleanupLingeringDrawerMask();
            this.openPurchaseThankYou(order.id, orderData, fulfilmentDetails);
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
        const errMsg = err?.error?.message ?? '';
        const friendlyMsg = errMsg.toLowerCase().includes('no active price') || errMsg.toLowerCase().includes('no effective price')
          ? 'This product is not available for purchase yet.'
          : (err?.error?.message ?? 'Could not create order. Please try again.');

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
    } catch (e) {
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

  private openPurchaseThankYou(
    orderId: string,
    orderData: { product: Product; quantity: number; wallet: WalletType },
    fulfilmentDetails: { fulfilmentOption: string },
  ): void {
    const buildSummary = (order: Order | undefined): PurchaseThankYouSummary => ({
      orderId,
      orderReference: order?.reference ?? orderId,
      paymentId: order?.paymentId,
      productName: orderData.product.name,
      quantity: orderData.quantity,
      paymentMethod: this.formatWalletLabel(orderData.wallet),
      amount: order?.total ?? orderData.product.price * orderData.quantity,
      currency: order?.currency ?? 'NGN',
      fulfilmentLabel:
        fulfilmentDetails.fulfilmentOption === 'pickup' ? 'Pickup' : 'Home Delivery',
      totalPv: orderData.product.pv * orderData.quantity,
    });

    const showModal = (order: Order | undefined): void => {
      this.pendingOrderData.set(null);
      this.thankYouService.open(buildSummary(order), () => {
        void this.router.navigate(['/orders']);
      });
    };

    this.orderService.getOrderById(orderId, true).subscribe((order) => {
      if (order?.paymentId) {
        showModal(order);
        return;
      }

      window.setTimeout(() => {
        this.orderService.getOrderById(orderId, true).subscribe((retried) => {
          showModal(retried ?? order);
        });
      }, 500);
    });
  }

  private formatWalletLabel(wallet: WalletType): string {
    if (wallet === 'voucher') return 'Product Voucher';
    return 'Cash Wallet';
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
