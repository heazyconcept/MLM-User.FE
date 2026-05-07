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
import {
  ReferralService,
  CreateReferralRequest,
  type DirectReferralItem,
  type PlacementValidationReason
} from '../../../services/referral.service';
import { RegistrationFundingComponent } from '../../wallet/registration-funding/registration-funding.component';
import { WalletService } from '../../../services/wallet.service';
import { UserService } from '../../../services/user.service';
import { NetworkService } from '../../../services/network.service';
import { ModalService } from '../../../services/modal.service';
import { getRequiredAmount, REGISTRATION_FEE_NGN, ADMIN_FEE_NGN, NGN_TO_USD_RATE } from '../../../core/constants/registration.constants';
import { forkJoin } from 'rxjs';

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
  templateUrl: './create-referral.component.html',
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
  directReferrals = signal<DirectReferralItem[]>([]);
  isLeader = signal(false);
  placementValid = signal<boolean | null>(null);
  placementValidating = signal(false);
  placementInvalidReason = signal<PlacementValidationReason | null>(null);

  selectedPackage = signal('SILVER');
  selectedCurrency = signal<'NGN' | 'USD'>('NGN');

  currencySymbol = computed(() => (this.selectedCurrency() === 'NGN' ? '₦' : '$'));
  selectedPackageLabel = computed(() => {
    const pkg = this.selectedPackage();
    return pkg.charAt(0) + pkg.slice(1).toLowerCase();
  });
  requiredAmount = computed(() => getRequiredAmount(this.selectedPackage(), this.selectedCurrency()));

  packageBaseOptions = [
    { label: 'Nickel', value: 'NICKEL' },
    { label: 'Silver', value: 'SILVER' },
    { label: 'Gold', value: 'GOLD' },
    { label: 'Platinum', value: 'PLATINUM' },
    { label: 'Ruby', value: 'RUBY' },
    { label: 'Diamond', value: 'DIAMOND' }
  ];

  registrationBalance = computed(() => {
    const wallets = this.walletService.allWallets();
    const curr = this.selectedCurrency();
    const wallet = wallets.find(w => w.currency === curr);
    return wallet?.registrationBalance ?? 0;
  });

  hasInsufficientBalance = computed(() => this.registrationBalance() < this.requiredAmount());

  /** Show placement field only when user is a leader (>= 3 direct referrals) */
  showPlacementDropdown = computed(() => this.isLeader() && this.directReferrals().length > 0);

  packageOptions = computed(() => {
    const currency = this.selectedCurrency();

    return this.packageBaseOptions.map((pkg) => {
      if (!currency) {
        return pkg;
      }

      return {
        ...pkg,
        label: `${pkg.label} (${this.getPackagePriceLabel(pkg.value, currency)})`
      };
    });
  });
  currencyOptions = CURRENCY_OPTIONS;
  form: FormGroup;
  private initialPlacementParentUsername: string | null;

  constructor() {
    const currency = this.userService.displayCurrency() as 'NGN' | 'USD';
    this.selectedCurrency.set(currency);
    this.initialPlacementParentUsername =
      (this.config.data?.['placementParentUsername'] as string | null | undefined) ?? null;

    this.form = this.fb.group({
      email: ['', [Validators.email]],
      username: ['', Validators.required],
      password: ['', [Validators.required, Validators.minLength(8)]],
      package: ['SILVER', Validators.required],
      currency: [currency, Validators.required],
      placementParentUsername: [this.initialPlacementParentUsername]
    });

    // Watch package & currency changes
    this.form.get('package')?.valueChanges.subscribe((pkg: string) => this.selectedPackage.set(pkg));
    this.form.get('currency')?.valueChanges.subscribe((c: string) => this.selectedCurrency.set(c as 'NGN' | 'USD'));
    this.form.get('placementParentUsername')?.valueChanges.subscribe(() => {
      this.placementValid.set(null);
      this.placementValidating.set(false);
      this.placementInvalidReason.set(null);
      this.formError.set('');
    });
  }

  ngOnInit(): void {
    // Fetch stats and direct referrals in parallel
    forkJoin({
      stats: this.referralService.getReferralStats(),
      directRefs: this.referralService.getDirectReferrals(200, 0)
    }).subscribe(({ stats, directRefs }) => {
      this.isLeader.set(stats.isLeader);
      this.directReferrals.set(directRefs);
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
      data: {
        returnAfterFundingUrl,
        selectedPackage: this.selectedPackage()
      }
    });
    fundingRef?.onClose.subscribe(() => {
      this.walletService.fetchWallets().subscribe();
    });
  }

  onPlacementBlur(): void {
    const placementUsername = this.form.get('placementParentUsername')?.value?.trim();
    if (!placementUsername) {
      this.placementValid.set(null);
      this.placementValidating.set(false);
      this.placementInvalidReason.set(null);
      return;
    }

    this.placementValidating.set(true);
    this.placementValid.set(null);
    this.placementInvalidReason.set(null);

    this.referralService.validatePlacementUsername(placementUsername).subscribe({
      next: (res) => {
        this.placementValidating.set(false);
        this.placementValid.set(res.valid === true);
        this.placementInvalidReason.set(res.valid ? null : res.reason ?? null);
      },
      error: () => {
        this.placementValidating.set(false);
        this.placementValid.set(false);
        this.placementInvalidReason.set(null);
      }
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

  getPlacementValidationMessage(): string | null {
    const placementUsername = this.form.get('placementParentUsername')?.value?.trim();
    if (!placementUsername) return null;
    if (this.placementValidating()) return 'Checking placement...';
    if (this.placementValid() === true) return 'Placement username verified.';
    if (this.placementValid() === false) {
      const reason = this.placementInvalidReason();
      if (reason === 'USER_NOT_FOUND') return 'Placement username not found.';
      if (reason === 'NOT_IN_DOWNLINE') return 'Placement user is not in your downline.';
      if (reason === 'MATRIX_FULL') return 'Placement user matrix is full.';
      return 'Placement username is not valid.';
    }
    return null;
  }

  onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const { email, username, password, package: pkg, currency, placementParentUsername } = this.form.value;
    if (!username || !password || !pkg || !currency) return;

    const placementUsernameTrim = placementParentUsername?.trim();
    if (placementUsernameTrim && this.placementValidating()) {
      this.formError.set('Placement validation is in progress. Please wait.');
      return;
    }

    if (placementUsernameTrim && this.placementValid() !== true) {
      if (this.placementValid() === null) {
        this.onPlacementBlur();
      }
      this.formError.set('Please enter a valid placement username.');
      return;
    }

    this.isSubmitting.set(true);
    this.formError.set('');

    const emailTrim = typeof email === 'string' ? email.trim() : '';
    const request: CreateReferralRequest = {
      ...(emailTrim ? { email: emailTrim } : {}),
      username,
      password,
      package: pkg,
      currency,
      ...(placementUsernameTrim ? { placementParentUsername: placementUsernameTrim } : {})
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
