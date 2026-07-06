import {
  Component,
  inject,
  signal,
  computed,
  OnDestroy,
  ChangeDetectionStrategy,
  effect,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { DialogService } from 'primeng/dynamicdialog';
import { DrawerModule } from 'primeng/drawer';
import { MessageService } from 'primeng/api';
import { CartService } from '../../../services/cart.service';
import {
  CartCheckoutService,
  CheckoutConfirmPayload,
  PendingCheckoutData,
} from '../../../services/cart-checkout.service';
import { QuantitySelectorComponent } from '../../../components/quantity-selector/quantity-selector.component';
import { PurchaseSummaryModalComponent } from '../components/purchase-summary-modal.component';
import { OrderPreviewComponent } from '../../orders/order-preview/order-preview.component';
import { PurchaseThankYouModalComponent } from '../../../components/purchase-thank-you-modal/purchase-thank-you-modal.component';
import { InvoiceModalComponent } from '../../../components/invoice-modal/invoice-modal.component';
import { formatCatalogPrice } from '../../../core/utils/product-catalog.util';

@Component({
  selector: 'app-cart-page',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    DrawerModule,
    QuantitySelectorComponent,
    OrderPreviewComponent,
    PurchaseThankYouModalComponent,
    InvoiceModalComponent,
  ],
  templateUrl: './cart-page.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CartPageComponent implements OnDestroy {
  private cartService = inject(CartService);
  private checkoutService = inject(CartCheckoutService);
  private dialogService = inject(DialogService);
  private messageService = inject(MessageService);

  items = this.cartService.items;
  subtotal = this.cartService.subtotal;
  totalPv = this.cartService.totalPv;
  isEmpty = this.cartService.isEmpty;
  hasUnavailableItems = this.cartService.hasUnavailableItems;

  fulfilmentDrawerVisible = signal(false);
  pendingOrderData = signal<PendingCheckoutData | null>(null);
  orderSubmitting = signal(false);

  canCheckout = computed(
    () => !this.isEmpty() && !this.hasUnavailableItems() && !this.orderSubmitting(),
  );

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

  onQuantityChange(productId: string, value: number): void {
    const result = this.cartService.updateQuantity(productId, value);
    if (!result.success && result.message) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Quantity update',
        detail: result.message,
        life: 3000,
      });
    }
  }

  onRemove(productId: string): void {
    this.cartService.removeItem(productId);
  }

  onProceedToCheckout(): void {
    if (!this.canCheckout()) return;

    const ref = this.dialogService.open(PurchaseSummaryModalComponent, {
      data: {
        mode: 'cart',
        items: this.items(),
        selectedWallet: 'voucher',
      },
      showHeader: false,
      width: '90vw',
      style: { maxWidth: '480px' },
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

  submitOrder(payload: CheckoutConfirmPayload): void {
    const orderData = this.pendingOrderData();
    if (!orderData) return;

    if (payload.groups.length === 0) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Checkout incomplete',
        detail: 'Please complete fulfilment options before confirming.',
      });
      return;
    }

    this.orderSubmitting.set(true);
    this.checkoutService.submitCheckoutBatch(orderData, payload).subscribe({
      next: () => {
        this.orderSubmitting.set(false);
        this.fulfilmentDrawerVisible.set(false);
        this.pendingOrderData.set(null);
        this.cleanupLingeringDrawerMask();
      },
      error: (err) => {
        this.orderSubmitting.set(false);
        console.error('Cart checkout failed', err);
        const errMsg = err?.error?.message ?? '';
        const friendlyMsg =
          errMsg.toLowerCase().includes('no active price') ||
          errMsg.toLowerCase().includes('no effective price')
            ? 'This product is not available for purchase yet.'
            : (errMsg || 'Could not complete order. Please try again.');
        this.messageService.add({
          severity: 'error',
          summary: 'Order failed',
          detail: friendlyMsg,
        });
      },
    });
  }

  onDrawerVisibleChange(visible: boolean): void {
    this.fulfilmentDrawerVisible.set(visible);
    if (!visible) {
      this.cleanupLingeringDrawerMask();
    }
  }

  formatCurrency(amount: number, currency: 'NGN' | 'USD' = 'NGN'): string {
    return formatCatalogPrice(amount, currency);
  }

  cartCurrency(): 'NGN' | 'USD' {
    return this.items()[0]?.product.currency ?? 'NGN';
  }

  isLineUnavailable(line: { product: { purchasable: boolean } }): boolean {
    return !line.product.purchasable;
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
