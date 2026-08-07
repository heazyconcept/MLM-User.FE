import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { of } from 'rxjs';

import { CommissionService } from '../../services/commission.service';
import { DashboardService } from '../../services/dashboard.service';
import { EarningsService } from '../../services/earnings.service';
import { InvoiceService } from '../../services/invoice.service';
import { UserService } from '../../services/user.service';
import { TransactionsComponent } from './transactions.component';

describe('TransactionsComponent', () => {
  function create(tab: string | null = null, getTransactions = vi.fn().mockReturnValue(of({ items: [] }))) {
    const router = { navigate: vi.fn() };

    TestBed.configureTestingModule({
      imports: [TransactionsComponent],
      providers: [
        {
          provide: DashboardService,
          useValue: { getTransactions },
        },
        {
          provide: CommissionService,
          useValue: { getAllCommissions: () => signal([]) },
        },
        {
          provide: EarningsService,
          useValue: {
            isLoading: signal(false),
            error: signal(null),
            fetchEarningsSectionData: vi.fn(),
          },
        },
        {
          provide: UserService,
          useValue: { isPaid: signal(true), displayCurrency: signal('NGN') },
        },
        { provide: InvoiceService, useValue: {} },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              queryParamMap: {
                get: (key: string) => (key === 'tab' ? tab : null),
              },
            },
          },
        },
        { provide: Router, useValue: router },
      ],
    });
    TestBed.overrideComponent(TransactionsComponent, { set: { template: '' } });

    const fixture = TestBed.createComponent(TransactionsComponent);
    fixture.detectChanges();
    return { component: fixture.componentInstance, router, getTransactions };
  }

  it('does not list Autoship as a transaction tab', () => {
    const { component } = create();

    expect(component.tabOptions.map((option) => option.label)).not.toContain('Autoship');
  });

  it('includes Transfers tab', () => {
    const { component } = create();

    expect(component.tabOptions.map((option) => option.label)).toContain('Transfers');
    expect(component.tabOptions.find((option) => option.value === 'transfers')).toBeDefined();
  });

  it('loads transactions with category=transfers when Transfers tab is selected', () => {
    const getTransactions = vi.fn().mockReturnValue(of({ items: [] }));
    const { component } = create(null, getTransactions);

    getTransactions.mockClear();
    component.onTabChange('transfers');

    expect(getTransactions).toHaveBeenCalledWith(
      expect.any(Number),
      undefined,
      { category: 'transfers' },
    );
  });

  it('formats WALLET_TRANSFER and FUND_TRANSFER category labels', () => {
    const { component } = create();

    expect(
      component.formatTransactionCategory({
        id: '1',
        date: '2026-08-07',
        description: 'Transfer to registration wallet',
        type: 'Debit',
        amount: 1000,
        currency: 'NGN',
        status: 'Completed',
        category: 'WALLET_TRANSFER',
        categoryGroup: 'TRANSFERS',
      }),
    ).toBe('Wallet transfer');

    expect(
      component.formatTransactionCategory({
        id: '2',
        date: '2026-08-07',
        description: 'Fund transfer to @TADEX',
        type: 'Debit',
        amount: 500,
        currency: 'NGN',
        status: 'Completed',
        category: 'FUND_TRANSFER',
        categoryGroup: 'TRANSFERS',
      }),
    ).toBe('Fund transfer');
  });

  it('redirects the legacy autoship tab URL to the Dashboard section', () => {
    const { router } = create('autoship');

    expect(router.navigate).toHaveBeenCalledWith(['/dashboard'], { fragment: 'autoship' });
  });
});
