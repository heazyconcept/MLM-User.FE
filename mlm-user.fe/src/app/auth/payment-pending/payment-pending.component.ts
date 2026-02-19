import { Component, inject, ChangeDetectionStrategy, signal, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { ButtonModule } from 'primeng/button';

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
        <p class="text-slate-500 mb-4">
          Use the reference below to complete your payment via your preferred method (e.g. bank transfer, USDT).
        </p>
        @if (reference()) {
          <div class="bg-slate-100 rounded-xl p-4 mb-6">
            <p class="text-xs font-medium text-slate-500 mb-1">Payment reference</p>
            <p class="font-mono font-semibold text-slate-900 break-all">{{ reference() }}</p>
          </div>
        }
        <p class="text-sm text-slate-500 mb-6">
          Once you have completed the payment, click below to verify.
        </p>
        <p-button
          label="I've paid - Verify"
          icon="pi pi-check"
          (onClick)="onVerify()"
          [loading]="isVerifying()">
        </p-button>
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
export class PaymentPendingComponent {
  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef);

  reference = signal<string>('');
  isVerifying = signal(false);

  constructor() {
    const ref = (history.state as { reference?: string })?.reference ?? '';
    this.reference.set(ref);
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
}
