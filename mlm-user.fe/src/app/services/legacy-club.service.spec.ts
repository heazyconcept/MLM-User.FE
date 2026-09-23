import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { describe, beforeEach, it, expect, afterEach } from 'vitest';
import { firstValueFrom } from 'rxjs';

import { LegacyClubService } from './legacy-club.service';
import { LegacyCartService } from './legacy-cart.service';
import { UserService, User } from './user.service';
import { ApiService } from './api.service';
import { legacyClubMockStore } from '../core/mocks/legacy-club.mock';
import { LEGACY_ERROR_CODES } from '../core/models/legacy-club.models';
import { LEGACY_CLUB_USE_MOCKS } from '../core/tokens/legacy-club.tokens';

function mockUser(overrides: Partial<User> = {}): User {
  return {
    id: 'user-1',
    username: 'demo_member',
    email: 'demo@example.com',
    firstName: 'Demo',
    lastName: 'Member',
    paymentStatus: 'PAID',
    profileCompletionPercentage: 100,
    ...overrides,
  };
}

describe('LegacyClubService (mocks)', () => {
  let service: LegacyClubService;
  let cart: LegacyCartService;
  const userSignal = signal<User | null>(mockUser());
  const isPaidSignal = signal(true);

  beforeEach(() => {
    legacyClubMockStore.reset();
    userSignal.set(mockUser());
    isPaidSignal.set(true);

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: LEGACY_CLUB_USE_MOCKS, useValue: true },
        LegacyClubService,
        LegacyCartService,
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
    service = TestBed.inject(LegacyClubService);
    cart = TestBed.inject(LegacyCartService);
  });

  afterEach(() => {
    legacyClubMockStore.reset();
  });

  it('shows menu for paid users in mock mode', () => {
    expect(service.menuVisible()).toBe(true);
    isPaidSignal.set(false);
    expect(service.menuVisible()).toBe(false);
  });

  it('AUTO join omits username and creates PENDING_JOIN', async () => {
    const me = await firstValueFrom(service.loadMe());
    expect(me?.sponsorResolution).toBe('AUTO');
    await firstValueFrom(service.startJoin('VIP'));
    const after = await firstValueFrom(service.loadMe());
    expect(after?.status).toBe('PENDING_JOIN');
    expect(after?.pendingJoin?.package).toBe('VIP');
    expect(after?.pendingJoin?.sponsorUsername).toBe('ada');
    expect(after?.pendingJoin?.sponsorSource).toBe('AUTO');
  });

  it('AUTO join rejects a different sponsor username', async () => {
    await firstValueFrom(service.loadMe());
    await expect(firstValueFrom(service.startJoin('VIP', 'bode'))).rejects.toMatchObject({
      code: LEGACY_ERROR_CODES.SPONSOR_MUST_BE_AUTO,
    });
  });

  it('MANUAL join validates sponsor and rejects self', async () => {
    legacyClubMockStore.reset({ sponsorResolution: 'MANUAL' });
    await firstValueFrom(service.loadMe());
    await expect(firstValueFrom(service.validateSponsor('demo_member'))).rejects.toMatchObject({
      code: LEGACY_ERROR_CODES.SPONSOR_SELF,
    });
    const ok = await firstValueFrom(service.validateSponsor('ada'));
    expect(ok.valid).toBe(true);
    await firstValueFrom(service.startJoin('EXECUTIVE', 'ada'));
    const after = await firstValueFrom(service.loadMe());
    expect(after?.pendingJoin?.sponsorSource).toBe('CHOSEN');
  });

  it('creates pendingPayment on join and activates via wallet pay', async () => {
    await firstValueFrom(service.loadMe());
    await firstValueFrom(service.startJoin('VIP'));
    const pending = await firstValueFrom(service.loadMe());
    expect(pending?.pendingPayment?.purpose).toBe('JOIN');
    expect(pending?.pendingPayment?.paymentRequired).toBe(60000);

    await firstValueFrom(
      service.payWithWallet({ purpose: 'JOIN', requestKey: crypto.randomUUID() }),
    );
    const me = await firstValueFrom(service.loadMe());
    expect(me?.status).toBe('ACTIVE');
    expect(me?.legacyCashout?.balance).toBe(20000);
    expect(me?.instantReceived).toBe(20000);
    expect(me?.canCashoutLegacy).toBe(true);
    expect(me?.shopMode).toBe('SHOP');
  });

  it('rejects network VOUCHER on Legacy product checkout', async () => {
    legacyClubMockStore.seedActive();
    await firstValueFrom(service.loadMe());
    await firstValueFrom(cart.setQuantity('legacy-prod-1', 1));
    await expect(legacyClubMockStore.checkoutAndPay('VOUCHER')).rejects.toMatchObject({
      code: LEGACY_ERROR_CODES.LEGACY_VOUCHER_REQUIRED,
    });
  });

  it('allows cashout with zero Successlines', async () => {
    legacyClubMockStore.seedActive({ package: 'VIP' });
    await firstValueFrom(service.loadMe());
    const cashout = await firstValueFrom(service.getCashout());
    expect(cashout.canCashoutLegacy).toBe(true);
    expect(cashout.directSuccesslineCount).toBe(0);
    await firstValueFrom(
      service.withdrawCashout({ amount: 5000, currency: 'NGN', pin: '1234' }),
    );
    const after = await firstValueFrom(service.getCashout());
    expect(after.balance).toBe(15000);
  });

  it('allows Legacy shop checkout when shopMode is SHOP', async () => {
    legacyClubMockStore.seedActive();
    await firstValueFrom(service.loadMe());
    expect(service.shopMode()).toBe('SHOP');
    await firstValueFrom(cart.refresh());
    expect(cart.isEmpty()).toBe(true);
    expect(cart.canCheckout()).toBe(false);

    await firstValueFrom(cart.setQuantity('legacy-prod-1', 1));
    expect(cart.canCheckout()).toBe(true);
    expect(service.me()?.cycle?.cycleWeeks).toBe(24);
    expect(service.isWeeklyCycle()).toBe(true);
  });
});
