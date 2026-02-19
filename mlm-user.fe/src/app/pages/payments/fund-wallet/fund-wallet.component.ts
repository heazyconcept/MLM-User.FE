import { Component, ChangeDetectionStrategy, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { CardModule } from 'primeng/card';
import { InputNumberModule } from 'primeng/inputnumber';
import { ButtonModule } from 'primeng/button';
import { SelectModule } from 'primeng/select';
import { PaymentService } from '../../../services/payment.service';
import { UserService } from '../../../services/user.service';
import { ModalService } from '../../../services/modal.service';

const PAYMENT_FLOW_KEY = 'mlm_payment_flow';
const WALLET_FUNDING_FLOW = 'wallet_funding';

type ProviderOption = 'PAYSTACK' | 'FLUTTERWAVE' | 'USDT';

const PROVIDER_OPTIONS: { value: ProviderOption; label: string }[] = [
  { value: 'PAYSTACK', label: 'Paystack (Card, Bank Transfer)' },
  { value: 'FLUTTERWAVE', label: 'Flutterwave (Card, Mobile Money)' },
  { value: 'USDT', label: 'USDT (Manual)' }
];

@Component({
  selector: 'app-fund-wallet',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterModule,
    CardModule,
    InputNumberModule,
    ButtonModule,
    SelectModule
  ],
  templateUrl: './fund-wallet.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class FundWalletComponent {
  private fb = inject(FormBuilder);
  private router = inject(Router);
  private paymentService = inject(PaymentService);
  private userService = inject(UserService);
  private modalService = inject(ModalService);

  providerOptions = PROVIDER_OPTIONS;
  fundForm = this.fb.group({
    amount: [null as number | null, [Validators.required, Validators.min(0.01)]],
    provider: ['PAYSTACK' as ProviderOption, Validators.required]
  });

  isSubmitting = signal(false);
  showPendingView = signal(false);
  pendingReference = signal('');

  userCurrency = computed(() => this.userService.currentUser()?.currency ?? 'NGN');
  currencySymbol = computed(() => (this.userCurrency() === 'NGN' ? '₦' : '$'));

  onSubmit(): void {
    if (this.fundForm.invalid) {
      this.fundForm.markAllAsTouched();
      return;
    }

    const { amount, provider } = this.fundForm.value;
    if (amount == null || amount < 0.01 || !provider) return;

    this.isSubmitting.set(true);
    const callbackUrl = typeof window !== 'undefined'
      ? `${window.location.origin}/auth/payment/callback`
      : undefined;

    this.paymentService.initiateWalletFunding(amount, provider, callbackUrl).subscribe({
      next: (res) => {
        this.isSubmitting.set(false);
        const gatewayUrl = res.authorizationUrl ?? res.gatewayUrl;

        if (gatewayUrl) {
          if (typeof sessionStorage !== 'undefined') {
            sessionStorage.setItem(PAYMENT_FLOW_KEY, WALLET_FUNDING_FLOW);
          }
          window.location.href = gatewayUrl;
        } else if (res.reference) {
          this.pendingReference.set(res.reference);
          this.showPendingView.set(true);
        } else {
          this.router.navigate(['/wallet']);
        }
      },
      error: (err) => {
        this.isSubmitting.set(false);
        const message = err?.error?.message
          ?? 'We could not initiate your wallet funding. Please try again or contact support.';
        this.modalService.open('error', 'Payment Initiation Failed', message);
      }
    });
  }

  onVerify(): void {
    const ref = this.pendingReference();
    if (!ref) return;
    this.router.navigate(['/auth/payment/callback'], {
      queryParams: { reference: ref }
    });
  }

  onBack(): void {
    this.showPendingView.set(false);
    this.pendingReference.set('');
    this.fundForm.reset({ amount: null, provider: 'PAYSTACK' });
  }

  cancel(): void {
    this.router.navigate(['/wallet']);
  }
}
