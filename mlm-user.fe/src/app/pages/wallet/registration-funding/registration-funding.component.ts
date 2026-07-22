import { Component, ChangeDetectionStrategy, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { InputNumberModule } from 'primeng/inputnumber';
import { ButtonModule } from 'primeng/button';
import { SelectModule } from 'primeng/select';
import { MessageModule } from 'primeng/message';
import { DynamicDialogConfig, DynamicDialogRef, DynamicDialogModule } from 'primeng/dynamicdialog';
import { PaymentService, type InitiatePaymentResponse, type PaymentGatewayProvider } from '../../../services/payment.service';
import { UserService } from '../../../services/user.service';
import { WalletService } from '../../../services/wallet.service';
import {
  getDefaultGatewayProvider,
  getEnabledGatewayProviderOptions,
  getPaymentCallbackUrl,
} from '../../../core/utils/payment-config.util';
import { isUsdtInitiateResponse } from '../../../services/payment-initiate.mapper';
import { UsdtDepositComponent } from '../../../components/usdt-deposit/usdt-deposit.component';
import { REGISTRATION_FEE_NGN, ADMIN_FEE_NGN, NGN_TO_USD_RATE } from '../../../core/constants/registration.constants';

const PAYMENT_FLOW_KEY = 'mlm_payment_flow';
const REGISTRATION_FUNDING_FLOW = 'registration_funding';
/** After gateway return, payment-callback navigates here if set (e.g. Create Referral flow). */
const REGISTRATION_FUND_RETURN_PATH_KEY = 'mlm_registration_fund_return_path';

type ProviderOption = PaymentGatewayProvider;

@Component({
  selector: 'app-registration-funding',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    DynamicDialogModule,
    InputNumberModule,
    ButtonModule,
    SelectModule,
    MessageModule,
    UsdtDepositComponent,
  ],
  template: `
    <div class="space-y-5">

      @if (state() === 'form') {
        <form [formGroup]="fundForm" (ngSubmit)="onSubmit()" class="space-y-4">

          <!-- Amount -->
          <div class="flex flex-col gap-1.5">
            <label for="reg-amount" class="text-sm font-semibold text-gray-700">Amount</label>
            <p-inputNumber
              formControlName="amount"
              inputId="reg-amount"
              [mode]="'currency'"
              [currency]="currency()"
              [currencyDisplay]="'symbol'"
              [min]="1"
              fluid="true"
              placeholder="0.00">
            </p-inputNumber>
            @if (fundForm.get('amount')?.invalid && (fundForm.get('amount')?.dirty || fundForm.get('amount')?.touched)) {
              <small class="text-red-500 text-xs">
                @if (fundForm.get('amount')?.errors?.['required']) {
                  Amount is required.
                }
                @if (fundForm.get('amount')?.errors?.['min']) {
                  Minimum amount is {{ currencySymbol() }}1.
                }
              </small>
            }
          </div>

          <!-- Payment Method -->
          <div class="flex flex-col gap-1.5">
            <label for="reg-provider" class="text-sm font-semibold text-gray-700">Payment Method</label>
            <p-select
              formControlName="provider"
              inputId="reg-provider"
              [options]="providerOptions()"
              optionLabel="label"
              optionValue="value"
              placeholder="Select payment method"
              styleClass="w-full">
            </p-select>
          </div>

          @if (formError()) {
            <p-message severity="error" [text]="formError()" styleClass="w-full"></p-message>
          }

          <!-- Actions -->
          <div class="flex flex-col gap-3 pt-2">
            <div class="flex gap-3">
              <p-button
                type="button"
                label="Cancel"
                [outlined]="true"
                severity="secondary"
                (onClick)="cancel()"
                [disabled]="isSubmitting()">
              </p-button>
              <p-button
                type="submit"
                label="Continue to Payment"
                icon="pi pi-arrow-right"
                [loading]="isSubmitting()"
                [disabled]="fundForm.invalid || isSubmitting()">
              </p-button>
            </div>
            <p-button
              type="button"
              label="Manual funding via admin approval"
              icon="pi pi-building"
              [outlined]="true"
              severity="secondary"
              styleClass="w-full"
              (onClick)="goToBankTransfer()"
              [disabled]="isSubmitting()">
            </p-button>
          </div>
        </form>
      }

      @if (state() === 'deposit' && usdtPayment(); as payment) {
        <app-usdt-deposit
          [payment]="payment"
          title="Fund registration wallet"
          (verified)="onUsdtVerified()"
          (back)="backToForm()">
        </app-usdt-deposit>
      }

    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class RegistrationFundingComponent {
  private config = inject(DynamicDialogConfig);
  private ref = inject(DynamicDialogRef);
  private fb = inject(FormBuilder);
  private router = inject(Router);
  private paymentService = inject(PaymentService);
  private userService = inject(UserService);
  private walletService = inject(WalletService);

  state = signal<'form' | 'deposit'>('form');
  isSubmitting = signal(false);
  usdtPayment = signal<InitiatePaymentResponse | null>(null);
  formError = signal('');

  currency = computed(() => this.userService.displayCurrency());
  currencySymbol = computed(() => (this.currency() === 'NGN' ? '₦' : '$'));

  /** Package context for this funding flow (fixed for the modal session). */
  selectedPackage = signal('SILVER');

  packageBaseOptions = [
    { label: 'Nickel', value: 'NICKEL' },
    { label: 'Silver', value: 'SILVER' },
    { label: 'Gold', value: 'GOLD' },
    { label: 'Platinum', value: 'PLATINUM' },
    { label: 'Ruby', value: 'RUBY' },
    { label: 'Diamond', value: 'DIAMOND' }
  ];

  packageOptions = computed(() => {
    const currency = this.currency();

    return this.packageBaseOptions.map((pkg) => ({
      ...pkg,
      label: `${pkg.label} (${this.getPackagePriceLabel(pkg.value, currency)})`
    }));
  });

  providerOptions = computed(() =>
    getEnabledGatewayProviderOptions(this.currency() === 'NGN' ? 'NGN' : 'USD')
  );

  fundForm: FormGroup;

  constructor() {
    const dialogPackage = this.config.data?.['selectedPackage'] as string | undefined;
    const defaultPkg = (dialogPackage ?? this.userService.currentUser()?.package ?? 'SILVER').toUpperCase();
    const currency = this.userService.displayCurrency();
    this.selectedPackage.set(defaultPkg);

    this.fundForm = this.fb.group({
      amount: [null as number | null, [Validators.required, Validators.min(1)]],
      provider: [getDefaultGatewayProvider(currency === 'NGN' ? 'NGN' : 'USD') as ProviderOption, Validators.required]
    });
  }

  onSubmit(): void {
    if (this.fundForm.invalid) {
      this.fundForm.markAllAsTouched();
      return;
    }

    const { amount, provider } = this.fundForm.value;
    if (!amount || amount < 1 || !provider) return;

    this.isSubmitting.set(true);

    const callbackUrl = getPaymentCallbackUrl();

    this.paymentService.initiateRegistrationWalletFunding(
      amount,
      provider,
      callbackUrl
    ).subscribe({
      next: (res) => {
        this.isSubmitting.set(false);
        const gatewayUrl = res.authorizationUrl ?? res.gatewayUrl;

        if (gatewayUrl) {
          // Gateway redirect (Flutterwave)
          if (typeof sessionStorage !== 'undefined') {
            sessionStorage.setItem(PAYMENT_FLOW_KEY, REGISTRATION_FUNDING_FLOW);
            const returnPath = this.config.data?.['returnAfterFundingUrl'] as string | undefined;
            if (returnPath?.startsWith('/')) {
              sessionStorage.setItem(REGISTRATION_FUND_RETURN_PATH_KEY, returnPath);
            } else {
              sessionStorage.removeItem(REGISTRATION_FUND_RETURN_PATH_KEY);
            }
          }
          window.location.href = gatewayUrl;
        } else if (isUsdtInitiateResponse(res)) {
          this.usdtPayment.set(res);
          this.state.set('deposit');
        } else {
          this.ref.close(true);
        }
      },
      error: (err) => {
        this.isSubmitting.set(false);
        const raw = err?.error?.message;
        this.formError.set(
          Array.isArray(raw) ? raw[0] : (raw ?? 'Could not initiate payment. Please try again.')
        );
      }
    });
  }

  onUsdtVerified(): void {
    this.walletService.fetchWallets().subscribe();
    this.ref.close(true);
    const returnPath =
      (this.config.data?.['returnAfterFundingUrl'] as string | undefined) ?? '/wallet';
    const path = returnPath.startsWith('/') ? returnPath : '/wallet';
    if (path === '/wallet') {
      void this.router.navigate(['/wallet'], { queryParams: { funded: 'true' } });
    } else {
      void this.router.navigateByUrl(`${path}?registrationFunded=true`);
    }
  }

  backToForm(): void {
    this.state.set('form');
    this.usdtPayment.set(null);
  }

  cancel(): void {
    this.ref.close();
  }

  goToBankTransfer(): void {
    this.ref.close();
    void this.router.navigate(['/payments/manual-deposit'], {
      queryParams: { walletType: 'REGISTRATION' },
    });
  }

  private getPackagePriceLabel(packageCode: string, currency: string): string {
    const registrationFeeNgn = REGISTRATION_FEE_NGN[packageCode] ?? REGISTRATION_FEE_NGN['NICKEL'];
    const adminFeeNgn = ADMIN_FEE_NGN[packageCode] ?? ADMIN_FEE_NGN['NICKEL'];
    const totalNgn = registrationFeeNgn + adminFeeNgn;

    if (currency === 'USD') {
      const registrationFeeUsd = Math.round(registrationFeeNgn / NGN_TO_USD_RATE);
      const adminFeeUsd = Math.round(adminFeeNgn / NGN_TO_USD_RATE);
      const totalUsd = registrationFeeUsd + adminFeeUsd;
      return `$${registrationFeeUsd.toLocaleString()} reg + $${adminFeeUsd.toLocaleString()} admin = $${totalUsd.toLocaleString()}`;
    }

    return `₦${registrationFeeNgn.toLocaleString()} reg + ₦${adminFeeNgn.toLocaleString()} admin = ₦${totalNgn.toLocaleString()}`;
  }
}
