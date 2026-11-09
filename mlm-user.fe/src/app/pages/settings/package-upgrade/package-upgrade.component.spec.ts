import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { LoadingService } from '../../../services/loading.service';
import { ModalService } from '../../../services/modal.service';
import { PaymentService } from '../../../services/payment.service';
import { UserService } from '../../../services/user.service';
import { PackageUpgradeComponent } from './package-upgrade.component';

describe('PackageUpgradeComponent registration wallet', () => {
  it('upgrades from the registration wallet', () => {
    const initiateUpgradePayment = vi.fn().mockReturnValue(
      of({ reference: 'ref-wallet', amount: 15000, currency: 'NGN' }),
    );
    const fetchProfile = vi.fn().mockReturnValue(of({ package: 'SILVER' }));

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
            fetchProfile,
          },
        },
        {
          provide: PaymentService,
          useValue: {
            fetchUpgradeOptions: vi.fn().mockReturnValue(
              of([
                {
                  package: 'SILVER',
                  price: 15000,
                  currency: 'NGN',
                  currentPackage: false,
                },
              ]),
            ),
            initiateUpgradePayment,
          },
        },
        { provide: ModalService, useValue: { open: vi.fn() } },
      ],
    });

    const fixture = TestBed.createComponent(PackageUpgradeComponent);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Upgrade to Silver');
    expect(fixture.nativeElement.textContent).not.toContain('Difference to pay');
    expect(fixture.nativeElement.textContent).not.toContain('Product voucher credit');
    expect(
      fixture.componentInstance.providerOptions().some((option) => option.value === 'REGISTRATION_WALLET'),
    ).toBe(true);

    const upgrade = Array.from(fixture.nativeElement.querySelectorAll('button')).find((node) =>
      (node as HTMLButtonElement).textContent?.includes('Upgrade to Silver'),
    ) as HTMLButtonElement;
    upgrade.click();
    fixture.detectChanges();

    const pay = Array.from(fixture.nativeElement.querySelectorAll('button, .p-button')).find((node) =>
      (node as HTMLElement).textContent?.includes('Pay from Registration Wallet'),
    ) as HTMLElement;
    pay.click();
    fixture.detectChanges();

    expect(initiateUpgradePayment).toHaveBeenCalledWith('SILVER', undefined, 'REGISTRATION_WALLET');
    expect(fetchProfile).toHaveBeenCalled();
  });
});
