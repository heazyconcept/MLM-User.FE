import { Component, inject, OnInit, ChangeDetectionStrategy, signal, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { PaymentService } from '../../services/payment.service';
import { UserService } from '../../services/user.service';
import { WalletService } from '../../services/wallet.service';

const PAYMENT_FLOW_KEY = 'mlm_payment_flow';
const WALLET_FUNDING_FLOW = 'wallet_funding';

@Component({
  selector: 'app-payment-callback',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <div class="flex min-h-screen bg-white items-center justify-center px-6">
      <div class="w-full max-w-md text-center">
        @if (status() === 'verifying') {
          <div class="mb-6">
            <i class="pi pi-spin pi-spinner text-5xl text-mlm-primary"></i>
          </div>
          <h1 class="text-xl font-semibold text-slate-900 mb-2">Verifying your payment</h1>
          <p class="text-slate-500">Please wait while we confirm your registration payment.</p>
        } @else if (status() === 'success') {
          <div class="mb-6">
            <i class="pi pi-check-circle text-5xl text-green-500"></i>
          </div>
          <h1 class="text-xl font-semibold text-slate-900 mb-2">Payment verified</h1>
          <p class="text-slate-500 mb-6">{{ successMessage() }}</p>
        } @else if (status() === 'error') {
          <div class="mb-6">
            <i class="pi pi-times-circle text-5xl text-red-500"></i>
          </div>
          <h1 class="text-xl font-semibold text-slate-900 mb-2">Verification failed</h1>
          <p class="text-slate-500 mb-6">{{ errorMessage() }}</p>
          <a routerLink="/onboarding/profile" class="text-mlm-primary font-semibold hover:underline">
            Continue to complete your profile
          </a>
        }
      </div>
    </div>
  `,
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

  private cdr = inject(ChangeDetectorRef);

  ngOnInit(): void {
    const reference = this.route.snapshot.queryParamMap.get('reference');
    if (!reference) {
      this.status.set('error');
      this.errorMessage.set('No payment reference found. Please try again from the registration flow.');
      this.cdr.markForCheck();
      return;
    }

    this.paymentService.verifyPayment(reference).subscribe({
      next: () => {
        this.status.set('success');
        this.cdr.markForCheck();
        if (typeof sessionStorage !== 'undefined') {
          sessionStorage.removeItem('mlm_registration_payment_reference');
          const paymentFlow = sessionStorage.getItem(PAYMENT_FLOW_KEY);
          sessionStorage.removeItem(PAYMENT_FLOW_KEY);

          if (paymentFlow === WALLET_FUNDING_FLOW) {
            this.successMessage.set('Your wallet has been credited. Redirecting you...');
            this.cdr.markForCheck();
            this.walletService.fetchWallets().subscribe();
            setTimeout(() => this.router.navigate(['/wallet']), 1500);
            return;
          }
        }

        this.userService.fetchProfile().subscribe({
          next: () => {
            const redirectPath = this.userService.onboardingComplete()
              ? '/dashboard'
              : '/onboarding/profile';
            setTimeout(() => this.router.navigate([redirectPath]), 1500);
          },
          error: (err) => {
            if (typeof ngDevMode !== 'undefined' && ngDevMode) {
              console.error('[PaymentCallback] fetchProfile after verify failed:', err);
            }
            const redirectPath = this.userService.onboardingComplete()
              ? '/dashboard'
              : '/onboarding/profile';
            setTimeout(() => this.router.navigate([redirectPath]), 1500);
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
