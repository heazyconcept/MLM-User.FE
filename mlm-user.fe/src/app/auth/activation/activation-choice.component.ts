import { Component, inject, ChangeDetectionStrategy, signal, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { MessageModule } from 'primeng/message';
import { PaymentService } from '../../services/payment.service';
import { UserService } from '../../services/user.service';

@Component({
  selector: 'app-activation-choice',
  standalone: true,
  imports: [CommonModule, RouterModule, ButtonModule, CardModule, MessageModule],
  templateUrl: './activation-choice.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ActivationChoiceComponent {
  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef);
  private paymentService = inject(PaymentService);
  private userService = inject(UserService);

  payingOnline = signal(false);
  usingWallet = signal(false);
  errorMessage = signal<string | null>(null);

  onPayOnline(): void {
    if (this.payingOnline()) return;
    this.payingOnline.set(true);
    this.errorMessage.set(null);
    this.cdr.markForCheck();

    const user = this.userService.currentUser();
    const packageName = user?.package ?? 'SILVER';
    const currency = user?.currency ?? 'NGN';
    const callbackUrl = typeof window !== 'undefined'
      ? `${window.location.origin}/auth/payment/callback`
      : undefined;

    this.paymentService.initiateRegistrationPayment(packageName, currency, callbackUrl).subscribe({
      next: (res) => {
        this.payingOnline.set(false);
        this.cdr.markForCheck();
        const gatewayUrl = res.authorizationUrl ?? res.gatewayUrl;
        if (gatewayUrl) {
          window.location.href = gatewayUrl;
        } else if (res.reference) {
          this.router.navigate(['/auth/register/payment-pending'], {
            queryParams: { reference: res.reference },
            state: { reference: res.reference }
          });
        } else {
          this.router.navigate(['/onboarding/profile']);
        }
      },
      error: (err) => {
        this.payingOnline.set(false);
        const msg = err?.error?.message ?? (Array.isArray(err?.error?.message) ? err.error.message?.[0] : null)
          ?? (typeof err?.error === 'string' ? err.error : null);
        const msgStr = typeof msg === 'string' ? msg : 'Could not initiate payment. Please try again.';
        if (msgStr.toLowerCase().includes('already activated')) {
          this.router.navigate(['/dashboard']);
          return;
        }
        this.errorMessage.set(msgStr);
        this.cdr.markForCheck();
      }
    });
  }

  onUseWallet(): void {
    if (this.usingWallet()) return;
    this.usingWallet.set(true);
    this.cdr.markForCheck();
    this.router.navigate(['/auth/activation/wallet']);
    this.usingWallet.set(false);
    this.cdr.markForCheck();
  }
}
