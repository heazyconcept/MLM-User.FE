import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { describe, beforeEach, it, expect, afterEach } from 'vitest';
import { firstValueFrom } from 'rxjs';

import { LegacyClubService } from './legacy-club.service';
import { LegacyCartService } from './legacy-cart.service';
import { UserService, User } from './user.service';
import { ApiService } from './api.service';
import { legacyClubMockStore } from '../core/mocks/legacy-club.mock';
import {
  LEGACY_ERROR_CODES,
  humanizeLegacyCashoutLedgerDescription,
  resolveLegacyCashoutTransferTarget,
} from '../core/models/legacy-club.models';
import { LEGACY_CLUB_USE_MOCKS } from '../core/tokens/legacy-club.tokens';
import { environment } from '../../environments/environment';

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

  it('registers a successline from sponsor registration wallet', async () => {
    legacyClubMockStore.seedActive({ package: 'VIP', cashoutBalance: 20000 });
    await firstValueFrom(service.loadMe());
    const beforeBalance = legacyClubMockStore.getRegistrationWalletBalance();

    const res = await firstValueFrom(
      service.registerSuccessline({
        username: 'ready_user',
        package: 'VIP',
        requestKey: crypto.randomUUID(),
      }),
    );

    expect(res.username).toBe('ready_user');
    expect(res.legacyStatus).toBe('ACTIVE');
    expect(res.package).toBe('VIP');
    expect(legacyClubMockStore.getRegistrationWalletBalance()).toBe(beforeBalance - 60000);

    const me = await firstValueFrom(service.loadMe());
    expect(me?.directSuccesslineCount).toBe(1);

    const successlines = await firstValueFrom(service.getSuccesslines());
    expect(successlines.successlines.some((row) => row.username === 'ready_user')).toBe(true);
  });

  it('rejects successline register when registration wallet is insufficient', async () => {
    legacyClubMockStore.seedActive({ package: 'VIP' });
    legacyClubMockStore.setRegistrationWalletBalance(1000);
    await firstValueFrom(service.loadMe());

    await expect(
      firstValueFrom(
        service.registerSuccessline({
          username: 'ready_user',
          package: 'VIP',
          requestKey: crypto.randomUUID(),
        }),
      ),
    ).rejects.toMatchObject({
      code: LEGACY_ERROR_CODES.INSUFFICIENT_BALANCE,
    });

    const successlines = await firstValueFrom(service.getSuccesslines());
    expect(successlines.successlines).toHaveLength(0);
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

  it('credits Legacy product voucher when transfer target is AUTOSHIP', async () => {
    legacyClubMockStore.seedActive({ cashoutBalance: 20000 });
    await firstValueFrom(service.loadMe());
    const voucherBefore = service.me()?.legacyVoucher?.balance ?? 0;
    const cashoutBefore = service.me()?.legacyCashout?.balance ?? 0;

    await firstValueFrom(
      service.transferCashout({
        toWalletType: 'AUTOSHIP',
        amount: 4000,
        currency: 'NGN',
        pin: '1234',
      }),
    );
    await firstValueFrom(service.loadMe());
    const voucher = await firstValueFrom(service.getVoucher());
    const cashout = await firstValueFrom(service.getCashout());

    expect(cashout.balance).toBe(cashoutBefore - 4000);
    expect(voucher.balance).toBe(voucherBefore + 4000);
    expect(cashout.items[0]?.description).toBe('Move to Legacy product voucher');
    expect(cashout.items[0]?.type).toBe('Debit');
  });
});

describe('resolveLegacyCashoutTransferTarget', () => {
  it('maps AUTOSHIP to LEGACY_VOUCHER', () => {
    expect(resolveLegacyCashoutTransferTarget('AUTOSHIP')).toBe('LEGACY_VOUCHER');
    expect(resolveLegacyCashoutTransferTarget('CASH')).toBe('CASH');
    expect(resolveLegacyCashoutTransferTarget('LEGACY_VOUCHER')).toBe('LEGACY_VOUCHER');
  });

  it('humanizes legacy cashout ledger descriptions', () => {
    expect(humanizeLegacyCashoutLedgerDescription('Move to AUTOSHIP')).toBe(
      'Move to Legacy product voucher',
    );
    expect(humanizeLegacyCashoutLedgerDescription('Move to LEGACY_VOUCHER')).toBe(
      'Move to Legacy product voucher',
    );
  });
});

describe('LegacyClubService (API)', () => {
  let service: LegacyClubService;
  let httpMock: HttpTestingController;
  const baseUrl = environment.apiUrl;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: LEGACY_CLUB_USE_MOCKS, useValue: false },
        LegacyClubService,
        ApiService,
        {
          provide: UserService,
          useValue: {
            isPaid: () => true,
            currentUser: () => mockUser(),
            user: () => mockUser(),
          },
        },
      ],
    });
    service = TestBed.inject(LegacyClubService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('maps legacyPv from GET /legacy/me', () => {
    service.loadMe().subscribe();
    const req = httpMock.expectOne(`${baseUrl}/legacy/me`);
    req.flush({
      status: 'ACTIVE',
      currency: 'NGN',
      legacyPv: {
        totalPv: 45,
        personalProductPv: 30,
        directReferralProductPv: 15,
      },
    });
    expect(service.me()?.legacyPv).toEqual({
      totalPv: 45,
      personalProductPv: 30,
      directReferralProductPv: 15,
    });
  });

  it('loads GET /legacy/pv/history', () => {
    service.getPvHistory({ limit: 20 }).subscribe((res) => {
      expect(res.items).toHaveLength(1);
      expect(res.items[0].kind).toBe('OWN_PURCHASE');
      expect(res.items[0].pvAmount).toBe(30);
    });
    const req = httpMock.expectOne((r) => r.url.startsWith(`${baseUrl}/legacy/pv/history`));
    expect(req.request.params.get('limit')).toBe('20');
    req.flush({
      items: [
        {
          id: 'pv-1',
          kind: 'OWN_PURCHASE',
          pvAmount: 30,
          at: '2026-09-23T12:00:00.000Z',
          orderId: 'order-1',
          productSummary: 'Tea × 2',
        },
      ],
      nextCursor: null,
    });
  });

  it('posts legacy/successlines/register', () => {
    service
      .registerSuccessline({
        username: 'hisgrace',
        package: 'VIP',
        requestKey: '550e8400-e29b-41d4-a716-446655440000',
      })
      .subscribe((res) => {
        expect(res.username).toBe('hisgrace');
        expect(res.legacyStatus).toBe('ACTIVE');
      });

    const req = httpMock.expectOne(`${baseUrl}/legacy/successlines/register`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({
      username: 'hisgrace',
      package: 'VIP',
      requestKey: '550e8400-e29b-41d4-a716-446655440000',
    });
    req.flush({
      data: {
        username: 'hisgrace',
        package: 'VIP',
        legacyStatus: 'ACTIVE',
        sponsorUsername: 'demo_member',
        sponsorSource: 'AUTO',
        joinedAt: '2026-09-24T10:30:00.000Z',
        instantCommission: 20000,
        successlineBonus: 2000,
        currency: 'NGN',
      },
    });

    const meReq = httpMock.expectOne(`${baseUrl}/legacy/me`);
    meReq.flush({ status: 'ACTIVE', currency: 'NGN' });
  });

  it('posts LEGACY_VOUCHER when transferCashout target is AUTOSHIP', () => {
    service
      .transferCashout({
        toWalletType: 'AUTOSHIP',
        amount: 4000,
        currency: 'NGN',
        pin: '1234',
      })
      .subscribe();

    const req = httpMock.expectOne(`${baseUrl}/legacy/cashout/transfer`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body.toWalletType).toBe('LEGACY_VOUCHER');
    req.flush({ transferId: 'tr-1' });

    const meReq = httpMock.expectOne(`${baseUrl}/legacy/me`);
    meReq.flush({ status: 'ACTIVE', currency: 'NGN' });
  });
});
