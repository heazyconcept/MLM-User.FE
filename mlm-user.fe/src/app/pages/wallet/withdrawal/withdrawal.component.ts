import {
  Component,
  ChangeDetectionStrategy,
  inject,
  OnInit,
  signal,
  computed,
  type Signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { CommonModule, DecimalPipe } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { startWith } from 'rxjs';
import { CardModule } from 'primeng/card';
import { InputNumberModule } from 'primeng/inputnumber';
import { ButtonModule } from 'primeng/button';
import { MessageModule } from 'primeng/message';
import {
  DynamicDialogConfig,
  DynamicDialogRef,
  DynamicDialogModule,
  DialogService,
} from 'primeng/dynamicdialog';
import { ConfirmationService } from 'primeng/api';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { Router } from '@angular/router';
import { WalletService } from '../../../services/wallet.service';
import { UserService } from '../../../services/user.service';
import { OnboardingService } from '../../../services/onboarding.service';
import { formatWithdrawalAmountInWords } from '../../../core/utils/amount-in-words';
import { ProfileComponent } from '../../profile/profile.component';

@Component({
  selector: 'app-withdrawal',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    DynamicDialogModule,
    CardModule,
    InputNumberModule,
    ButtonModule,
    MessageModule,
    DecimalPipe,
    ConfirmDialogModule,
  ],
  templateUrl: './withdrawal.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WithdrawalComponent implements OnInit {
  private config = inject(DynamicDialogConfig);
  private ref = inject(DynamicDialogRef);
  private fb = inject(FormBuilder);
  private walletService = inject(WalletService);
  private userService = inject(UserService);
  private onboardingService = inject(OnboardingService);
  private confirmationService = inject(ConfirmationService);
  private router = inject(Router);
  private dialogService = inject(DialogService);

  currency = signal<'NGN' | 'USD' | null>(null);
  wallet = computed(() => {
    const curr = this.currency();
    return curr ? this.walletService.getWallet(curr)() : null;
  });
  hasPin = computed(() => this.userService.currentUser()?.hasTransactionPin ?? false);
  formState = signal<'PIN_REQUIRED' | 'AMOUNT' | 'PIN_VERIFY'>('AMOUNT');
  amountToConfirm = signal<number | null>(null);

  private bankDetailsFromApi = signal<{
    bankName?: string;
    accountNumber?: string;
    accountName?: string;
  }>({});

  bankDetails = computed(() => {
    const api = this.bankDetailsFromApi();
    const user = this.userService.currentUser();
    return {
      bankName: api.bankName || user?.bankName,
      accountNumber: api.accountNumber || user?.accountNumber,
      accountName: api.accountName || user?.accountName,
    };
  });

  withdrawalForm: FormGroup;
  isSubmitting = signal(false);
  private hasShownMissingBankPrompt = signal(false);

  /** Latest amount control value for spelled-out line */
  private amountValue!: Signal<number | null>;
  /** e.g. "ten thousand naira" */
  amountInWords = computed(() =>
    formatWithdrawalAmountInWords(this.amountValue(), this.currency()),
  );

  constructor() {
    this.withdrawalForm = this.fb.group({
      amount: [null, [Validators.required, Validators.min(0.01)]],
      pin: ['', [Validators.required, Validators.pattern(/^\d{4}$/)]],
    });
    const amountCtrl = this.withdrawalForm.get('amount')!;
    this.amountValue = toSignal(amountCtrl.valueChanges.pipe(startWith(amountCtrl.value)), {
      initialValue: amountCtrl.value as number | null,
    });
  }

  ngOnInit() {
    const data = this.config.data;
    if (data && data.currency) {
      this.currency.set(data.currency);
    }

    if (!this.hasPin()) {
      this.setFormState('PIN_REQUIRED');
    } else {
      this.setFormState('AMOUNT');
    }

    this.refreshBankDetails(true);
  }

  setFormState(state: 'PIN_REQUIRED' | 'AMOUNT' | 'PIN_VERIFY') {
    this.formState.set(state);

    const amountCtrl = this.withdrawalForm.get('amount')!;
    const pinCtrl = this.withdrawalForm.get('pin')!;

    // Clear all validators first
    amountCtrl.clearValidators();
    pinCtrl.clearValidators();

    if (state === 'AMOUNT') {
      const maxVal = this.wallet()?.cashBalance ?? 0;
      amountCtrl.setValidators([Validators.required, Validators.min(0.01), Validators.max(maxVal)]);
    } else if (state === 'PIN_VERIFY') {
      pinCtrl.setValidators([Validators.required, Validators.pattern(/^\d{4}$/)]);
    }

    amountCtrl.updateValueAndValidity();
    pinCtrl.updateValueAndValidity();
    this.withdrawalForm.updateValueAndValidity();
  }

  onSubmit() {
    if (this.withdrawalForm.invalid) return;

    const state = this.formState();

    if (state === 'AMOUNT') {
      if (this.hasBankDetails()) {
        this.amountToConfirm.set(this.withdrawalForm.value.amount);
        this.withdrawalForm.patchValue({ pin: '' });
        this.setFormState('PIN_VERIFY');
      }
    } else if (state === 'PIN_VERIFY') {
      this.processWithdrawal();
    }
  }

  goToTransactionPinSettings(): void {
    this.ref.close();
    void this.router.navigate(['/profile'], {
      queryParams: { pinAction: 'setup' },
      fragment: 'transaction-pin',
    });
  }

  goBackToAmount() {
    this.withdrawalForm.patchValue({ pin: '' });
    this.setFormState('AMOUNT');
  }

  hasBankDetails(): boolean {
    const bank = this.bankDetails();
    return !!(bank.bankName && bank.accountNumber && bank.accountName);
  }

  private maybePromptForMissingBankDetails(): void {
    if (this.hasShownMissingBankPrompt() || this.hasBankDetails()) return;
    this.hasShownMissingBankPrompt.set(true);

    this.confirmationService.confirm({
      header: 'Complete Your Profile',
      message: 'Bank details are required before you can request a withdrawal.',
      icon: 'pi pi-info-circle',
      acceptButtonProps: { label: 'Complete Profile', severity: 'success' },
      rejectVisible: false,
      accept: () => this.openProfileDialog(),
    });
  }

  private openProfileDialog(): void {
    const ref = this.dialogService.open(ProfileComponent, {
      header: 'Complete Profile',
      width: '860px',
      contentStyle: { 'max-height': '85vh', overflow: 'auto' },
      baseZIndex: 11000,
      data: {
        startInEdit: true,
        dialogMode: true,
        closeOnSave: true,
      },
    });

    ref?.onClose.subscribe(() => {
      this.refreshBankDetails(false);
    });
  }

  private refreshBankDetails(checkForPrompt: boolean): void {
    this.onboardingService.getBankDetails().subscribe({
      next: (data: Record<string, unknown>) => {
        const bankName = (data['bankName'] ?? data['bank_name']) as string | undefined;
        const accountNumber = (data['accountNumber'] ?? data['account_number']) as
          string | undefined;
        const accountNumberMasked = (data['accountNumberMasked'] ??
          data['account_number_masked']) as string | undefined;
        const accountName = (data['accountName'] ?? data['account_name']) as string | undefined;
        const displayAccountNumber = accountNumber ?? accountNumberMasked;

        if (bankName || displayAccountNumber || accountName) {
          this.bankDetailsFromApi.set({
            bankName,
            accountNumber: displayAccountNumber,
            accountName,
          });
          this.userService.updateProfile({
            bankName: bankName ?? undefined,
            accountNumber: displayAccountNumber ?? undefined,
            accountName: accountName ?? undefined,
          });
        }

        if (checkForPrompt) {
          this.maybePromptForMissingBankDetails();
        }
      },
      error: () => {
        if (checkForPrompt) {
          this.maybePromptForMissingBankDetails();
        }
      },
    });
  }

  private processWithdrawal() {
    this.isSubmitting.set(true);
    const amount = this.amountToConfirm()!;
    const pin = this.withdrawalForm.value.pin;
    const curr = this.currency()!;
    const bank = this.bankDetails();

    this.walletService
      .withdraw({
        currency: curr,
        amount,
        bankName: bank.bankName!,
        accountNumber: bank.accountNumber!,
        accountName: bank.accountName!,
        pin,
      })
      .subscribe({
        next: (created) => {
          this.walletService.fetchWallets().subscribe();
          this.isSubmitting.set(false);
          this.ref.close(true);
          this.router.navigate(['/withdrawals', created.id]);
        },
        error: () => {
          this.isSubmitting.set(false);
          this.withdrawalForm.patchValue({ pin: '' });
        },
      });
  }

  cancel() {
    this.ref.close();
  }

  /** Matches display style e.g. 50,000,001.00 */
  private static formatAmountWithCommas(amount: number): string {
    return amount.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }
}
