import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { of, throwError } from 'rxjs';

import { PROFILE_INCOMPLETE_CODE, PROFILE_SETUP_PATH } from '../core/utils/profile-complete.util';
import { CartCheckoutService } from './cart-checkout.service';
import { CartService } from './cart.service';
import { ModalService } from './modal.service';
import { OrderService } from './order.service';
import { PurchaseThankYouService } from './purchase-thank-you.service';
import { UserService } from './user.service';

describe('CartCheckoutService', () => {
  const groups = [
    {
      fulfilmentMode: 'PICKUP' as const,
      selectedMerchantId: 'merchant-1',
      items: [{ productId: 'product-1', quantity: 1 }],
    },
  ];
  const orderData = {
    mode: 'cart' as const,
    wallet: 'cash' as const,
    items: [
      {
        productId: 'product-1',
        quantity: 1,
        product: { id: 'product-1', name: 'Wine', price: 1000, pv: 10 },
      } as never,
    ],
  };
  const payload = {
    countryCode: 'NG',
    subdivisionCode: 'LA',
    state: 'Lagos',
    groups,
  };

  function create(overrides?: {
    needsProfileSetup?: boolean;
    checkoutBatch?: ReturnType<typeof vi.fn>;
  }) {
    const orderService = {
      checkoutBatch:
        overrides?.checkoutBatch ??
        vi.fn().mockReturnValue(
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
    const modalService = { open: vi.fn() };
    const router = { navigate: vi.fn() };
    const userService = {
      needsProfileSetup: () => overrides?.needsProfileSetup === true,
      currentUser: () =>
        overrides?.needsProfileSetup
          ? { isProfileComplete: false, profileMissingFields: ['phone'] }
          : { isProfileComplete: true, profileMissingFields: [] },
    };

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        CartCheckoutService,
        { provide: OrderService, useValue: orderService },
        { provide: CartService, useValue: cartService },
        { provide: PurchaseThankYouService, useValue: thankYouService },
        { provide: UserService, useValue: userService },
        { provide: ModalService, useValue: modalService },
        { provide: Router, useValue: router },
      ],
    });

    return {
      service: TestBed.inject(CartCheckoutService),
      orderService,
      cartService,
      modalService,
      router,
    };
  }

  it('forwards canonical geography and enforces voucher batch payment', () => {
    const { service, orderService, cartService } = create();

    service.submitCheckoutBatch(orderData, payload).subscribe();

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

  it('blocks checkout and prompts profile setup when the profile is incomplete', () => {
    const { service, orderService, modalService, router } = create({
      needsProfileSetup: true,
    });

    let failed = false;
    service.submitCheckoutBatch(orderData, payload).subscribe({
      error: (err) => {
        failed = true;
        expect(err.code).toBe(PROFILE_INCOMPLETE_CODE);
      },
    });

    expect(failed).toBe(true);
    expect(orderService.checkoutBatch).not.toHaveBeenCalled();
    expect(modalService.open).toHaveBeenCalledWith(
      'warning',
      'Complete your profile',
      expect.stringContaining('phone number'),
      PROFILE_SETUP_PATH,
      'Update profile',
    );
    expect(router.navigate).toHaveBeenCalledWith([PROFILE_SETUP_PATH], {
      queryParams: { setup: 'complete' },
    });
  });

  it('prompts profile setup when checkout returns PROFILE_INCOMPLETE', () => {
    const { service, modalService, router } = create({
      checkoutBatch: vi.fn().mockReturnValue(
        throwError(
          () =>
            new HttpErrorResponse({
              status: 400,
              error: {
                code: PROFILE_INCOMPLETE_CODE,
                message: 'Complete your profile before placing an order.',
                missingFields: ['phone', 'address'],
              },
            }),
        ),
      ),
    });

    service.submitCheckoutBatch(orderData, payload).subscribe({ error: () => undefined });

    expect(modalService.open).toHaveBeenCalled();
    expect(router.navigate).toHaveBeenCalledWith([PROFILE_SETUP_PATH], {
      queryParams: { setup: 'complete' },
    });
  });
});
