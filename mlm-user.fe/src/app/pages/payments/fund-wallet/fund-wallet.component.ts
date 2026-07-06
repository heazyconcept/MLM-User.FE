import { Component, ChangeDetectionStrategy, inject, OnInit, signal, computed, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterModule, ActivatedRoute } from '@angular/router';
import { CardModule } from 'primeng/card';
import { InputNumberModule } from 'primeng/inputnumber';
import { ButtonModule } from 'primeng/button';
import { SelectModule } from 'primeng/select';
import { PaymentService } from '../../../services/payment.service';
import { UserService } from '../../../services/user.service';
import { ModalService } from '../../../services/modal.service';
import { getEnabledGatewayProviderOptions, getPaymentCallbackUrl } from '../../../core/utils/payment-config.util';
import type { PaymentGatewayProvider } from '../../../services/payment.service';

const PAYMENT_FLOW_KEY = 'mlm_payment_flow';
const WALLET_FUNDING_FLOW = 'wallet_funding';

type ProviderOption = PaymentGatewayProvider;

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
export class FundWalletComponent implements OnInit {
  private fb = inject(FormBuilder);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private paymentService = inject(PaymentService);
  private userService = inject(UserService);
  private modalService = inject(ModalService);

  displayCurrency = this.userService.displayCurrency;
  currencySymbol = computed(() => (this.displayCurrency() === 'NGN' ? '₦' : '$'));
  providerOptions = computed(() =>
    getEnabledGatewayProviderOptions(this.displayCurrency() === 'NGN' ? 'NGN' : 'USD')
  );

  fundForm = this.fb.group({
    amount: [null as number | null, [Validators.required, Validators.min(0.01)]],
    provider: ['PAYSTACK' as ProviderOption, Validators.required],
    walletType: ['CASH' as 'CASH' | 'VOUCHER', Validators.required]
  });

  isSubmitting = signal(false);
  showPendingView = signal(false);
  pendingReference = signal('');

  constructor() {
    effect(() => {
      const opts = this.providerOptions();
      const current = this.fundForm.get('provider')?.value;
      const valid = opts.some(o => o.value === current);
      if (!valid && opts.length > 0) {
        this.fundForm.patchValue({ provider: opts[0].value });
      }
    });
  }

  ngOnInit(): void {
    this.route.queryParamMap.subscribe(params => {
      const type = params.get('walletType');
      if (type === 'VOUCHER' || type === 'CASH') {
        this.fundForm.patchValue({ walletType: type });
      }
    });
  }

  onSubmit(): void {
    if (this.fundForm.invalid) {
      this.fundForm.markAllAsTouched();
      return;
    }

    const { amount, provider, walletType } = this.fundForm.value;
    if (amount == null || amount < 0.01 || !provider) return;

    this.isSubmitting.set(true);
    const callbackUrl = getPaymentCallbackUrl();

    this.paymentService.initiateWalletFunding(amount, provider, callbackUrl, walletType ?? 'CASH').subscribe({
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
    const opts = this.providerOptions();
    this.fundForm.reset({ amount: null, provider: opts[0]?.value ?? 'USDT' });
  }

  cancel(): void {
    this.router.navigate(['/wallet']);
  }
}
