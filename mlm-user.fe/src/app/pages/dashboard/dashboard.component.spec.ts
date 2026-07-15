import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { EMPTY, of } from 'rxjs';
import { DialogService } from 'primeng/dynamicdialog';

import { ActivityService } from '../../services/activity.service';
import { CommissionService } from '../../services/commission.service';
import { DashboardService } from '../../services/dashboard.service';
import { EarningsService } from '../../services/earnings.service';
import { LoadingService } from '../../services/loading.service';
import { MerchantService } from '../../services/merchant.service';
import { ModalService } from '../../services/modal.service';
import { NotificationService } from '../../services/notification.service';
import { PaymentService } from '../../services/payment.service';
import { RegistrationService } from '../../services/registration.service';
import { UserService } from '../../services/user.service';
import { WalletService } from '../../services/wallet.service';
import { DashboardComponent } from './dashboard.component';

describe('DashboardComponent autoship transactions', () => {
  it('loads a separate Autoship transaction feed', () => {
    const firstAutoshipTransaction = {
      id: 'autoship-1',
      date: '2026-07-15T10:00:00Z',
      description: 'First autoship renewal',
      type: 'Debit' as const,
      amount: 100,
      currency: 'NGN' as const,
      status: 'Completed' as const,
    };
    const secondAutoshipTransaction = {
      ...firstAutoshipTransaction,
      id: 'autoship-2',
      description: 'Second autoship renewal',
    };
    const getTransactions = vi
      .fn()
      .mockImplementation(
        (_limit: number, cursor?: string, query?: { category?: string }) => {
          if (query?.category !== 'autoship') {
            return of({ items: [], nextCursor: null });
          }
          return cursor
            ? of({ items: [secondAutoshipTransaction], nextCursor: null })
            : of({
                items: Array.from({ length: 10 }, (_, index) => ({
                  ...firstAutoshipTransaction,
                  id: `autoship-${index + 1}`,
                })),
                nextCursor: 'autoship-cursor-2',
              });
        },
      );
    const emptySummary = signal({
      totalEarnings: 0,
      directReferralBonus: 0,
      communityBonus: 0,
      productBonus: 0,
      matchingBonus: 0,
      directReferrals: 0,
    });

    TestBed.configureTestingModule({
      imports: [DashboardComponent],
      providers: [
        {
          provide: Router,
          useValue: { url: '/dashboard', events: EMPTY, navigate: vi.fn() },
        },
        {
          provide: UserService,
          useValue: {
            isPaid: signal(true),
            paymentStatus: signal('PAID'),
            currentUser: signal({ package: 'NICKEL', currency: 'NGN' }),
            displayCurrency: signal('NGN'),
            fetchProfile: vi.fn().mockReturnValue(of({})),
          },
        },
        { provide: PaymentService, useValue: {} },
        {
          provide: CommissionService,
          useValue: {
            getSummary: vi.fn().mockReturnValue(emptySummary),
          },
        },
        {
          provide: EarningsService,
          useValue: { fetchEarningsSectionData: vi.fn() },
        },
        {
          provide: WalletService,
          useValue: {
            getWallet: vi.fn().mockReturnValue(signal(null)),
            fetchWallets: vi.fn().mockReturnValue(of([])),
          },
        },
        { provide: LoadingService, useValue: { isLoading: signal(false) } },
        { provide: ModalService, useValue: { open: vi.fn() } },
        {
          provide: ActivityService,
          useValue: { getRecentActivities: vi.fn().mockReturnValue(signal([])) },
        },
        {
          provide: NotificationService,
          useValue: { unreadCount: signal(0) },
        },
        {
          provide: DashboardService,
          useValue: {
            getOverview: vi.fn().mockReturnValue(of(null)),
            getTransactions,
          },
        },
        { provide: RegistrationService, useValue: {} },
        { provide: DialogService, useValue: {} },
        {
          provide: MerchantService,
          useValue: {
            profile: signal(null),
            fetchProfile$: vi.fn().mockReturnValue(of(null)),
            clearError: vi.fn(),
          },
        },
      ],
    });
    const fixture = TestBed.createComponent(DashboardComponent);
    fixture.detectChanges();

    expect(getTransactions).toHaveBeenCalledWith(10, undefined, { category: 'autoship' });
    expect(fixture.nativeElement.textContent).toContain('First autoship renewal');
    expect(
      fixture.nativeElement.querySelector('[aria-label="Select autoship rows per page"]'),
    ).not.toBeNull();
    expect(fixture.nativeElement.textContent).toContain('Showing 1–10 of 10 autoship transactions');

    const nextButton = fixture.nativeElement.querySelector(
      '[aria-label="Next autoship page"]',
    ) as HTMLButtonElement | null;
    expect(nextButton).not.toBeNull();
    nextButton?.click();
    fixture.detectChanges();

    expect(getTransactions).toHaveBeenCalledWith(10, 'autoship-cursor-2', {
      category: 'autoship',
    });
    expect(fixture.nativeElement.textContent).toContain('Second autoship renewal');
    expect(fixture.nativeElement.textContent).toContain('Showing 11–11 of 11 autoship transactions');

    const previousButton = fixture.nativeElement.querySelector(
      '[aria-label="Previous autoship page"]',
    ) as HTMLButtonElement;
    const callsBeforePrevious = getTransactions.mock.calls.length;
    previousButton.click();
    fixture.detectChanges();

    expect(getTransactions).toHaveBeenCalledTimes(callsBeforePrevious);
    expect(fixture.nativeElement.textContent).toContain('First autoship renewal');
  });
});
