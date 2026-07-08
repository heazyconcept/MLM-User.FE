import {
  Component,
  ChangeDetectionStrategy,
  inject,
  OnInit,
  signal,
  computed,
  effect,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { CardModule } from 'primeng/card';
import { InputNumberModule } from 'primeng/inputnumber';
import { ButtonModule } from 'primeng/button';
import { SelectModule } from 'primeng/select';
import { MessageModule } from 'primeng/message';
import { InputTextModule } from 'primeng/inputtext';
import {
  WalletService,
  type FundTransferRequest,
  type WalletType,
} from '../../../services/wallet.service';
import { UserService } from '../../../services/user.service';
import { AuthService } from '../../../services/auth.service';
import { ModalService } from '../../../services/modal.service';
import {
  FUND_TRANSFER_SOURCE_OPTIONS,
  getFundTransferTargetOptions,
  WALLET_TYPE_LABELS,
  type FundTransferSourceWallet,
} from '../../../core/constants/fund-transfer.constants';

@Component({
  selector: 'app-fund-transfer',
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterModule,
    CardModule,
    InputNumberModule,
    ButtonModule,
    SelectModule,
    MessageModule,
    InputTextModule,
  ],
  templateUrl: './fund-transfer.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FundTransferComponent implements OnInit {
  private fb = inject(FormBuilder);
  private walletService = inject(WalletService);
  private userService = inject(UserService);
  private authService = inject(AuthService);
  private modalService = inject(ModalService);

  isLoading = signal(true);
  isSubmitting = signal(false);
  pinSetupSubmitting = signal(false);
  formState = signal<'PIN_SETUP' | 'FORM'>('FORM');
  pinError = signal<string | null>(null);
  recipientError = signal<string | null>(null);

  impersonation = this.authService.impersonation;
  isImpersonating = computed(() => !!this.impersonation());
  hasPin = computed(() => this.userService.currentUser()?.hasTransactionPin ?? false);
  currentUsername = computed(() => this.userService.currentUser()?.username ?? '');

  transferCurrency = signal<'NGN' | 'USD'>('NGN');
  currency = computed(() => this.transferCurrency());
  currencySymbol = computed(() => (this.transferCurrency() === 'NGN' ? '₦' : '$'));

  sourceOptions = FUND_TRANSFER_SOURCE_OPTIONS;

  transferForm = this.fb.group({
    recipientUsername: ['', [Validators.required, Validators.pattern(/\S+/)]],
    fromWalletType: ['CASH' as FundTransferSourceWallet, Validators.required],
    toWalletType: ['REGISTRATION' as WalletType, Validators.required],
    amount: [null as number | null, [Validators.required, Validators.min(1)]],
    pin: ['', [Validators.required, Validators.pattern(/^\d{4}$/)]],
    confirmPin: [''],
  });

  private fromWalletTypeValue = signal<FundTransferSourceWallet>('CASH');
  private toWalletTypeValue = signal<WalletType>('REGISTRATION');

  activeWallet = computed(() =>
    this.walletService.allWallets().find((w) => w.currency === this.transferCurrency()),
  );

  sourceBalance = computed(() => {
    const wallet = this.activeWallet();
    const source = this.fromWalletTypeValue();
    if (!wallet) return 0;
    return source === 'REGISTRATION' ? wallet.registrationBalance : wallet.cashBalance;
  });

  isCashLocked = computed(
    () =>
      this.fromWalletTypeValue() === 'CASH' &&
      this.walletService.isCashWalletLocked(this.transferCurrency()),
  );

  targetOptions = computed(() => getFundTransferTargetOptions(this.fromWalletTypeValue()));

  selectedSourceLabel = computed(() => {
    const val = this.fromWalletTypeValue();
    return FUND_TRANSFER_SOURCE_OPTIONS.find((o) => o.value === val)?.label ?? '';
  });

  selectedTargetLabel = computed(() => {
    const val = this.toWalletTypeValue();
    return WALLET_TYPE_LABELS[val] ?? '';
  });

  isFormDisabled = computed(
    () => this.isImpersonating() || this.isCashLocked() || this.isSubmitting(),
  );

  constructor() {
    this.transferForm
      .get('fromWalletType')!
      .valueChanges.pipe(takeUntilDestroyed())
      .subscribe((val) => {
        if (val) this.fromWalletTypeValue.set(val as FundTransferSourceWallet);
      });

    this.transferForm
      .get('toWalletType')!
      .valueChanges.pipe(takeUntilDestroyed())
      .subscribe((val) => {
        if (val) this.toWalletTypeValue.set(val as WalletType);
      });

    effect(() => {
      const source = this.fromWalletTypeValue();
      const target = this.toWalletTypeValue();
      const validTargets = getFundTransferTargetOptions(source);
      if (!validTargets.some((t) => t.value === target)) {
        const next = validTargets[0]?.value ?? 'REGISTRATION';
        this.transferForm.patchValue({ toWalletType: next });
        this.toWalletTypeValue.set(next);
      }
    });

    effect(() => {
      const max = this.sourceBalance();
      const amountCtrl = this.transferForm.get('amount');
      if (amountCtrl) {
        amountCtrl.clearValidators();
        amountCtrl.setValidators([Validators.required, Validators.min(1), Validators.max(max)]);
        amountCtrl.updateValueAndValidity({ emitEvent: false });
      }
    });
  }

  ngOnInit(): void {
    const userCurrency = this.userService.displayCurrency();
    this.transferCurrency.set(userCurrency);

    if (!this.hasPin()) {
      this.setFormState('PIN_SETUP');
    } else {
      this.setFormState('FORM');
    }

    this.walletService.fetchWallets().subscribe({
      next: () => this.isLoading.set(false),
      error: () => this.isLoading.set(false),
    });
  }

  setFormState(state: 'PIN_SETUP' | 'FORM'): void {
    this.formState.set(state);
    const pinCtrl = this.transferForm.get('pin')!;
    const confirmPinCtrl = this.transferForm.get('confirmPin')!;

    pinCtrl.clearValidators();
    confirmPinCtrl.clearValidators();
    this.transferForm.clearValidators();

    if (state === 'PIN_SETUP') {
      pinCtrl.setValidators([Validators.required, Validators.pattern(/^\d{4}$/)]);
      confirmPinCtrl.setValidators([Validators.required, Validators.pattern(/^\d{4}$/)]);
      this.transferForm.addValidators(this.pinMatchValidator);
    } else {
      pinCtrl.setValidators([Validators.required, Validators.pattern(/^\d{4}$/)]);
    }

    pinCtrl.updateValueAndValidity();
    confirmPinCtrl.updateValueAndValidity();
    this.transferForm.updateValueAndValidity();
  }

  private pinMatchValidator = (control: {
    get: (name: string) => { value: string; setErrors: (e: Record<string, boolean>) => void } | null;
  }) => {
    const pin = control.get('pin')?.value;
    const confirmPin = control.get('confirmPin')?.value;
    if (pin && confirmPin && pin !== confirmPin) {
      control.get('confirmPin')?.setErrors({ pinMismatch: true });
      return { pinMismatch: true };
    }
    return null;
  };

  onPinSetupSubmit(): void {
    if (this.transferForm.invalid || this.isImpersonating()) return;

    this.pinSetupSubmitting.set(true);
    const pin = this.transferForm.value.pin ?? '';
    const confirmPin = this.transferForm.value.confirmPin ?? '';

    this.userService.setTransactionPin(pin, confirmPin).subscribe({
      next: () => {
        this.pinSetupSubmitting.set(false);
        this.transferForm.patchValue({ pin: '', confirmPin: '' });
        this.setFormState('FORM');
      },
      error: (err) => {
        this.pinSetupSubmitting.set(false);
        if (this.isImpersonationBlocked(err)) {
          this.modalService.open('error', 'Action Disabled', 'Action disabled during impersonation.');
          return;
        }
        const raw = err?.error?.message;
        const msg = Array.isArray(raw)
          ? raw.join(' ')
          : (raw ?? 'Could not set your PIN. Please try again.');
        this.modalService.open('error', 'PIN Setup Failed', msg);
      },
    });
  }

  onSubmit(): void {
    if (this.formState() !== 'FORM') return;
    if (this.transferForm.invalid || this.isFormDisabled()) {
      this.transferForm.markAllAsTouched();
      return;
    }

    this.pinError.set(null);
    this.recipientError.set(null);

    const recipientUsername = (this.transferForm.value.recipientUsername ?? '').trim();
    const fromWalletType = this.transferForm.value.fromWalletType;
    const toWalletType = this.transferForm.value.toWalletType;
    const amount = this.transferForm.value.amount;
    const pin = this.transferForm.value.pin ?? '';

    if (!recipientUsername || !fromWalletType || !toWalletType || !amount || amount <= 0) {
      return;
    }

    const selfUsername = this.currentUsername();
    if (
      selfUsername &&
      recipientUsername.toLowerCase() === selfUsername.toLowerCase()
    ) {
      this.recipientError.set('You cannot transfer funds to yourself.');
      return;
    }

    if (fromWalletType === toWalletType) {
      this.recipientError.set(null);
      this.modalService.open(
        'error',
        'Invalid Wallet Selection',
        'Source and target wallet must differ. Choose a different recipient wallet.',
      );
      return;
    }

    const request: FundTransferRequest = {
      recipientUsername,
      fromWalletType,
      toWalletType,
      amount,
      currency: this.transferCurrency(),
      pin,
    };

    this.isSubmitting.set(true);
    this.walletService.fundTransfer(request).subscribe({
      next: () => {
        this.isSubmitting.set(false);
        this.transferForm.patchValue({
          recipientUsername: '',
          amount: null,
          pin: '',
        });
      },
      error: (err: { friendlyMessage?: string; isIncorrectPin?: boolean }) => {
        this.isSubmitting.set(false);
        if (err?.isIncorrectPin) {
          this.pinError.set(err.friendlyMessage ?? 'Incorrect transaction PIN.');
          this.transferForm.get('pin')?.setErrors({ incorrectPin: true });
          return;
        }
        if (err?.friendlyMessage?.toLowerCase().includes('recipient user not found')) {
          this.recipientError.set('Recipient user not found. Check the username and try again.');
        }
      },
    });
  }

  private isImpersonationBlocked(err: unknown): boolean {
    const error = err as { status?: number; error?: { error?: string; code?: string } } | undefined;
    return (
      error?.status === 403 &&
      (error?.error?.error === 'IMPERSONATION_ACTION_BLOCKED' ||
        error?.error?.code === 'IMPERSONATION_ACTION_BLOCKED')
    );
  }
}
