import {
  Component,
  ChangeDetectionStrategy,
  inject,
  OnInit,
  OnDestroy,
  signal,
  computed,
  ChangeDetectorRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule, ActivatedRoute } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { forkJoin, Subscription, timer } from 'rxjs';
import { switchMap, takeWhile } from 'rxjs/operators';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { InputNumberModule } from 'primeng/inputnumber';
import { SelectModule } from 'primeng/select';
import { MessageModule } from 'primeng/message';
import { MessageService } from 'primeng/api';
import {
  ManualDepositService,
  hasPendingDeposit,
  depositPurposeLabel,
  formatPackageLabel,
  type ManualDeposit,
  type ManualDepositPurpose,
  type ManualDepositWalletType,
} from '../../../services/manual-deposit.service';
import {
  RegistrationService,
  type CompanyBankAccount,
} from '../../../services/registration.service';
import { UserService } from '../../../services/user.service';
import { WalletService } from '../../../services/wallet.service';
import {
  EVIDENCE_ACCEPT,
  validateEvidenceFile,
} from '../../../core/utils/evidence-file.util';

const POLL_INTERVAL_MS = 15_000;
const PAGE_SIZE = 20;

type PageState = 'loading' | 'ready';

@Component({
  selector: 'app-manual-deposit',
  imports: [
    CommonModule,
    RouterModule,
    ReactiveFormsModule,
    ButtonModule,
    InputTextModule,
    InputNumberModule,
    SelectModule,
    MessageModule,
  ],
  templateUrl: './manual-deposit.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [
    `
      :host {
        display: block;
        overflow-x: clip;
      }
    `,
  ],
})
export class ManualDepositComponent implements OnInit, OnDestroy {
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private fb = inject(FormBuilder);
  private cdr = inject(ChangeDetectorRef);
  private manualDepositService = inject(ManualDepositService);
  private registrationService = inject(RegistrationService);
  private userService = inject(UserService);
  private walletService = inject(WalletService);
  private messageService = inject(MessageService);

  private pollSub: Subscription | null = null;

  pageState = signal<PageState>('loading');
  companyBank = signal<CompanyBankAccount | null>(null);
  deposits = signal<ManualDeposit[]>([]);
  totalDeposits = signal(0);
  historyOffset = signal(0);
  errorMessage = signal<string | null>(null);
  submitting = signal(false);
  copiedAccount = signal(false);
  evidenceFile = signal<File | null>(null);
  evidencePreviewUrl = signal<string | null>(null);

  displayCurrency = this.userService.displayCurrency;
  isPaid = this.userService.isPaid;
  currencySymbol = computed(() => (this.displayCurrency() === 'NGN' ? '₦' : '$'));

  walletTypeOptions = [
    { label: 'Registration Wallet', value: 'REGISTRATION' as ManualDepositWalletType },
    { label: 'Product Voucher Wallet', value: 'VOUCHER' as ManualDepositWalletType },
  ];

  submitForm = this.fb.group({
    walletType: ['REGISTRATION' as ManualDepositWalletType, Validators.required],
    amount: [null as number | null, [Validators.required, Validators.min(0.01)]],
    depositorName: ['', [Validators.required, Validators.minLength(2)]],
  });

  selectedWalletType = computed(
    () => this.submitForm.get('walletType')?.value ?? 'REGISTRATION',
  );

  hasPendingForSelectedWallet = computed(() =>
    hasPendingDeposit(this.deposits(), this.selectedWalletType()),
  );

  hasAnyPending = computed(() =>
    this.deposits().some((d) => d.status === 'PENDING'),
  );

  canSubmit = computed(
    () =>
      this.pageState() === 'ready' &&
      !this.submitting() &&
      !this.hasPendingForSelectedWallet() &&
      !!this.companyBank(),
  );

  canLoadMoreHistory = computed(
    () => this.deposits().length < this.totalDeposits(),
  );

  /** Upgrade intent from query params (sent on submit). */
  depositPurpose = signal<ManualDepositPurpose>('WALLET_FUNDING');
  targetPackage = signal<string | null>(null);

  isPackageUpgrade = computed(() => this.depositPurpose() === 'PACKAGE_UPGRADE');

  ngOnInit(): void {
    this.unlockBodyScroll();

    this.route.queryParamMap.subscribe((params) => {
      const purpose = this.normalizePurpose(params.get('purpose'));
      const targetPackage = params.get('targetPackage')?.trim()?.toUpperCase() || null;
      this.depositPurpose.set(purpose);
      this.targetPackage.set(targetPackage);

      if (purpose === 'PACKAGE_UPGRADE') {
        this.submitForm.patchValue({ walletType: 'REGISTRATION' });
      } else {
        const walletType = params.get('walletType');
        if (walletType === 'REGISTRATION' || walletType === 'VOUCHER') {
          this.submitForm.patchValue({ walletType });
        }
      }

      const amountRaw = params.get('amount');
      if (amountRaw) {
        const amount = Number(amountRaw);
        if (Number.isFinite(amount) && amount > 0) {
          this.submitForm.patchValue({ amount });
        }
      }

      this.loadPageData();
    });
  }

  ngOnDestroy(): void {
    this.stopPolling();
    this.revokeEvidencePreview();
  }

  /** Clears scroll lock left by dialogs (e.g. package upgrade → this page). */
  private unlockBodyScroll(): void {
    if (typeof document === 'undefined') return;
    document.body.classList.remove('p-overflow-hidden');
    document.documentElement.classList.remove('p-overflow-hidden');
    document.body.style.removeProperty('overflow');
    document.documentElement.style.removeProperty('overflow');
  }

  loadPageData(): void {
    this.pageState.set('loading');
    this.errorMessage.set(null);
    this.cdr.markForCheck();

    forkJoin({
      bank: this.registrationService.getCompanyBankAccount(),
      history: this.manualDepositService.listDeposits(PAGE_SIZE, 0),
    }).subscribe({
      next: ({ bank, history }) => {
        this.companyBank.set(bank);
        this.deposits.set(history.items);
        this.totalDeposits.set(history.total);
        this.historyOffset.set(history.items.length);
        this.pageState.set('ready');
        this.syncPolling();
        this.cdr.markForCheck();
      },
      error: () => {
        this.pageState.set('ready');
        this.errorMessage.set('Could not load deposit details. Please try again.');
        this.cdr.markForCheck();
      },
    });
  }

  loadMoreHistory(): void {
    const offset = this.historyOffset();
    this.manualDepositService.listDeposits(PAGE_SIZE, offset).subscribe({
      next: (history) => {
        this.deposits.update((current) => [...current, ...history.items]);
        this.totalDeposits.set(history.total);
        this.historyOffset.set(offset + history.items.length);
        this.cdr.markForCheck();
      },
    });
  }

  onEvidenceSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    const validationError = validateEvidenceFile(file);
    if (validationError) {
      this.errorMessage.set(validationError);
      input.value = '';
      this.cdr.markForCheck();
      return;
    }

    this.errorMessage.set(null);
    this.revokeEvidencePreview();
    this.evidenceFile.set(file);

    if (file.type.startsWith('image/')) {
      this.evidencePreviewUrl.set(URL.createObjectURL(file));
    } else {
      this.evidencePreviewUrl.set(null);
    }
    this.cdr.markForCheck();
  }

  onSubmit(): void {
    if (!this.canSubmit()) return;

    this.errorMessage.set(null);

    if (this.submitForm.invalid) {
      this.submitForm.markAllAsTouched();
      this.errorMessage.set('Please complete all required fields.');
      this.cdr.markForCheck();
      return;
    }

    const evidence = this.evidenceFile();
    if (!evidence) {
      this.errorMessage.set('Payment evidence (receipt or screenshot) is required.');
      this.cdr.markForCheck();
      return;
    }

    const { walletType, amount, depositorName } = this.submitForm.value;
    if (!walletType || amount == null || amount <= 0) return;

    const resolvedWalletType: ManualDepositWalletType = this.isPackageUpgrade()
      ? 'REGISTRATION'
      : walletType;
    const targetPkg = this.targetPackage();

    this.submitting.set(true);
    this.cdr.markForCheck();

    this.manualDepositService
      .submitDeposit(
        resolvedWalletType,
        amount,
        String(depositorName ?? '').trim(),
        evidence,
        this.isPackageUpgrade() && targetPkg
          ? { purpose: 'PACKAGE_UPGRADE', targetPackage: targetPkg }
          : undefined,
      )
      .subscribe({
        next: (deposit) => {
          this.submitting.set(false);
          this.deposits.update((items) => [deposit, ...items]);
          this.totalDeposits.update((total) => total + 1);
          this.historyOffset.update((offset) => offset + 1);
          this.submitForm.patchValue({
            amount: null,
            depositorName: '',
            walletType: this.isPackageUpgrade() ? 'REGISTRATION' : resolvedWalletType,
          });
          this.evidenceFile.set(null);
          this.revokeEvidencePreview();
          this.syncPolling();
          this.messageService.add({
            severity: 'success',
            summary: 'Submitted',
            detail: this.isPackageUpgrade()
              ? 'Upgrade payment submitted. Your package will update when admin approves.'
              : 'Your deposit proof was submitted and is pending review.',
            life: 5000,
          });
          this.cdr.markForCheck();
        },
        error: (err) => this.handleSubmitError(err),
      });
  }

  copyAccountNumber(): void {
    const accountNumber = this.companyBank()?.accountNumber;
    if (!accountNumber) return;

    navigator.clipboard.writeText(accountNumber).then(
      () => {
        this.copiedAccount.set(true);
        this.messageService.add({
          severity: 'success',
          summary: 'Copied',
          detail: 'Account number copied to clipboard.',
          life: 2500,
        });
        setTimeout(() => {
          this.copiedAccount.set(false);
          this.cdr.markForCheck();
        }, 2000);
        this.cdr.markForCheck();
      },
      () => {
        this.messageService.add({
          severity: 'warn',
          summary: 'Copy failed',
          detail: 'Could not copy account number.',
          life: 3000,
        });
      },
    );
  }

  formatAmount(amount: number, currency: 'NGN' | 'USD'): string {
    const sym = currency === 'NGN' ? '₦' : '$';
    return `${sym}${amount.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  }

  walletTypeLabel(walletType: ManualDepositWalletType): string {
    return walletType === 'VOUCHER' ? 'Product Voucher' : 'Registration';
  }

  purposeBannerLabel(): string | null {
    if (!this.isPackageUpgrade()) return null;
    const pkg = this.targetPackage();
    if (!pkg) return 'Package upgrade';
    return `Package upgrade to ${formatPackageLabel(pkg)}`;
  }

  historyPurposeLabel(deposit: ManualDeposit): string | null {
    return depositPurposeLabel(deposit);
  }

  goBack(): void {
    if (this.isPackageUpgrade()) {
      this.router.navigate(['/settings/upgrade']);
      return;
    }
    const walletType = this.submitForm.get('walletType')?.value;
    if (walletType === 'VOUCHER') {
      this.router.navigate(['/payments/fund'], { queryParams: { walletType: 'VOUCHER' } });
      return;
    }
    this.router.navigate(['/wallet']);
  }

  private normalizePurpose(raw: string | null): ManualDepositPurpose {
    const value = raw?.trim().toUpperCase() ?? '';
    if (value === 'PACKAGE_UPGRADE' || value === 'UPGRADE') {
      return 'PACKAGE_UPGRADE';
    }
    return 'WALLET_FUNDING';
  }

  private handleSubmitError(err: unknown): void {
    this.submitting.set(false);
    const apiErr = err as {
      status?: number;
      error?: { message?: string | string[] };
    };
    const rawMsg = apiErr?.error?.message;
    const msgStr = Array.isArray(rawMsg)
      ? rawMsg[0]
      : typeof rawMsg === 'string'
        ? rawMsg
        : 'Could not submit deposit. Please try again.';

    if (msgStr.toLowerCase().includes('pending manual deposit')) {
      this.refreshHistory();
      return;
    }

    this.errorMessage.set(msgStr);
    this.cdr.markForCheck();
  }

  private refreshHistory(): void {
    this.manualDepositService.listDeposits(PAGE_SIZE, 0).subscribe({
      next: (history) => {
        this.deposits.set(history.items);
        this.totalDeposits.set(history.total);
        this.historyOffset.set(history.items.length);
        this.syncPolling();
        this.cdr.markForCheck();
      },
    });
  }

  private syncPolling(): void {
    if (this.hasAnyPending()) {
      this.startPolling();
    } else {
      this.stopPolling();
    }
  }

  private startPolling(): void {
    if (this.pollSub) return;

    this.pollSub = timer(POLL_INTERVAL_MS, POLL_INTERVAL_MS)
      .pipe(
        switchMap(() => this.manualDepositService.listDeposits(PAGE_SIZE, 0)),
        takeWhile(() => this.hasAnyPending(), true),
      )
      .subscribe({
        next: (history) => {
          const previous = this.deposits();
          const newlyApproved = history.items.filter(
            (item) =>
              item.status === 'APPROVED' &&
              !previous.some((p) => p.id === item.id && p.status === 'APPROVED'),
          );

          this.deposits.set(history.items);
          this.totalDeposits.set(history.total);
          this.historyOffset.set(history.items.length);

          if (newlyApproved.length > 0) {
            this.walletService.fetchWallets().subscribe();

            const upgradeApproved = newlyApproved.find(
              (item) => item.purpose === 'PACKAGE_UPGRADE',
            );
            if (upgradeApproved) {
              this.userService.fetchProfile().subscribe({
                next: () => {
                  const pkg = upgradeApproved.targetPackage
                    ? formatPackageLabel(upgradeApproved.targetPackage)
                    : 'your new package';
                  this.messageService.add({
                    severity: 'success',
                    summary: 'Package upgraded',
                    detail: `Your package has been upgraded to ${pkg}.`,
                    life: 6000,
                  });
                  this.cdr.markForCheck();
                },
              });
            }
          }

          if (!history.items.some((d) => d.status === 'PENDING')) {
            this.stopPolling();
          }

          this.cdr.markForCheck();
        },
      });
  }

  private stopPolling(): void {
    this.pollSub?.unsubscribe();
    this.pollSub = null;
  }

  private revokeEvidencePreview(): void {
    const url = this.evidencePreviewUrl();
    if (url) {
      URL.revokeObjectURL(url);
    }
    this.evidencePreviewUrl.set(null);
  }

  readonly evidenceAccept = EVIDENCE_ACCEPT;
}
