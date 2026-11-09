import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { LoadingService } from '../../../services/loading.service';
import { ModalService } from '../../../services/modal.service';
import { PaymentService, type UpgradeOptionsResult } from '../../../services/payment.service';
import { UserService } from '../../../services/user.service';
import { PackageUpgradeComponent } from './package-upgrade.component';

const liveOptions: UpgradeOptionsResult = {
  currentPackage: 'NICKEL',
  registrationWalletBalance: 20000,
  currency: 'NGN',
  options: [
    {
      package: 'SILVER',
      price: 15000,
      ipvCredit: 15000,
      currency: 'NGN',
      currentPackage: false,
      newEarningsRate: 10,
    },
    {
      package: 'GOLD',
      price: 110000,
      ipvCredit: 105000,
      currency: 'NGN',
      currentPackage: false,
      newEarningsRate: 12,
    },
  ],
};

describe('PackageUpgradeComponent', () => {
  function setup(result: UpgradeOptionsResult | Error) {
    const fetchUpgradeOptions = vi
      .fn()
      .mockReturnValue(result instanceof Error ? throwError(() => result) : of(result));
    const initiateUpgradePayment = vi
      .fn()
      .mockReturnValue(of({ reference: 'ref-wallet', amount: 15000, currency: 'NGN' }));

    TestBed.configureTestingModule({
      imports: [PackageUpgradeComponent],
      providers: [
        provideRouter([]),
        LoadingService,
        {
          provide: UserService,
          useValue: {
            currentUser: signal({ package: 'NICKEL' }),
            displayCurrency: signal('NGN'),
            fetchProfile: vi.fn().mockReturnValue(of({ package: 'SILVER' })),
          },
        },
        {
          provide: PaymentService,
          useValue: { fetchUpgradeOptions, initiateUpgradePayment },
        },
        {
          provide: ModalService,
          useValue: { open: vi.fn() },
        },
      ],
    });

    const fixture = TestBed.createComponent(PackageUpgradeComponent);
    fixture.detectChanges();
    return { fixture, initiateUpgradePayment };
  }

  it('shows the API difference and registration wallet, not the full catalog price', () => {
    const { fixture, initiateUpgradePayment } = setup(liveOptions);
    const text = fixture.nativeElement.textContent as string;

    expect(text).toContain('Upgrade to Silver — ₦15,000');
    expect(text).toContain('Upgrade to Gold — ₦110,000');
    expect(text).toContain('Product voucher credit ₦15,000');
    expect(text).toContain('Registration wallet ₦20,000');
    expect(fixture.nativeElement.querySelector('[data-testid="upgrade-price-NICKEL"]')).toBeNull();

    const silver = fixture.nativeElement.querySelector(
      '[data-testid="upgrade-action-SILVER"]',
    ) as HTMLButtonElement;
    silver.click();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Pay from Registration Wallet');
    const pay = Array.from(fixture.nativeElement.querySelectorAll('button, .p-button')).find(
      (node) => (node as HTMLElement).textContent?.includes('Pay from Registration Wallet'),
    ) as HTMLElement | undefined;
    pay?.click();
    fixture.detectChanges();

    expect(initiateUpgradePayment).toHaveBeenCalledWith('SILVER', undefined, 'REGISTRATION_WALLET');
  });

  it('does not offer payment when upgrade prices fail to load', () => {
    const { fixture } = setup(new Error('offline'));

    expect(fixture.nativeElement.textContent).toContain('Could not load upgrade prices');
    expect(fixture.nativeElement.querySelector('[data-testid="upgrade-action-SILVER"]')).toBeNull();
    expect(fixture.nativeElement.textContent).not.toContain('₦35,000');
    expect(fixture.nativeElement.textContent).not.toContain('₦130,000');
  });
});
