import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { ConfirmationService } from 'primeng/api';
import { CaucusCashoutComponent } from './caucus-cashout.component';
import { AuthService } from '../../../services/auth.service';
import { CaucusService } from '../../../services/caucus.service';
import { CashoutPolicyService } from '../../../services/cashout-policy.service';
import { ModalService } from '../../../services/modal.service';
import { OnboardingService } from '../../../services/onboarding.service';
import { UserService } from '../../../services/user.service';

describe('CaucusCashoutComponent confirm gate', () => {
  it('opens confirm dialog before withdraw API', () => {
    const confirm = vi.fn();
    const withdraw = vi.fn().mockReturnValue(
      of({
        netAmount: 9500,
        feeAmount: 500,
      }),
    );

    TestBed.configureTestingModule({
      imports: [CaucusCashoutComponent],
      providers: [
        provideRouter([{ path: 'caucus', redirectTo: '' }]),
        { provide: AuthService, useValue: { impersonation: signal(null) } },
        {
          provide: UserService,
          useValue: {
            currentUser: signal({
              hasTransactionPin: true,
              bankName: 'Test Bank',
              accountNumber: '0123456789',
              accountName: 'Member',
            }),
          },
        },
        {
          provide: CaucusService,
          useValue: {
            me: signal({
              wallet: { balanceNgn: 10000 },
            }),
            loadMe: vi.fn().mockReturnValue(of({ wallet: { balanceNgn: 10000 } })),
            withdraw,
          },
        },
        { provide: ModalService, useValue: { open: vi.fn() } },
        { provide: OnboardingService, useValue: { getBankDetails: vi.fn().mockReturnValue(of({})) } },
        {
          provide: CashoutPolicyService,
          useValue: {
            getPolicy: vi.fn().mockReturnValue(
              of({
                feeRate: 0.05,
                voucherLimitNgn: 10000,
                voucherBalanceNgn: 0,
                canCashout: true,
                blockReason: null,
                payoutNotice: 'Notice',
              }),
            ),
          },
        },
      ],
    });

    TestBed.overrideComponent(CaucusCashoutComponent, {
      set: { providers: [{ provide: ConfirmationService, useValue: { confirm } }] },
    });

    const fixture = TestBed.createComponent(CaucusCashoutComponent);
    fixture.detectChanges();

    const component = fixture.componentInstance;
    component.amount.set(10000);
    component.pin.set('1234');
    component.submit();

    expect(confirm).toHaveBeenCalledTimes(1);
    expect(withdraw).not.toHaveBeenCalled();

    const accept = confirm.mock.calls[0][0].accept as () => void;
    accept();

    expect(withdraw).toHaveBeenCalledWith(10000, '1234');
  });
});
