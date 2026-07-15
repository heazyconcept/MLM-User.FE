import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, of, switchMap, tap, delay, map } from 'rxjs';
import {
  CheckoutGroup,
  CheckoutResponse,
  Order,
  OrderService,
} from './order.service';
import { CartLineItem, CartService } from './cart.service';
import { Product } from './product.service';
import {
  PurchaseThankYouService,
  PurchaseThankYouSummary,
} from './purchase-thank-you.service';

export type CheckoutWalletType = 'cash' | 'voucher';

export interface SingleCheckoutData {
  mode: 'single';
  product: Product;
  quantity: number;
  wallet: CheckoutWalletType;
}

export interface CartCheckoutData {
  mode: 'cart';
  items: CartLineItem[];
  wallet: CheckoutWalletType;
}

export type PendingCheckoutData = SingleCheckoutData | CartCheckoutData;

export interface CheckoutConfirmPayload {
  countryCode: string;
  subdivisionCode: string;
  state: string;
  groups: CheckoutGroup[];
}

@Injectable({ providedIn: 'root' })
export class CartCheckoutService {
  private orderService = inject(OrderService);
  private cartService = inject(CartService);
  private thankYouService = inject(PurchaseThankYouService);
  private router = inject(Router);

  submitCheckoutBatch(
    orderData: PendingCheckoutData,
    payload: CheckoutConfirmPayload,
  ): Observable<CheckoutResponse> {
    const wallet = orderData.wallet;
    const idempotencyKey = crypto.randomUUID();

    return this.orderService
      .checkoutBatch({
        countryCode: payload.countryCode,
        subdivisionCode: payload.subdivisionCode,
        state: payload.state,
        paymentMethod: 'WALLET',
        idempotencyKey,
        groups: payload.groups,
      })
      .pipe(
        switchMap((checkout) =>
          this.orderService.payCheckoutWithWallet(checkout.checkoutId, 'voucher').pipe(
            tap(() => {
              if (orderData.mode === 'cart') {
                this.cartService.clear();
              }
            }),
            switchMap(() => this.fetchFirstPaidOrderWithRetry(checkout)),
            map((firstOrder) => ({ checkout, firstOrder })),
          ),
        ),
        tap(({ checkout, firstOrder }) => {
          this.thankYouService.open(
            this.buildThankYouSummary(checkout, firstOrder, orderData, payload),
            () => {
              void this.router.navigate(['/orders']);
            },
          );
        }),
        map(({ checkout }) => checkout),
      );
  }

  private fetchFirstPaidOrderWithRetry(
    checkout: CheckoutResponse,
  ): Observable<Order | undefined> {
    const firstId = checkout.orders[0]?.id;
    if (!firstId) return of(undefined);

    return this.orderService.getOrderById(firstId, true).pipe(
      switchMap((order) => {
        if (order?.paymentId) return of(order);
        return of(order).pipe(
          delay(500),
          switchMap(() => this.orderService.getOrderById(firstId, true)),
        );
      }),
    );
  }

  buildThankYouSummary(
    checkout: CheckoutResponse,
    firstOrder: Order | undefined,
    orderData: PendingCheckoutData,
    payload: CheckoutConfirmPayload,
  ): PurchaseThankYouSummary {
    const wallet = orderData.wallet;
    const orderItems = this.resolveLineItems(orderData);
    const itemCount = orderItems.reduce((sum, item) => sum + item.quantity, 0);
    const totalPv = this.resolveTotalPv(orderData, firstOrder);
    const firstItem = orderItems[0];
    const orderReferences = checkout.orders.map((o) => o.reference ?? o.id);
    const hasPickup = payload.groups.some((g) => g.fulfilmentMode === 'PICKUP');
    const hasDelivery = payload.groups.some((g) => g.fulfilmentMode === 'OFFLINE_DELIVERY');

    let fulfilmentLabel = 'Pickup';
    if (hasPickup && hasDelivery) {
      fulfilmentLabel = 'Split pickup & delivery';
    } else if (hasDelivery) {
      fulfilmentLabel = 'Home Delivery';
    } else if (checkout.orders.length > 1) {
      fulfilmentLabel = `Pickup (${checkout.orders.length} orders)`;
    }

    return {
      orderId: firstOrder?.id ?? checkout.orders[0]?.id ?? checkout.checkoutId,
      orderReference: orderReferences[0] ?? checkout.checkoutId,
      orderReferences: orderReferences.length > 1 ? orderReferences : undefined,
      checkoutId: checkout.checkoutId,
      paymentId: firstOrder?.paymentId,
      productName: firstItem?.name ?? 'Order',
      quantity: firstItem?.quantity ?? itemCount,
      items: orderItems.length > 1 ? orderItems : undefined,
      itemCount,
      paymentMethod: this.formatWalletLabel(wallet),
      amount: checkout.grandTotal,
      currency: firstOrder?.currency ?? 'NGN',
      fulfilmentLabel,
      totalPv,
    };
  }

  private resolveLineItems(
    orderData: PendingCheckoutData,
  ): { name: string; quantity: number }[] {
    if (orderData.mode === 'cart') {
      return orderData.items.map((line) => ({
        name: line.product.name,
        quantity: line.quantity,
      }));
    }
    return [{ name: orderData.product.name, quantity: orderData.quantity }];
  }

  private resolveTotalPv(orderData: PendingCheckoutData, firstOrder?: Order): number {
    if (firstOrder?.items.length) {
      return firstOrder.items.reduce((sum, item) => sum + item.pv * item.quantity, 0);
    }
    if (orderData.mode === 'cart') {
      return orderData.items.reduce((sum, line) => sum + line.product.pv * line.quantity, 0);
    }
    return orderData.product.pv * orderData.quantity;
  }

  formatWalletLabel(wallet: CheckoutWalletType): string {
    if (wallet === 'voucher') return 'Product Voucher';
    return 'Cash Wallet';
  }
}
