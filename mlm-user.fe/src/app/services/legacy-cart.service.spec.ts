import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { describe, beforeEach, it, expect, afterEach } from 'vitest';
import { firstValueFrom } from 'rxjs';

import { LegacyCartService } from './legacy-cart.service';
import { LegacyClubService } from './legacy-club.service';
import { ApiService } from './api.service';
import { UserService, User } from './user.service';
import { legacyClubMockStore } from '../core/mocks/legacy-club.mock';
import { environment } from '../../environments/environment';
import { OrderService } from './order.service';
import { LEGACY_CLUB_USE_MOCKS } from '../core/tokens/legacy-club.tokens';

function mockUser(): User {
  return {
    id: 'user-1',
    username: 'demo_member',
    email: 'demo@example.com',
    firstName: 'Demo',
    lastName: 'Member',
    paymentStatus: 'PAID',
    profileCompletionPercentage: 100,
  };
}

describe('LegacyCartService (mocks)', () => {
  let cart: LegacyCartService;
  let club: LegacyClubService;
  const isPaidSignal = signal(true);
  const userSignal = signal<User | null>(mockUser());

  beforeEach(() => {
    legacyClubMockStore.reset();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: LEGACY_CLUB_USE_MOCKS, useValue: true },
        LegacyCartService,
        LegacyClubService,
        ApiService,
        {
          provide: UserService,
          useValue: {
            isPaid: isPaidSignal.asReadonly(),
            currentUser: userSignal.asReadonly(),
            user: userSignal.asReadonly(),
          },
        },
      ],
    });
    cart = TestBed.inject(LegacyCartService);
    club = TestBed.inject(LegacyClubService);
  });

  afterEach(() => legacyClubMockStore.reset());

  it('computes remaining and canCheckout from package floor', async () => {
    await firstValueFrom(club.loadMe());
    await firstValueFrom(club.startJoin('VIP'));
    await firstValueFrom(cart.setQuantity('legacy-prod-1', 2));
    expect(cart.subtotal()).toBe(30000);
    expect(cart.remaining()).toBe(30000);
    expect(cart.canCheckout()).toBe(false);

    await firstValueFrom(cart.setQuantity('legacy-prod-3', 1));
    expect(cart.subtotal()).toBe(75000);
    expect(cart.remaining()).toBe(0);
    expect(cart.canCheckout()).toBe(true);
  });
});

describe('OrderService Legacy pay hooks', () => {
  let service: OrderService;
  let httpMock: HttpTestingController;
  const baseUrl = environment.apiUrl;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), OrderService, ApiService],
    });
    service = TestBed.inject(OrderService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('sends channel=LEGACY on checkout when provided', () => {
    service
      .checkoutBatch({
        channel: 'LEGACY',
        countryCode: 'NG',
        subdivisionCode: 'LA',
        state: 'Lagos',
        paymentMethod: 'WALLET',
        groups: [],
      })
      .subscribe();

    const req = httpMock.expectOne(`${baseUrl}/orders/checkout`);
    expect(req.request.body.channel).toBe('LEGACY');
    req.flush({ checkoutId: 'c1', orders: [], grandTotal: 0 });
  });

  it('pays with walletType LEGACY_VOUCHER', () => {
    service.payCheckoutWithWallet('checkout-1', 'LEGACY_VOUCHER').subscribe();
    const req = httpMock.expectOne(`${baseUrl}/orders/checkout/checkout-1/pay-wallet`);
    expect(req.request.body).toEqual({ walletType: 'LEGACY_VOUCHER' });
    req.flush({ paidOrderIds: ['o1'] });
  });
});
