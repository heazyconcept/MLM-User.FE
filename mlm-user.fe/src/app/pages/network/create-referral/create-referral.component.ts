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
import { ReferralService, CreateReferralRequest, type DirectReferralItem } from '../../../services/referral.service';
import { RegistrationFundingComponent } from '../../wallet/registration-funding/registration-funding.component';
import { WalletService } from '../../../services/wallet.service';
import { UserService } from '../../../services/user.service';
import { NetworkService } from '../../../services/network.service';
import { ModalService } from '../../../services/modal.service';
import { getRequiredAmount, REGISTRATION_FEE_NGN } from '../../../core/constants/registration.constants';
import { forkJoin } from 'rxjs';

const PACKAGE_OPTIONS = Object.keys(REGISTRATION_FEE_NGN).map(pkg => ({
  value: pkg,
  label: `${pkg.charAt(0) + pkg.slice(1).toLowerCase()} - ₦${REGISTRATION_FEE_NGN[pkg as keyof typeof REGISTRATION_FEE_NGN].toLocaleString()}`
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

  /** Show placement dropdown only when user is a leader (>= 3 direct referrals) */
  showPlacementDropdown = computed(() => this.isLeader() && this.directReferrals().length > 0);

  /** Map direct referrals to dropdown options for "Place under" */
  placementParentOptions = computed(() =>
    this.directReferrals().map(dr => ({
      value: dr.id,
      label: `${dr.username} (${dr.firstName} ${dr.lastName})`
    }))
  );

  packageOptions = PACKAGE_OPTIONS;
  currencyOptions = CURRENCY_OPTIONS;
  form: FormGroup;
  private initialPlacementParentUserId: string | null;

  constructor() {
    const currency = this.userService.displayCurrency() as 'NGN' | 'USD';
    this.selectedCurrency.set(currency);
    this.initialPlacementParentUserId =
      (this.config.data?.['placementParentUserId'] as string | null | undefined) ?? null;

    this.form = this.fb.group({
      email: ['', [Validators.email]],
      username: ['', Validators.required],
      password: ['', [Validators.required, Validators.minLength(8)]],
      package: ['SILVER', Validators.required],
      currency: [currency, Validators.required],
      placementParentUserId: [this.initialPlacementParentUserId]
    });

    // Watch package & currency changes
    this.form.get('package')?.valueChanges.subscribe((pkg: string) => this.selectedPackage.set(pkg));
    this.form.get('currency')?.valueChanges.subscribe((c: string) => this.selectedCurrency.set(c as 'NGN' | 'USD'));
  }

  ngOnInit(): void {
    // Fetch stats and direct referrals in parallel
    forkJoin({
      stats: this.referralService.getReferralStats(),
      directRefs: this.referralService.getDirectReferrals(200, 0)
    }).subscribe(({ stats, directRefs }) => {
      this.isLeader.set(stats.isLeader);
      this.directReferrals.set(directRefs);

      // Validate pre-selected placement parent
      if (this.initialPlacementParentUserId) {
        const existsInOptions = directRefs.some(dr => dr.id === this.initialPlacementParentUserId);
        if (!existsInOptions) {
          this.form.patchValue({ placementParentUserId: null }, { emitEvent: false });
        }
      }
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

  onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const { email, username, password, package: pkg, currency, placementParentUserId } = this.form.value;
    if (!username || !password || !pkg || !currency) return;

    this.isSubmitting.set(true);
    this.formError.set('');

    const emailTrim = typeof email === 'string' ? email.trim() : '';
    const request: CreateReferralRequest = {
      ...(emailTrim ? { email: emailTrim } : {}),
      username,
      password,
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
