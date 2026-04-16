import { Component, inject, OnInit, ChangeDetectionStrategy, signal, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { PaymentService } from '../../services/payment.service';
import { UserService } from '../../services/user.service';
import { WalletService } from '../../services/wallet.service';

const PAYMENT_FLOW_KEY = 'mlm_payment_flow';
const WALLET_FUNDING_FLOW = 'wallet_funding';
const REGISTRATION_FUNDING_FLOW = 'registration_funding';
/** Set by RegistrationFundingComponent when funding from a contextual flow (e.g. Create Referral). */
const REGISTRATION_FUND_RETURN_PATH_KEY = 'mlm_registration_fund_return_path';

@Component({
  selector: 'app-payment-callback',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './payment-callback.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PaymentCallbackComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private paymentService = inject(PaymentService);
  private userService = inject(UserService);
  private walletService = inject(WalletService);


  status = signal<'verifying' | 'success' | 'error'>('verifying');
  errorMessage = signal<string>('');
  successMessage = signal<string>('Your registration is now complete. Redirecting you...');
  isWalletFunding = signal(false);
  isRegistrationFunding = signal(false);

  private cdr = inject(ChangeDetectorRef);

  ngOnInit(): void {
    const queryParams = this.route.snapshot.queryParamMap;
    const reference = queryParams.get('reference') ?? queryParams.get('trxref');
    if (!reference) {
      this.status.set('error');
      this.errorMessage.set('No payment reference found. Please try again from the registration flow.');
      this.cdr.markForCheck();
      return;
    }

    // Detect flow type before verification
    if (typeof sessionStorage !== 'undefined') {
      const paymentFlow = sessionStorage.getItem(PAYMENT_FLOW_KEY);
      if (paymentFlow === WALLET_FUNDING_FLOW) {
        this.isWalletFunding.set(true);
      } else if (paymentFlow === REGISTRATION_FUNDING_FLOW) {
        this.isRegistrationFunding.set(true);
      }
    }

    this.paymentService.verifyPayment(reference).subscribe({
      next: () => {
        this.status.set('success');
        this.cdr.markForCheck();
        if (typeof sessionStorage !== 'undefined') {
          sessionStorage.removeItem('mlm_registration_payment_reference');
          const paymentFlow = sessionStorage.getItem(PAYMENT_FLOW_KEY);
          sessionStorage.removeItem(PAYMENT_FLOW_KEY);

          if (paymentFlow === WALLET_FUNDING_FLOW || paymentFlow === REGISTRATION_FUNDING_FLOW) {
            const msg = paymentFlow === WALLET_FUNDING_FLOW
              ? 'Your wallet has been credited. Redirecting you...'
              : 'Your registration wallet has been funded. Redirecting you...';
            this.successMessage.set(msg);
            this.cdr.markForCheck();
            this.walletService.fetchWallets().subscribe();
            setTimeout(() => {
              if (paymentFlow === REGISTRATION_FUNDING_FLOW && typeof sessionStorage !== 'undefined') {
                const returnPath = sessionStorage.getItem(REGISTRATION_FUND_RETURN_PATH_KEY);
                sessionStorage.removeItem(REGISTRATION_FUND_RETURN_PATH_KEY);
                if (returnPath?.startsWith('/')) {
                  void this.router.navigateByUrl(
                    `${returnPath}?registrationFunded=true`
                  );
                  return;
                }
              }
              void this.router.navigate(['/wallet'], { queryParams: { funded: 'true' } });
            }, 1500);
            return;
          }
        }

        this.successMessage.set('Payment received. Click Activate to complete your registration.');
        this.cdr.markForCheck();
        this.userService.fetchProfile().subscribe({
          next: () => {
            setTimeout(() => this.router.navigate(['/auth/activation']), 2500);
          },
          error: () => {
            setTimeout(() => this.router.navigate(['/auth/activation']), 2500);
          }
        });
      },
      error: (err) => {
        if (typeof ngDevMode !== 'undefined' && ngDevMode) {
          console.error('[PaymentCallback] verifyPayment failed:', err?.status, err?.error);
        }
        this.status.set('error');
        this.errorMessage.set('We could not verify your payment. Please try again or contact support.');
        this.cdr.markForCheck();
      }
    });
  }
}
