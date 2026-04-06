import { Component, ChangeDetectionStrategy, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { InputTextModule } from 'primeng/inputtext';
import { PasswordModule } from 'primeng/password';
import { ButtonModule } from 'primeng/button';
import { SelectModule } from 'primeng/select';
import { MessageModule } from 'primeng/message';
import {
  DynamicDialogRef,
  DynamicDialogModule,
  DynamicDialogConfig,
  DialogService
} from 'primeng/dynamicdialog';
import { ReferralService, CreateReferralRequest, PlacementParent } from '../../../services/referral.service';
import { RegistrationFundingComponent } from '../../wallet/registration-funding/registration-funding.component';
import { WalletService } from '../../../services/wallet.service';
import { UserService } from '../../../services/user.service';
import { NetworkService } from '../../../services/network.service';
import { ModalService } from '../../../services/modal.service';
import { getRequiredAmount, REGISTRATION_FEE_NGN } from '../../../core/constants/registration.constants';

const PACKAGE_OPTIONS = Object.keys(REGISTRATION_FEE_NGN).map(pkg => ({
  value: pkg,
  label: pkg.charAt(0) + pkg.slice(1).toLowerCase()
}));

const CURRENCY_OPTIONS = [
  { value: 'NGN', label: 'NGN (₦)' },
  { value: 'USD', label: 'USD ($)' }
];

@Component({
  selector: 'app-create-referral',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    DynamicDialogModule,
    InputTextModule,
    PasswordModule,
    ButtonModule,
    SelectModule,
    MessageModule
  ],
  template: `
    <div class="space-y-5">

      <!-- Registration Wallet Balance -->
      <div class="p-4 bg-blue-50 rounded-xl border border-blue-100">
        <div class="flex items-center justify-between mb-1">
          <p class="text-xs font-semibold text-blue-800 uppercase tracking-wide">Registration Wallet</p>
          <span class="text-[10px] font-medium text-blue-600 bg-blue-100 px-2 py-0.5 rounded-full">{{ selectedCurrency() }}</span>
        </div>
        <p class="text-lg font-bold text-blue-700">{{ currencySymbol() }}{{ registrationBalance() | number:'1.0-0' }}</p>
        <p class="text-[10px] text-blue-600 mt-0.5">
          Required for {{ selectedPackageLabel() }}: {{ currencySymbol() }}{{ requiredAmount() | number:'1.0-0' }}
          @if (hasInsufficientBalance()) {
            <span class="text-red-600 font-semibold"> — Insufficient balance</span>
          }
        </p>
        @if (hasInsufficientBalance()) {
          <div class="mt-3 pt-3 border-t border-blue-200">
            <p class="text-[11px] text-blue-800 mb-2">Fund your registration wallet using the same options as on the Wallet page.</p>
            <p-button
              type="button"
              label="Fund registration wallet"
              icon="pi pi-wallet"
              styleClass="w-full"
              [outlined]="false"
              (onClick)="openRegistrationFundingDialog()"
              [disabled]="isSubmitting()">
            </p-button>
          </div>
        }
      </div>

      <form [formGroup]="form" (ngSubmit)="onSubmit()" class="space-y-4">

        <!-- Email -->
        <div class="flex flex-col gap-1.5">
          <label for="cr-email" class="text-sm font-semibold text-gray-700">Email</label>
          <input pInputText formControlName="email" id="cr-email" type="email" placeholder="newuser&#64;example.com" class="w-full" />
          @if (form.get('email')?.invalid && form.get('email')?.touched) {
            <small class="text-red-500 text-xs">Please enter a valid email address.</small>
          }
        </div>

        <!-- Username -->
        <div class="flex flex-col gap-1.5">
          <label for="cr-username" class="text-sm font-semibold text-gray-700">Username</label>
          <input pInputText formControlName="username" id="cr-username" placeholder="newuser" class="w-full" />
          @if (form.get('username')?.invalid && form.get('username')?.touched) {
            <small class="text-red-500 text-xs">Username is required.</small>
          }
        </div>

        <!-- Password -->
        <div class="flex flex-col gap-1.5">
          <label for="cr-password" class="text-sm font-semibold text-gray-700">Password</label>
          <p-password formControlName="password" inputId="cr-password" [toggleMask]="true" [feedback]="false" styleClass="w-full" inputStyleClass="w-full" placeholder="Min 8 characters"></p-password>
          @if (form.get('password')?.invalid && form.get('password')?.touched) {
            <small class="text-red-500 text-xs">Password must be at least 8 characters.</small>
          }
        </div>

        <!-- Package & Currency row -->
        <div class="grid grid-cols-2 gap-3">
          <div class="flex flex-col gap-1.5">
            <label for="cr-package" class="text-sm font-semibold text-gray-700">Package</label>
            <p-select
              formControlName="package"
              inputId="cr-package"
              [options]="packageOptions"
              optionLabel="label"
              optionValue="value"
              styleClass="w-full">
            </p-select>
          </div>
          <div class="flex flex-col gap-1.5">
            <label for="cr-currency" class="text-sm font-semibold text-gray-700">Currency</label>
            <p-select
              formControlName="currency"
              inputId="cr-currency"
              [options]="currencyOptions"
              optionLabel="label"
              optionValue="value"
              styleClass="w-full">
            </p-select>
          </div>
        </div>

        <!-- Placement Parent (only shown when sponsor has 3+ direct referrals) -->
        @if (placementParents().length > 0) {
          <div class="flex flex-col gap-1.5">
            <label for="cr-placement" class="text-sm font-semibold text-gray-700">
              Place under
              <span class="font-normal text-gray-500 text-xs">(spillover)</span>
            </label>
            <p-select
              formControlName="placementParentUserId"
              inputId="cr-placement"
              [options]="placementParentOptions()"
              optionLabel="label"
              optionValue="value"
              placeholder="Auto-place (leftmost)"
              [showClear]="true"
              styleClass="w-full">
            </p-select>
            <small class="text-gray-500 text-xs">You have 3 direct referrals. Choose which leg receives the new member, or leave blank for auto-placement.</small>
          </div>
        }

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
            label="Create Referral"
            icon="pi pi-user-plus"
            [loading]="isSubmitting()"
            [disabled]="form.invalid || isSubmitting() || hasInsufficientBalance()">
          </p-button>
        </div>
      </form>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CreateReferralComponent implements OnInit {
  private ref = inject(DynamicDialogRef);
  private dialogService = inject(DialogService);
  private fb = inject(FormBuilder);
  private referralService = inject(ReferralService);
  private walletService = inject(WalletService);
  private userService = inject(UserService);
  private networkService = inject(NetworkService);
  private modalService = inject(ModalService);
  private config = inject(DynamicDialogConfig);

  isSubmitting = signal(false);
  formError = signal('');
  placementParents = signal<PlacementParent[]>([]);

  selectedPackage = signal('SILVER');
  selectedCurrency = signal<'NGN' | 'USD'>('NGN');

  currencySymbol = computed(() => (this.selectedCurrency() === 'NGN' ? '₦' : '$'));
  selectedPackageLabel = computed(() => {
    const pkg = this.selectedPackage();
    return pkg.charAt(0) + pkg.slice(1).toLowerCase();
  });
  requiredAmount = computed(() => getRequiredAmount(this.selectedPackage(), this.selectedCurrency()));

  registrationBalance = computed(() => {
    const wallets = this.walletService.allWallets();
    const curr = this.selectedCurrency();
    const wallet = wallets.find(w => w.currency === curr);
    return wallet?.registrationBalance ?? 0;
  });

  hasInsufficientBalance = computed(() => this.registrationBalance() < this.requiredAmount());

  placementParentOptions = computed(() =>
    this.placementParents().map(p => ({
      value: p.userId,
      label: `${p.username} (${p.email})`
    }))
  );

  packageOptions = PACKAGE_OPTIONS;
  currencyOptions = CURRENCY_OPTIONS;
  form: FormGroup;

  constructor() {
    const currency = this.userService.displayCurrency() as 'NGN' | 'USD';
    this.selectedCurrency.set(currency);

    this.form = this.fb.group({
      email: ['', [Validators.email]],
      username: ['', Validators.required],
      password: ['', [Validators.required, Validators.minLength(8)]],
      package: ['SILVER', Validators.required],
      currency: [currency, Validators.required],
      placementParentUserId: [null as string | null]
    });

    // Watch package & currency changes
    this.form.get('package')?.valueChanges.subscribe((pkg: string) => this.selectedPackage.set(pkg));
    this.form.get('currency')?.valueChanges.subscribe((c: string) => this.selectedCurrency.set(c as 'NGN' | 'USD'));
  }

  ngOnInit(): void {
    // Fetch placement parents to determine if spillover dropdown is needed
    this.referralService.getPlacementParents().subscribe((parents) => {
      this.placementParents.set(parents);
    });

    // Ensure wallet balances are loaded so we can show the registration balance
    this.walletService.fetchWallets().subscribe();
  }

  /** Same flow as Wallet page → Fund Registration Wallet (nested above this dialog). */
  openRegistrationFundingDialog(): void {
    const returnAfterFundingUrl =
      (this.config.data?.['returnUrl'] as string | undefined) ?? '/network';
    const fundingRef = this.dialogService.open(RegistrationFundingComponent, {
      header: 'Fund Registration Wallet',
      width: '480px',
      contentStyle: { 'max-height': '650px', overflow: 'auto' },
      baseZIndex: 11000,
      data: { returnAfterFundingUrl }
    });
    fundingRef?.onClose.subscribe(() => {
      this.walletService.fetchWallets().subscribe();
    });
  }

  onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const { email, username, password, package: pkg, currency, placementParentUserId } = this.form.value;
    if (!username || !password || !pkg || !currency) return;

    this.isSubmitting.set(true);
    this.formError.set('');

    const request: CreateReferralRequest = {
      email, username, password,
      package: pkg,
      currency,
      ...(placementParentUserId ? { placementParentUserId } : {})
    };

    this.referralService.createReferral(request).subscribe({
      next: (res) => {
        this.isSubmitting.set(false);
        this.ref.close(true);
        const returnUrl = this.config.data?.returnUrl ?? '/network';
        this.modalService.open(
          'success',
          'Referral Created',
          `New member ${username} has been registered and activated under your network.`,
          returnUrl
        );
        // Refresh wallet + network data
        this.walletService.fetchWallets().subscribe();
        this.networkService.fetchNetworkData();
      },
      error: (err) => {
        this.isSubmitting.set(false);
        const raw = err?.error?.message;
        this.formError.set(
          Array.isArray(raw) ? raw[0] : (raw ?? 'Failed to create referral. Please try again.')
        );
      }
    });
  }

  cancel(): void {
    this.ref.close();
  }
}
