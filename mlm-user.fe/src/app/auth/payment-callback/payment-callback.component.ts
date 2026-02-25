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
