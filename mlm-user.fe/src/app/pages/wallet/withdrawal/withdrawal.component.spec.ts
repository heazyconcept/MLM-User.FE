import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { ConfirmationService } from 'primeng/api';
import { DialogService, DynamicDialogConfig, DynamicDialogRef } from 'primeng/dynamicdialog';
import { of } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { ModalService } from '../../../services/modal.service';
import { OnboardingService } from '../../../services/onboarding.service';
import { UserService } from '../../../services/user.service';
import { WalletService } from '../../../services/wallet.service';
import { WithdrawalComponent } from './withdrawal.component';

describe('WithdrawalComponent transaction PIN gate', () => {
  it('closes the dialog and links users without a PIN to Profile setup', () => {
    const close = vi.fn();
    const navigate = vi.fn();

    TestBed.configureTestingModule({
      imports: [WithdrawalComponent],
      providers: [
        {
          provide: DynamicDialogConfig,
          useValue: { data: { currency: 'NGN' } },
        },
        { provide: DynamicDialogRef, useValue: { close } },
        {
          provide: Router,
          useValue: { navigate },
        },
        {
          provide: UserService,
          useValue: {
            currentUser: signal({
              hasTransactionPin: false,
              bankName: 'Test Bank',
              accountNumber: '0123456789',
              accountName: 'Test Member',
            }),
            updateProfile: vi.fn(),
          },
        },
        {
          provide: WalletService,
          useValue: {
            getWallet: vi.fn().mockReturnValue(signal({ cashBalance: 1000 })),
          },
        },
        {
          provide: OnboardingService,
          useValue: {
            getBankDetails: vi.fn().mockReturnValue(of({})),
          },
        },
        {
          provide: ConfirmationService,
          useValue: { confirm: vi.fn() },
        },
        {
          provide: DialogService,
          useValue: { open: vi.fn() },
        },
        {
          provide: ModalService,
          useValue: { open: vi.fn() },
        },
      ],
    });

    const fixture = TestBed.createComponent(WithdrawalComponent);
    fixture.detectChanges();
    const button = fixture.nativeElement.querySelector(
      '[data-testid="withdrawal-pin-setup-link"]',
    ) as HTMLButtonElement | null;

    expect(button).not.toBeNull();
    expect(fixture.nativeElement.textContent).not.toContain('New 4-Digit PIN');

    button?.click();

    expect(close).toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledWith(['/profile'], {
      queryParams: { pinAction: 'setup' },
      fragment: 'transaction-pin',
    });
  }, 15_000);
});
