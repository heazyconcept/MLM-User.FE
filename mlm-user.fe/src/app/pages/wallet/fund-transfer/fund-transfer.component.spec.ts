import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { AuthService } from '../../../services/auth.service';
import { ModalService } from '../../../services/modal.service';
import { UserService } from '../../../services/user.service';
import { WalletService } from '../../../services/wallet.service';
import { FundTransferComponent } from './fund-transfer.component';

describe('FundTransferComponent transaction PIN gate', () => {
  function create(hasTransactionPin: boolean) {
    TestBed.configureTestingModule({
      imports: [FundTransferComponent],
      providers: [
        provideRouter([]),
        {
          provide: UserService,
          useValue: {
            currentUser: signal({
              username: 'member',
              hasTransactionPin,
            }),
            displayCurrency: signal('NGN'),
          },
        },
        {
          provide: WalletService,
          useValue: {
            allWallets: signal([]),
            fetchWallets: vi.fn().mockReturnValue(of([])),
            isCashWalletLocked: vi.fn().mockReturnValue(false),
          },
        },
        {
          provide: AuthService,
          useValue: { impersonation: signal(null) },
        },
        {
          provide: ModalService,
          useValue: { open: vi.fn() },
        },
      ],
    });

    const fixture = TestBed.createComponent(FundTransferComponent);
    fixture.detectChanges();
    return fixture;
  }

  it('links users without a PIN to the Profile setup form', () => {
    const fixture = create(false);
    const link = fixture.nativeElement.querySelector(
      '[data-testid="fund-transfer-pin-setup-link"]',
    ) as HTMLAnchorElement | null;

    expect(link).not.toBeNull();
    expect(link?.getAttribute('href')).toContain('/profile');
    expect(link?.getAttribute('href')).toContain('pinAction=setup');
    expect(fixture.nativeElement.textContent).not.toContain('Save PIN');
  });

  it('keeps the authorization PIN field for configured users', () => {
    const fixture = create(true);

    expect(fixture.nativeElement.textContent).toContain('Transaction PIN');
    expect(fixture.nativeElement.querySelector('#transferPin')).not.toBeNull();
  }, 15_000);
});
