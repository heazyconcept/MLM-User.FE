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
  function create(tab: string | null = null) {
    const router = { navigate: vi.fn() };

    TestBed.configureTestingModule({
      imports: [TransactionsComponent],
      providers: [
        {
          provide: DashboardService,
          useValue: { getTransactions: vi.fn().mockReturnValue(of({ items: [] })) },
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
    return { component: fixture.componentInstance, router };
  }

  it('does not list Autoship as a transaction tab', () => {
    const { component } = create();

    expect(component.tabOptions.map((option) => option.label)).not.toContain('Autoship');
  });

  it('redirects the legacy autoship tab URL to the Dashboard section', () => {
    const { router } = create('autoship');

    expect(router.navigate).toHaveBeenCalledWith(['/dashboard'], { fragment: 'autoship' });
  });
});
