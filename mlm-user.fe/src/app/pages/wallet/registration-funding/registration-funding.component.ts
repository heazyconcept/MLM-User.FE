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

type ProviderOption = 'PAYSTACK' | 'FLUTTERWAVE' | 'USDT';

const PROVIDER_OPTIONS_NGN: { value: ProviderOption; label: string }[] = [
  { value: 'PAYSTACK', label: 'Paystack (Card, Bank Transfer)' },
  { value: 'FLUTTERWAVE', label: 'Flutterwave (Card, Mobile Money)' }
];

const PROVIDER_OPTIONS_USD: { value: ProviderOption; label: string }[] = [
  { value: 'USDT', label: 'USDT (Manual Transfer)' }
];

const PACKAGE_OPTIONS = Object.keys(REGISTRATION_FEE_NGN).map(pkg => ({
  value: pkg,
  label: pkg.charAt(0) + pkg.slice(1).toLowerCase()
}));

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
        <!-- Package Info -->
        <div class="p-4 bg-blue-50 rounded-xl border border-blue-100">
          <div class="flex items-center justify-between mb-1">
            <p class="text-xs font-semibold text-blue-800 uppercase tracking-wide">{{ selectedPackageLabel() }} Package</p>
            <span class="text-[10px] font-medium text-blue-600 bg-blue-100 px-2 py-0.5 rounded-full">{{ currency() }}</span>
          </div>
          <p class="text-lg font-bold text-blue-700">{{ currencySymbol() }}{{ requiredAmount() | number:'1.0-0' }}</p>
          <p class="text-[10px] text-blue-600 mt-0.5">Registration fee + admin fee</p>
        </div>

        <form [formGroup]="fundForm" (ngSubmit)="onSubmit()" class="space-y-4">

          <!-- Package -->
          <div class="flex flex-col gap-1.5">
            <label for="reg-package" class="text-sm font-semibold text-gray-700">Package</label>
            <p-select
              formControlName="package"
              inputId="reg-package"
              [options]="packageOptions"
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

  /** Selected package from the dropdown */
  selectedPackage = signal(this.userService.currentUser()?.package ?? 'SILVER');
  selectedPackageLabel = computed(() => {
    const pkg = this.selectedPackage();
    return pkg.charAt(0) + pkg.slice(1).toLowerCase();
  });

  requiredAmount = computed(() => getRequiredAmount(this.selectedPackage(), this.currency()));

  providerOptions = computed(() =>
    this.currency() === 'NGN' ? PROVIDER_OPTIONS_NGN : PROVIDER_OPTIONS_USD
  );

  packageOptions = PACKAGE_OPTIONS;

  fundForm: FormGroup;

  constructor() {
    const defaultPkg = this.userService.currentUser()?.package ?? 'SILVER';
    const currency = this.userService.displayCurrency();

    this.fundForm = this.fb.group({
      package: [defaultPkg, Validators.required],
      amount: [null as number | null, [Validators.required, Validators.min(1)]],
      provider: [(currency === 'NGN' ? 'PAYSTACK' : 'USDT') as ProviderOption, Validators.required]
    });

    // Pre-fill amount with selected package's required amount
    const amount = getRequiredAmount(defaultPkg, currency);
    this.fundForm.patchValue({ amount });

    // Watch package changes → update selectedPackage signal + amount
    this.fundForm.get('package')?.valueChanges.subscribe((pkg: string) => {
      this.selectedPackage.set(pkg);
      const newAmount = getRequiredAmount(pkg, this.currency());
      this.fundForm.patchValue({ amount: newAmount }, { emitEvent: false });
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
        this.router.navigate(['/wallet'], { queryParams: { funded: 'true' } });
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
}
