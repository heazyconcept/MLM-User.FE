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
import {
  isWalletFundingTarget,
  usesFundingMethodPicker,
  WALLET_FUND_TARGET_KEY,
  walletFundingReturnPath,
  walletFundingSubtitle,
  walletFundingTitle,
  type WalletFundingTarget,
} from '../../../core/utils/wallet-funding-target.util';
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
    walletType: ['CASH' as WalletFundingTarget, Validators.required]
  });

  isSubmitting = signal(false);
  usdtPayment = signal<InitiatePaymentResponse | null>(null);
  selectedFundingMethod = signal<'online' | null>(null);
  private walletType = signal<WalletFundingTarget>('CASH');

  showMethodPicker = computed(() => {
    const walletType = this.walletType();
    return usesFundingMethodPicker(walletType) && this.selectedFundingMethod() === null;
  });

  isMethodPickerWallet = computed(() => usesFundingMethodPicker(this.walletType()));
  fundingTitle = computed(() => walletFundingTitle(this.walletType()));
  fundingSubtitle = computed(() => walletFundingSubtitle(this.walletType()));

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
      const walletType = isWalletFundingTarget(type) ? type : 'CASH';
      this.walletType.set(walletType);
      this.fundForm.patchValue({ walletType });

      // NGN with no card gateways: send users to manual deposit instead of an empty online form
      if (!this.hasOnlineProviders() && this.displayCurrency() === 'NGN' && walletType === 'CASH') {
        void this.router.navigate(['/payments/manual-deposit']);
        return;
      }

      if (usesFundingMethodPicker(walletType) && !this.hasOnlineProviders()) {
        this.selectedFundingMethod.set(null);
        return;
      }

      this.selectedFundingMethod.set(usesFundingMethodPicker(walletType) ? null : 'online');
    });
  }

  selectOnlineFunding(): void {
    this.selectedFundingMethod.set('online');
  }

  goToBankTransfer(): void {
    const walletType = this.walletType();
    this.router.navigate(['/payments/manual-deposit'], {
      queryParams: { walletType },
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

    const { amount, provider } = this.fundForm.value;
    const walletType = this.walletType();
    if (amount == null || amount < 0.01 || !provider) return;

    this.isSubmitting.set(true);
    const callbackUrl = getPaymentCallbackUrl();

    this.paymentService.initiateWalletFunding(amount, provider, callbackUrl, walletType).subscribe({
      next: (res) => {
        this.isSubmitting.set(false);
        const gatewayUrl = res.authorizationUrl ?? res.gatewayUrl;

        if (gatewayUrl) {
          if (typeof sessionStorage !== 'undefined') {
            sessionStorage.setItem(PAYMENT_FLOW_KEY, WALLET_FUNDING_FLOW);
            sessionStorage.setItem(WALLET_FUND_TARGET_KEY, walletType);
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
    void this.router.navigate([walletFundingReturnPath(this.walletType())], {
      queryParams: { funded: 'true' },
    });
  }

  onUsdtBack(): void {
    this.usdtPayment.set(null);
    const opts = this.providerOptions();
    this.fundForm.reset({
      amount: null,
      provider: opts[0]?.value ?? 'USDT',
      walletType: this.walletType(),
    });
  }

  cancel(): void {
    void this.router.navigate([walletFundingReturnPath(this.walletType())]);
  }
}
