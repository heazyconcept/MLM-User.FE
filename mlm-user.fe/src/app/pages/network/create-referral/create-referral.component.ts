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
import { RealTimeNotificationService } from '../../../services/realtime-notification.service';
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
  private realtimeNotificationService = inject(RealTimeNotificationService);
  private config = inject(DynamicDialogConfig);

  isSubmitting = signal(false);
  formError = signal('');
  directReferrals = signal<DirectReferralItem[]>([]);
  isLeader = signal(false);
  placementValid = signal<boolean | null>(null);
  placementValidating = signal(false);
  placementInvalidReason = signal<PlacementValidationReason | null>(null);

  referralValid = signal<boolean | null>(null);
  referralValidating = signal(false);
  referralUsernameValue = signal<string>('');

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

  /**
   * Show placement field when:
   *   - the entered referral username differs from the logged-in user's username, OR
   *   - the user is a leader with at least one direct referral.
   */
  showPlacementDropdown = computed(() => {
    const currentUsername = (this.userService.currentUser()?.username ?? '').trim().toLowerCase();
    const referralUsername = this.referralUsernameValue().trim().toLowerCase();
    const referralIsDifferent = referralUsername.length > 0 && referralUsername !== currentUsername;
    if (referralIsDifferent) {
      return true;
    }
    return this.isLeader() && this.directReferrals().length > 0;
  });

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

    const currentUser = this.userService.currentUser();
    this.referralUsernameValue.set(currentUser?.username ?? '');
    this.form = this.fb.group({
      referralUsername: [currentUser?.username ?? ''],
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
    this.form.get('referralUsername')?.valueChanges.subscribe((value: string | null) => {
      this.referralUsernameValue.set(value ?? '');
      this.referralValid.set(null);
      this.referralValidating.set(false);
      this.formError.set('');
      
      const placementUsername = this.form.get('placementParentUsername')?.value?.trim();
      if (placementUsername) {
        this.placementValid.set(null);
        this.placementValidating.set(false);
        this.placementInvalidReason.set(null);
        // Automatically re-validate placement against new sponsor context if needed
        // but wait for blur to prevent race conditions during typing
      }
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

    // Trigger initial validation for pre-filled referral username
    if (this.form.get('referralUsername')?.value?.trim()) {
      this.onReferralBlur();
    }
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
    const referralUsername = this.form.get('referralUsername')?.value?.trim();
    
    if (!placementUsername) {
      this.placementValid.set(null);
      this.placementValidating.set(false);
      this.placementInvalidReason.set(null);
      return;
    }

    this.placementValidating.set(true);
    this.placementValid.set(null);
    this.placementInvalidReason.set(null);

    this.referralService.validatePlacementUsername(placementUsername, referralUsername).subscribe({
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

  onReferralBlur(): void {
    const username = this.form.get('referralUsername')?.value?.trim();
    if (!username) {
      this.referralValid.set(null);
      this.referralValidating.set(false);
      
      if (this.form.get('placementParentUsername')?.value?.trim()) {
        this.onPlacementBlur();
      }
      return;
    }

    this.referralValidating.set(true);
    this.referralValid.set(null);

    this.referralService.validateReferralUsername(username).subscribe({
      next: (res) => {
        this.referralValidating.set(false);
        this.referralValid.set(res.valid === true);
        
        if (this.form.get('placementParentUsername')?.value?.trim()) {
          this.onPlacementBlur();
        }
      },
      error: () => {
        this.referralValidating.set(false);
        this.referralValid.set(false);
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
      if (reason === 'NOT_IN_DOWNLINE') return 'Placement user is not in the sponsor\'s downline.';
      if (reason === 'MATRIX_FULL') return 'Placement user matrix is full.';
      if (reason === 'SPONSOR_NOT_FOUND') return 'Delegated sponsor not found.';
      return 'Placement username is not valid.';
    }
    return null;
  }

  getReferralValidationMessage(): string | null {
    const username = this.form.get('referralUsername')?.value?.trim();
    if (!username) return null;
    if (this.referralValidating()) return 'Checking referral username...';
    if (this.referralValid() === true) return 'Referral username verified.';
    if (this.referralValid() === false) return 'Referral username is not valid.';
    return null;
  }

  onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const { email, username, password, package: pkg, currency, placementParentUsername, referralUsername } = this.form.value;
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

    const referralUsernameTrim = referralUsername?.trim();
    if (referralUsernameTrim && this.referralValidating()) {
      this.formError.set('Referral validation is in progress. Please wait.');
      return;
    }

    if (referralUsernameTrim && this.referralValid() !== true) {
      if (this.referralValid() === null) {
        this.onReferralBlur();
      }
      this.formError.set('Please enter a valid referral username.');
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
      ...(placementUsernameTrim ? { placementParentUsername: placementUsernameTrim } : {}),
      ...(referralUsernameTrim ? { referralUsername: referralUsernameTrim } : {})
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
        
        // Trigger a check for real-time notifications shortly after, in case WebSockets are delayed
        setTimeout(() => {
          this.realtimeNotificationService.syncUnreadNotifications();
        }, 1500);
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
