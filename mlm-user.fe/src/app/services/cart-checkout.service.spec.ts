import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { of } from 'rxjs';

import { CartCheckoutService } from './cart-checkout.service';
import { CartService } from './cart.service';
import { OrderService } from './order.service';
import { PurchaseThankYouService } from './purchase-thank-you.service';

describe('CartCheckoutService', () => {
  it('forwards canonical geography and enforces voucher batch payment', () => {
    const orderService = {
      checkoutBatch: vi.fn().mockReturnValue(
        of({
          checkoutId: 'checkout-1',
          orders: [
            {
              id: 'order-1',
              reference: 'ORD-1',
              fulfilmentMode: 'PICKUP',
              totalAmount: 1000,
              items: [{ productId: 'product-1', quantity: 1 }],
            },
          ],
          grandTotal: 1000,
        }),
      ),
      payCheckoutWithWallet: vi.fn().mockReturnValue(of({ paidOrderIds: ['order-1'] })),
      getOrderById: vi.fn().mockReturnValue(
        of({
          id: 'order-1',
          paymentId: 'payment-1',
          currency: 'NGN',
          items: [],
        }),
      ),
    };
    const cartService = { clear: vi.fn() };
    const thankYouService = { open: vi.fn() };

    TestBed.configureTestingModule({
      providers: [
        CartCheckoutService,
        { provide: OrderService, useValue: orderService },
        { provide: CartService, useValue: cartService },
        { provide: PurchaseThankYouService, useValue: thankYouService },
        { provide: Router, useValue: { navigate: vi.fn() } },
      ],
    });

    const service = TestBed.inject(CartCheckoutService);
    const groups = [
      {
        fulfilmentMode: 'PICKUP' as const,
        selectedMerchantId: 'merchant-1',
        items: [{ productId: 'product-1', quantity: 1 }],
      },
    ];

    service
      .submitCheckoutBatch(
        {
          mode: 'cart',
          wallet: 'cash',
          items: [
            {
              productId: 'product-1',
              quantity: 1,
              product: { id: 'product-1', name: 'Wine', price: 1000, pv: 10 },
            } as never,
          ],
        },
        {
          countryCode: 'NG',
          subdivisionCode: 'LA',
          state: 'Lagos',
          groups,
        },
      )
      .subscribe();

    expect(orderService.checkoutBatch).toHaveBeenCalledWith({
      countryCode: 'NG',
      subdivisionCode: 'LA',
      state: 'Lagos',
      paymentMethod: 'WALLET',
      idempotencyKey: expect.any(String),
      groups,
    });
    expect(orderService.payCheckoutWithWallet).toHaveBeenCalledWith('checkout-1', 'voucher');
    expect(cartService.clear).toHaveBeenCalled();
  });
});
