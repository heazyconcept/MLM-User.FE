import { Component, ChangeDetectionStrategy, inject, OnInit, signal, computed, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterModule, ActivatedRoute } from '@angular/router';
import { CardModule } from 'primeng/card';
import { InputNumberModule } from 'primeng/inputnumber';
import { ButtonModule } from 'primeng/button';
import { SelectModule } from 'primeng/select';
import { PaymentService, type InitiatePaymentResponse, type PaymentGatewayProvider } from '../../../services/payment.service';
import { UserService } from '../../../services/user.service';
import { ModalService } from '../../../services/modal.service';
import {
  getDefaultGatewayProvider,
  getEnabledGatewayProviderOptions,
  getPaymentCallbackUrl,
} from '../../../core/utils/payment-config.util';
import { isUsdtInitiateResponse } from '../../../services/payment-initiate.mapper';
import { UsdtDepositComponent } from '../../../components/usdt-deposit/usdt-deposit.component';

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
    SelectModule,
    UsdtDepositComponent,
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
  hasOnlineProviders = computed(() => this.providerOptions().length > 0);

  fundForm = this.fb.group({
    amount: [null as number | null, [Validators.required, Validators.min(0.01)]],
    provider: [getDefaultGatewayProvider('NGN') as ProviderOption, Validators.required],
    walletType: ['CASH' as 'CASH' | 'VOUCHER', Validators.required]
  });

  isSubmitting = signal(false);
  usdtPayment = signal<InitiatePaymentResponse | null>(null);
  selectedFundingMethod = signal<'online' | null>(null);

  showMethodPicker = computed(() => {
    const walletType = this.fundForm.get('walletType')?.value;
    return walletType === 'VOUCHER' && this.selectedFundingMethod() === null;
  });

  isVoucherWallet = computed(() => this.fundForm.get('walletType')?.value === 'VOUCHER');

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

      const walletType = (type === 'VOUCHER' || type === 'CASH'
        ? type
        : this.fundForm.get('walletType')?.value) ?? 'CASH';

      // NGN with no card gateways: send users to manual deposit instead of an empty online form
      if (!this.hasOnlineProviders() && this.displayCurrency() === 'NGN' && walletType === 'CASH') {
        void this.router.navigate(['/payments/manual-deposit']);
        return;
      }

      if (walletType === 'VOUCHER' && !this.hasOnlineProviders()) {
        // Skip online/manual picker — only manual is available
        this.selectedFundingMethod.set(null);
        return;
      }

      const method = walletType === 'CASH' ? 'online' : null;
      this.selectedFundingMethod.set(method);
    });
  }

  selectOnlineFunding(): void {
    this.selectedFundingMethod.set('online');
  }

  goToBankTransfer(): void {
    this.router.navigate(['/payments/manual-deposit'], {
      queryParams: { walletType: 'VOUCHER' },
    });
  }

  backToMethodPicker(): void {
    this.selectedFundingMethod.set(null);
    this.usdtPayment.set(null);
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
        } else if (isUsdtInitiateResponse(res)) {
          this.usdtPayment.set(res);
        } else {
          this.modalService.open(
            'error',
            'Payment Initiation Failed',
            'No payment method was returned. Please try again or contact support.',
          );
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

  onUsdtVerified(): void {
    this.router.navigate(['/wallet'], { queryParams: { funded: 'true' } });
  }

  onUsdtBack(): void {
    this.usdtPayment.set(null);
    const opts = this.providerOptions();
    this.fundForm.reset({ amount: null, provider: opts[0]?.value ?? 'USDT' });
  }

  cancel(): void {
    this.router.navigate(['/wallet']);
  }
}
