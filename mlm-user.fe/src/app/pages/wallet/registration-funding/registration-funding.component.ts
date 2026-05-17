import { Component, ChangeDetectionStrategy, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { InputNumberModule } from 'primeng/inputnumber';
import { ButtonModule } from 'primeng/button';
import { SelectModule } from 'primeng/select';
import { MessageModule } from 'primeng/message';
import { DynamicDialogConfig, DynamicDialogRef, DynamicDialogModule } from 'primeng/dynamicdialog';
import { PaymentService } from '../../../services/payment.service';
import { UserService } from '../../../services/user.service';
import { WalletService } from '../../../services/wallet.service';
import { getRequiredAmount, REGISTRATION_FEE_NGN, ADMIN_FEE_NGN, NGN_TO_USD_RATE } from '../../../core/constants/registration.constants';

const PAYMENT_FLOW_KEY = 'mlm_payment_flow';
const REGISTRATION_FUNDING_FLOW = 'registration_funding';
/** After Paystack return, payment-callback navigates here if set (e.g. Create Referral flow). */
const REGISTRATION_FUND_RETURN_PATH_KEY = 'mlm_registration_fund_return_path';

type ProviderOption = 'PAYSTACK' | 'FLUTTERWAVE' | 'USDT';

const PROVIDER_OPTIONS_NGN: { value: ProviderOption; label: string }[] = [
  { value: 'PAYSTACK', label: 'Paystack (Card, Bank Transfer)' },
  { value: 'FLUTTERWAVE', label: 'Flutterwave (Card, Mobile Money)' }
];

const PROVIDER_OPTIONS_USD: { value: ProviderOption; label: string }[] = [
  { value: 'USDT', label: 'USDT (Manual Transfer)' }
];

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
    MessageModule
  ],
  template: `
    <div class="space-y-5">

      @if (state() === 'form') {
        <form [formGroup]="fundForm" (ngSubmit)="onSubmit()" class="space-y-4">

          <!-- Package -->
          <div class="flex flex-col gap-1.5">
            <label for="reg-package" class="text-sm font-semibold text-gray-700">Package</label>
            <p-select
              formControlName="package"
              inputId="reg-package"
              [options]="packageOptions()"
              optionLabel="label"
              optionValue="value"
              placeholder="Select package"
              styleClass="w-full">
            </p-select>
          </div>

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
              [readonly]="true"
              fluid="true"
              placeholder="0.00">
            </p-inputNumber>
            <small class="text-xs text-gray-500">
              {{ selectedPackageLabel() }} package requires {{ currencySymbol() }}{{ requiredAmount() | number:'1.2-2' }}.
            </small>
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
          <div class="flex gap-3 pt-2">
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
        </form>
      }

      @if (state() === 'pending') {
        <!-- USDT Pending Reference View -->
        <div class="flex flex-col items-center text-center space-y-4">
          <div class="w-14 h-14 bg-blue-50 rounded-full flex items-center justify-center">
            <i class="pi pi-credit-card text-xl text-blue-600" aria-hidden="true"></i>
          </div>
          <div>
            <h3 class="text-lg font-semibold text-gray-900 mb-1">Complete Your Payment</h3>
            <p class="text-sm text-gray-500">
              Use the reference below to complete your payment via USDT or bank transfer.
            </p>
          </div>
          <div class="bg-gray-100 rounded-xl p-4 w-full">
            <p class="text-[10px] font-medium text-gray-500 mb-1">Payment Reference</p>
            <p class="font-mono font-semibold text-gray-900 break-all">{{ pendingReference() }}</p>
          </div>

          @if (verifyError()) {
            <p-message severity="error" [text]="verifyError()" styleClass="w-full"></p-message>
          }

          <div class="flex gap-3 w-full">
            <p-button
              label="Back"
              icon="pi pi-arrow-left"
              [outlined]="true"
              severity="secondary"
              (onClick)="backToForm()"
              [disabled]="isVerifying()"
              styleClass="flex-1">
            </p-button>
            <p-button
              label="I've Paid — Verify"
              icon="pi pi-check"
              severity="success"
              (onClick)="onVerify()"
              [loading]="isVerifying()"
              styleClass="flex-1">
            </p-button>
          </div>
        </div>
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

  state = signal<'form' | 'pending'>('form');
  isSubmitting = signal(false);
  isVerifying = signal(false);
  pendingReference = signal('');
  verifyError = signal('');
  formError = signal('');

  currency = computed(() => this.userService.displayCurrency());
  currencySymbol = computed(() => (this.currency() === 'NGN' ? '₦' : '$'));

  /** Package context for this funding flow (fixed for the modal session). */
  selectedPackage = signal('SILVER');
  selectedPackageLabel = computed(() => {
    const pkg = this.selectedPackage();
    return pkg.charAt(0) + pkg.slice(1).toLowerCase();
  });

  requiredAmount = computed(() => getRequiredAmount(this.selectedPackage(), this.currency()));

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
    this.currency() === 'NGN' ? PROVIDER_OPTIONS_NGN : PROVIDER_OPTIONS_USD
  );

  fundForm: FormGroup;

  constructor() {
    const dialogPackage = this.config.data?.['selectedPackage'] as string | undefined;
    const defaultPkg = (dialogPackage ?? this.userService.currentUser()?.package ?? 'SILVER').toUpperCase();
    const currency = this.userService.displayCurrency();
    this.selectedPackage.set(defaultPkg);

    this.fundForm = this.fb.group({
      package: [defaultPkg, Validators.required],
      amount: [null as number | null, [Validators.required, Validators.min(1)]],
      provider: [(currency === 'NGN' ? 'PAYSTACK' : 'USDT') as ProviderOption, Validators.required]
    });

    this.fundForm.get('package')?.valueChanges.subscribe((pkg: string) => {
      const normalized = (pkg ?? 'SILVER').toUpperCase();
      this.selectedPackage.set(normalized);
      this.fundForm.get('amount')?.setValue(this.requiredAmount(), { emitEvent: false });
    });

    this.fundForm.get('amount')?.setValue(this.requiredAmount(), { emitEvent: false });
  }

  onSubmit(): void {
    if (this.fundForm.invalid) {
      this.fundForm.markAllAsTouched();
      return;
    }

    const { amount, provider } = this.fundForm.value;
    if (!amount || amount < 1 || !provider) return;

    this.isSubmitting.set(true);

    const callbackUrl = typeof window !== 'undefined'
      ? `${window.location.origin}/auth/payment/callback`
      : undefined;

    this.paymentService.initiateRegistrationWalletFunding(
      amount,
      provider,
      callbackUrl
    ).subscribe({
      next: (res) => {
        this.isSubmitting.set(false);
        const gatewayUrl = res.authorizationUrl ?? res.gatewayUrl;

        if (gatewayUrl) {
          // Gateway redirect (Paystack/Flutterwave)
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
        } else if (res.reference) {
          // USDT pending reference
          this.pendingReference.set(res.reference);
          this.state.set('pending');
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

  onVerify(): void {
    const reference = this.pendingReference();
    if (!reference) return;

    this.isVerifying.set(true);
    this.verifyError.set('');

    this.paymentService.verifyPayment(reference).subscribe({
      next: () => {
        this.isVerifying.set(false);
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
      },
      error: (err) => {
        this.isVerifying.set(false);
        const raw = err?.error?.message;
        this.verifyError.set(
          Array.isArray(raw) ? raw[0] : (raw ?? 'Could not verify payment. Please try again or contact support.')
        );
      }
    });
  }

  backToForm(): void {
    this.state.set('form');
    this.pendingReference.set('');
    this.verifyError.set('');
  }

  cancel(): void {
    this.ref.close();
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
