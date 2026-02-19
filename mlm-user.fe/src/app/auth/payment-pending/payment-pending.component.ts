import { Component, inject, ChangeDetectionStrategy, signal, ChangeDetectorRef, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule, ActivatedRoute } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { PaymentService } from '../../services/payment.service';
import { UserService } from '../../services/user.service';

const REFERENCE_STORAGE_KEY = 'mlm_registration_payment_reference';

@Component({
  selector: 'app-payment-pending',
  standalone: true,
  imports: [CommonModule, RouterModule, ButtonModule],
  template: `
    <div class="flex min-h-screen bg-white items-center justify-center px-6">
      <div class="w-full max-w-md text-center">
        <div class="mb-6">
          <i class="pi pi-credit-card text-5xl text-mlm-primary"></i>
        </div>
        <h1 class="text-xl font-semibold text-slate-900 mb-2">Complete your registration payment</h1>
        @if (reference()) {
          <p class="text-slate-500 mb-4">
            Use the reference below to complete your payment via your preferred method (e.g. bank transfer, USDT).
          </p>
          <div class="bg-slate-100 rounded-xl p-4 mb-6">
            <p class="text-xs font-medium text-slate-500 mb-1">Payment reference</p>
            <p class="font-mono font-semibold text-slate-900 break-all">{{ reference() }}</p>
          </div>
          <p class="text-sm text-slate-500 mb-6">
            Once you have completed the payment, click below to verify.
          </p>
          <p-button
            label="I've paid - Verify"
            icon="pi pi-check"
            (onClick)="onVerify()"
            [loading]="isVerifying()">
          </p-button>
        } @else {
          <p class="text-red-600 text-sm mb-6">
            Missing payment reference. Please restart the payment flow.
          </p>
          <p-button
            label="Restart payment"
            icon="pi pi-refresh"
            (onClick)="onRestartPayment()"
            [loading]="isRestarting()">
          </p-button>
        }
        <p class="mt-6">
          <a routerLink="/onboarding/profile" class="text-slate-500 text-sm hover:text-mlm-primary">
            Skip for now — complete profile first
          </a>
        </p>
      </div>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PaymentPendingComponent implements OnInit {
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private cdr = inject(ChangeDetectorRef);
  private paymentService = inject(PaymentService);
  private userService = inject(UserService);

  reference = signal<string>('');
  isVerifying = signal(false);
  isRestarting = signal(false);

  ngOnInit(): void {
    const ref =
      this.route.snapshot.queryParamMap.get('reference') ??
      (history.state as { reference?: string })?.reference ??
      (typeof sessionStorage !== 'undefined' ? sessionStorage.getItem(REFERENCE_STORAGE_KEY) : null) ??
      '';
    this.reference.set(ref);
    if (ref && typeof sessionStorage !== 'undefined') {
      sessionStorage.setItem(REFERENCE_STORAGE_KEY, ref);
    }
    this.cdr.markForCheck();
  }

  onVerify(): void {
    const ref = this.reference();
    if (!ref) return;
    this.isVerifying.set(true);
    this.cdr.markForCheck();
    this.router.navigate(['/auth/payment/callback'], {
      queryParams: { reference: ref }
    });
  }

  onRestartPayment(): void {
    this.isRestarting.set(true);
    this.cdr.markForCheck();
    const user = this.userService.currentUser();
    const packageName = user?.package ?? 'SILVER';
    const currency = user?.currency ?? 'NGN';
    const callbackUrl = typeof window !== 'undefined'
      ? `${window.location.origin}/auth/payment/callback`
      : undefined;

    this.paymentService.initiateRegistrationPayment(packageName, currency, callbackUrl).subscribe({
      next: (res) => {
        this.isRestarting.set(false);
        this.cdr.markForCheck();
        const gatewayUrl = res.authorizationUrl ?? res.gatewayUrl;
        if (gatewayUrl) {
          window.location.href = gatewayUrl;
        } else if (res.reference) {
          this.reference.set(res.reference);
          if (typeof sessionStorage !== 'undefined') {
            sessionStorage.setItem(REFERENCE_STORAGE_KEY, res.reference);
          }
          this.router.navigate(['/auth/register/payment-pending'], {
            queryParams: { reference: res.reference },
            replaceUrl: true
          });
          this.cdr.markForCheck();
        }
      },
      error: () => {
        this.isRestarting.set(false);
        this.cdr.markForCheck();
      }
    });
  }
}
