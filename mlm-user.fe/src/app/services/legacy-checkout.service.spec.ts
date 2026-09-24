import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { of, throwError } from 'rxjs';

import { LEGACY_ERROR_CODES } from '../core/models/legacy-club.models';
import { CartCheckoutService } from './cart-checkout.service';
import { LegacyCartService } from './legacy-cart.service';
import { LegacyClubService } from './legacy-club.service';
import { LegacyCheckoutService } from './legacy-checkout.service';
import { ModalService } from './modal.service';
import { OrderService } from './order.service';
import { PurchaseThankYouService } from './purchase-thank-you.service';
import { UserService } from './user.service';

describe('LegacyCheckoutService', () => {
  const groups = [
    {
      fulfilmentMode: 'PICKUP' as const,
      selectedMerchantId: 'merchant-1',
      items: [{ productId: 'product-1', quantity: 1 }],
    },
  ];
  const orderData = {
    mode: 'cart' as const,
    wallet: 'legacy_voucher' as const,
    items: [
      {
        productId: 'product-1',
        quantity: 1,
        product: { id: 'product-1', name: 'Legacy Tea', price: 5000, pv: 10 },
      } as never,
    ],
  };
  const payload = {
    countryCode: 'NG',
    subdivisionCode: 'LA',
    state: 'Lagos',
    groups,
  };

  const checkoutResponse = {
    checkoutId: 'checkout-1',
    orders: [
      {
        id: 'order-1',
        reference: 'ORD-LEG-1',
        fulfilmentMode: 'PICKUP' as const,
        totalAmount: 5000,
        items: [{ productId: 'product-1', quantity: 1 }],
      },
    ],
    grandTotal: 5000,
  };

  function create(overrides?: {
    clearFails?: boolean;
    canCheckout?: boolean;
  }) {
    const orderService = {
      checkoutBatch: vi.fn().mockReturnValue(of(checkoutResponse)),
      payCheckoutWithWallet: vi.fn().mockReturnValue(of({ paidOrderIds: ['order-1'] })),
      getOrderById: vi.fn().mockReturnValue(
        of({
          id: 'order-1',
          paymentId: 'payment-1',
          currency: 'NGN',
          items: [{ name: 'Legacy Tea', quantity: 1, pv: 10 }],
        }),
      ),
    };
    const legacyCart = {
      canCheckout: () => overrides?.canCheckout !== false,
      clear: overrides?.clearFails
        ? vi.fn().mockReturnValue(throwError(() => new Error('clear failed')))
        : vi.fn().mockReturnValue(of(undefined)),
      subtotal: () => 5000,
    };
    const legacyClub = {
      loadMe: vi.fn().mockReturnValue(of({})),
      getMonths: vi.fn().mockReturnValue(of({ months: [] })),
    };
    const thankYouSummary = {
      orderId: 'order-1',
      orderReference: 'ORD-LEG-1',
      paymentMethod: 'Legacy product voucher',
      amount: 5000,
      currency: 'NGN' as const,
      productName: 'Legacy Tea',
      quantity: 1,
      fulfilmentLabel: 'Pickup',
      totalPv: 10,
    };
    const cartCheckout = {
      fetchFirstPaidOrderWithRetry: vi.fn().mockReturnValue(
        of({
          id: 'order-1',
          paymentId: 'payment-1',
          currency: 'NGN',
          items: [{ name: 'Legacy Tea', quantity: 1, pv: 10 }],
        }),
      ),
      buildThankYouSummary: vi.fn().mockReturnValue(thankYouSummary),
    };
    const thankYouService = { open: vi.fn() };
    const modalService = { open: vi.fn() };
    const router = { navigate: vi.fn() };
    const userService = {
      needsProfileSetup: () => false,
      currentUser: () => ({ isProfileComplete: true, profileMissingFields: [] }),
    };

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        LegacyCheckoutService,
        { provide: OrderService, useValue: orderService },
        { provide: LegacyCartService, useValue: legacyCart },
        { provide: LegacyClubService, useValue: legacyClub },
        { provide: CartCheckoutService, useValue: cartCheckout },
        { provide: PurchaseThankYouService, useValue: thankYouService },
        { provide: UserService, useValue: userService },
        { provide: ModalService, useValue: modalService },
        { provide: Router, useValue: router },
      ],
    });

    return {
      service: TestBed.inject(LegacyCheckoutService),
      orderService,
      legacyCart,
      cartCheckout,
      thankYouService,
      modalService,
      router,
      thankYouSummary,
    };
  }

  it('opens receipt modal with legacy payment label and Done navigates to /legacy/home', () => {
    const { service, orderService, legacyCart, thankYouService, router, thankYouSummary } =
      create();

    service.submitLegacyCheckout(orderData, payload).subscribe();

    expect(orderService.checkoutBatch).toHaveBeenCalledWith(
      expect.objectContaining({
        channel: 'LEGACY',
        countryCode: 'NG',
        paymentMethod: 'WALLET',
        groups,
      }),
    );
    expect(orderService.payCheckoutWithWallet).toHaveBeenCalledWith(
      'checkout-1',
      'LEGACY_VOUCHER',
    );
    expect(legacyCart.clear).toHaveBeenCalled();
    expect(thankYouService.open).toHaveBeenCalledWith(
      thankYouSummary,
      expect.any(Function),
    );

    const doneCallback = thankYouService.open.mock.calls[0][1] as () => void;
    doneCallback();
    expect(router.navigate).toHaveBeenCalledWith(['/legacy/home']);
  });

  it('still opens receipt modal when cart clear fails after successful payment', () => {
    const { service, thankYouService, modalService } = create({ clearFails: true });

    service.submitLegacyCheckout(orderData, payload).subscribe();

    expect(thankYouService.open).toHaveBeenCalled();
    expect(modalService.open).not.toHaveBeenCalledWith(
      'error',
      'Checkout failed',
      expect.any(String),
    );
  });

  it('rejects checkout when cart is below package minimum', () => {
    const { service, orderService, thankYouService } = create({ canCheckout: false });

    let failed = false;
    service.submitLegacyCheckout(orderData, payload).subscribe({
      error: (err) => {
        failed = true;
        expect(err.code).toBe(LEGACY_ERROR_CODES.LEGACY_CART_BELOW_PACKAGE);
      },
    });

    expect(failed).toBe(true);
    expect(orderService.checkoutBatch).not.toHaveBeenCalled();
    expect(thankYouService.open).not.toHaveBeenCalled();
  });
});
