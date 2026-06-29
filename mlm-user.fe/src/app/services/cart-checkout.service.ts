import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, of, switchMap, tap, delay, map } from 'rxjs';
import { Order, OrderService } from './order.service';
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

export interface FulfilmentDetails {
  fulfilmentOption: 'pickup' | 'delivery';
  selectedPickupId?: string | null;
  deliveryAddress?: string;
  deliveryState?: string;
  deliveryFee?: number;
}

@Injectable({ providedIn: 'root' })
export class CartCheckoutService {
  private orderService = inject(OrderService);
  private cartService = inject(CartService);
  private thankYouService = inject(PurchaseThankYouService);
  private router = inject(Router);

  submitOrder(
    orderData: PendingCheckoutData,
    fulfilmentDetails: FulfilmentDetails,
  ): Observable<Order> {
    const isPickup = fulfilmentDetails.fulfilmentOption === 'pickup';
    const items =
      orderData.mode === 'cart'
        ? orderData.items.map((line) => ({
            productId: line.productId,
            quantity: line.quantity,
          }))
        : [{ productId: orderData.product.id, quantity: orderData.quantity }];

    const payload = {
      items,
      paymentMethod: 'WALLET' as const,
      fulfilmentMode: isPickup ? ('PICKUP' as const) : ('OFFLINE_DELIVERY' as const),
      selectedMerchantId: isPickup ? fulfilmentDetails.selectedPickupId ?? undefined : undefined,
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

    const wallet = orderData.wallet;

    return this.orderService.createOrder(payload).pipe(
      switchMap((order) =>
        this.orderService.payOrderWithWallet(order.id, wallet).pipe(
          tap(() => {
            if (orderData.mode === 'cart') {
              this.cartService.clear();
            }
          }),
          switchMap(() => this.fetchOrderWithPaymentRetry(order.id, order)),
        ),
      ),
      tap((order) => {
        this.thankYouService.open(this.buildThankYouSummary(order, orderData, fulfilmentDetails), () => {
          void this.router.navigate(['/orders']);
        });
      }),
    );
  }

  private fetchOrderWithPaymentRetry(orderId: string, fallback: Order): Observable<Order> {
    return this.orderService.getOrderById(orderId, true).pipe(
      switchMap((order) => {
        if (order?.paymentId) return of(order);
        return of(order ?? fallback).pipe(
          delay(500),
          switchMap(() => this.orderService.getOrderById(orderId, true)),
          map((retried) => retried ?? order ?? fallback),
        );
      }),
    );
  }

  buildThankYouSummary(
    order: Order,
    orderData: PendingCheckoutData,
    fulfilmentDetails: FulfilmentDetails,
  ): PurchaseThankYouSummary {
    const wallet = orderData.wallet;
    const orderItems = order.items.length
      ? order.items.map((item) => ({ name: item.name, quantity: item.quantity }))
      : orderData.mode === 'cart'
        ? orderData.items.map((line) => ({
            name: line.product.name,
            quantity: line.quantity,
          }))
        : [{ name: orderData.product.name, quantity: orderData.quantity }];

    const itemCount = orderItems.reduce((sum, item) => sum + item.quantity, 0);
    const totalPv =
      order.items.length > 0
        ? order.items.reduce((sum, item) => sum + item.pv * item.quantity, 0)
        : orderData.mode === 'cart'
          ? orderData.items.reduce((sum, line) => sum + line.product.pv * line.quantity, 0)
          : orderData.product.pv * orderData.quantity;

    const firstItem = orderItems[0];

    return {
      orderId: order.id,
      orderReference: order.reference ?? order.id,
      paymentId: order.paymentId,
      productName: firstItem?.name ?? 'Order',
      quantity: firstItem?.quantity ?? itemCount,
      items: orderItems.length > 1 ? orderItems : undefined,
      itemCount,
      paymentMethod: this.formatWalletLabel(wallet),
      amount: order.total,
      currency: order.currency ?? 'NGN',
      fulfilmentLabel:
        fulfilmentDetails.fulfilmentOption === 'pickup' ? 'Pickup' : 'Home Delivery',
      totalPv,
    };
  }

  formatWalletLabel(wallet: CheckoutWalletType): string {
    if (wallet === 'voucher') return 'Product Voucher';
    return 'Cash Wallet';
  }
}
