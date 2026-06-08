import { Component, ChangeDetectionStrategy, inject, OnInit, signal, computed, effect } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { InputNumberModule } from 'primeng/inputnumber';
import { ButtonModule } from 'primeng/button';
import { SelectModule } from 'primeng/select';
import { DynamicDialogConfig, DynamicDialogRef, DynamicDialogModule } from 'primeng/dynamicdialog';
import { WalletService, TransferRequest } from '../../../services/wallet.service';
import { UserService } from '../../../services/user.service';

type SourceWallet = 'CASH' | 'REGISTRATION';
type TargetWallet = 'VOUCHER' | 'REGISTRATION' | 'CASH';

const SOURCE_OPTIONS: { value: SourceWallet; label: string }[] = [
  { value: 'CASH', label: 'Cash Wallet' },
  { value: 'REGISTRATION', label: 'Registration Wallet' }
];

const TARGET_OPTIONS_MAP: Record<SourceWallet, { value: TargetWallet; label: string }[]> = {
  CASH: [
    { value: 'VOUCHER', label: 'Product Voucher Wallet' },
    { value: 'REGISTRATION', label: 'Registration Wallet' }
  ],
  REGISTRATION: [
    { value: 'VOUCHER', label: 'Product Voucher Wallet' },
    { value: 'CASH', label: 'Cash Wallet' }
  ]
};

@Component({
  selector: 'app-wallet-transfer',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    DynamicDialogModule,
    InputNumberModule,
    ButtonModule,
    SelectModule
  ],
  template: `
    <div class="space-y-5">

      <!-- Source Wallet Info -->
      <div class="p-4 bg-green-50 rounded-xl border border-green-100">
        <p class="text-xs font-semibold text-green-800 uppercase tracking-wide mb-1">From: {{ selectedSourceLabel() }}</p>
        <p class="text-lg font-bold text-green-700">{{ currencySymbol() }}{{ sourceBalance() | number:'1.2-2' }}</p>
        <p class="text-[10px] text-green-600 mt-0.5">Available balance</p>
      </div>

      <form [formGroup]="transferForm" (ngSubmit)="onSubmit()" class="space-y-4">

        <!-- Source Wallet Selection -->
        <div class="flex flex-col gap-1.5">
          <label for="source" class="text-sm font-semibold text-gray-700">Transfer from</label>
          <p-select
            formControlName="fromWalletType"
            inputId="source"
            [options]="sourceOptions"
            optionLabel="label"
            optionValue="value"
            placeholder="Select source wallet"
            styleClass="w-full">
          </p-select>
        </div>

        <!-- Target Wallet -->
        <div class="flex flex-col gap-1.5">
          <label for="target" class="text-sm font-semibold text-gray-700">Move to</label>
          <p-select
            formControlName="toWalletType"
            inputId="target"
            [options]="targetOptions()"
            optionLabel="label"
            optionValue="value"
            placeholder="Select target wallet"
            styleClass="w-full">
          </p-select>
        </div>

        <!-- Amount -->
        <div class="flex flex-col gap-1.5">
          <label for="amount" class="text-sm font-semibold text-gray-700">Amount</label>
          <p-inputNumber
            formControlName="amount"
            inputId="amount"
            [mode]="'currency'"
            [currency]="currency()"
            [currencyDisplay]="'symbol'"
            [min]="1"
            [max]="sourceBalance()"
            fluid="true"
            placeholder="0.00">
          </p-inputNumber>
          @if (transferForm.get('amount')?.invalid && (transferForm.get('amount')?.dirty || transferForm.get('amount')?.touched)) {
            <small class="text-red-500 text-xs">
              @if (transferForm.get('amount')?.errors?.['required']) {
                Amount is required.
              }
              @if (transferForm.get('amount')?.errors?.['min']) {
                Minimum amount is {{ currencySymbol() }}1.
              }
              @if (transferForm.get('amount')?.errors?.['max']) {
                Cannot exceed selected wallet balance.
              }
            </small>
          }
        </div>

        <!-- Summary -->
        @if (transferForm.valid) {
          <div class="p-3 bg-gray-50 rounded-lg border border-gray-200 text-xs space-y-1">
            <div class="flex justify-between">
              <span class="text-gray-500">Transfer</span>
              <span class="font-bold text-gray-900">{{ currencySymbol() }}{{ transferForm.value.amount | number:'1.2-2' }}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-gray-500">From</span>
              <span class="font-medium text-gray-700">{{ selectedSourceLabel() }}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-gray-500">To</span>
              <span class="font-medium text-gray-700">{{ selectedTargetLabel() }}</span>
            </div>
          </div>
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
            label="Transfer"
            icon="pi pi-arrow-right"
            [loading]="isSubmitting()"
            [disabled]="transferForm.invalid || isSubmitting()">
          </p-button>
        </div>
      </form>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class WalletTransferComponent implements OnInit {
  private config = inject(DynamicDialogConfig);
  private ref = inject(DynamicDialogRef);
  private fb = inject(FormBuilder);
  private walletService = inject(WalletService);
  private userService = inject(UserService);

  private transferCurrency = signal<'NGN' | 'USD'>(this.userService.displayCurrency());
  currency = computed(() => this.transferCurrency());
  currencySymbol = computed(() => (this.transferCurrency() === 'NGN' ? '₦' : '$'));

  sourceOptions = SOURCE_OPTIONS;

  transferForm = this.fb.group({
    fromWalletType: ['CASH' as SourceWallet, Validators.required],
    toWalletType: ['VOUCHER' as TargetWallet, Validators.required],
    amount: [null as number | null, [Validators.required, Validators.min(1)]]
  });

  private fromWalletTypeValue = signal<SourceWallet>('CASH');
  private toWalletTypeValue = signal<TargetWallet>('VOUCHER');

  sourceBalance = computed(() => {
    const w = this.walletService.allWallets();
    const curr = this.transferCurrency();
    const wallet = w.find(ww => ww.currency === curr);
    const source = this.fromWalletTypeValue();
    if (source === 'REGISTRATION') {
      return wallet?.registrationBalance ?? 0;
    }
    return wallet?.cashBalance ?? 0;
  });

  targetOptions = computed(() => {
    const source = this.fromWalletTypeValue();
    return TARGET_OPTIONS_MAP[source] ?? [];
  });

  isSubmitting = signal(false);

  selectedTargetLabel = computed(() => {
    const val = this.toWalletTypeValue();
    const source = this.fromWalletTypeValue();
    const options = TARGET_OPTIONS_MAP[source] ?? [];
    return options.find(o => o.value === val)?.label ?? '';
  });

  selectedSourceLabel = computed(() => {
    const val = this.fromWalletTypeValue();
    return SOURCE_OPTIONS.find(o => o.value === val)?.label ?? '';
  });

  constructor() {
    this.transferForm.get('fromWalletType')!.valueChanges.pipe(
      takeUntilDestroyed()
    ).subscribe(val => {
      if (val) this.fromWalletTypeValue.set(val as SourceWallet);
    });

    this.transferForm.get('toWalletType')!.valueChanges.pipe(
      takeUntilDestroyed()
    ).subscribe(val => {
      if (val) this.toWalletTypeValue.set(val as TargetWallet);
    });

    // Adjust target options if selected target is no longer valid for the selected source
    effect(() => {
      const source = this.fromWalletTypeValue();
      const target = this.toWalletTypeValue();
      
      const validTargets = TARGET_OPTIONS_MAP[source] ?? [];
      if (!validTargets.some(t => t.value === target)) {
        this.transferForm.patchValue({ toWalletType: 'VOUCHER' as TargetWallet });
      }
    });

    // Update validators on amount control dynamically when source balance changes
    effect(() => {
      const max = this.sourceBalance();
      const amountCtrl = this.transferForm.get('amount');
      if (amountCtrl) {
        amountCtrl.clearValidators();
        amountCtrl.setValidators([Validators.required, Validators.min(1), Validators.max(max)]);
        amountCtrl.updateValueAndValidity();
      }
    });
  }

  ngOnInit() {
    const data = this.config.data;
    // Pre-select source and target if passed from button
    if (data?.fromWalletType) {
      this.transferForm.patchValue({ fromWalletType: data.fromWalletType });
      this.fromWalletTypeValue.set(data.fromWalletType);
    }
    if (data?.toWalletType) {
      this.transferForm.patchValue({ toWalletType: data.toWalletType });
      this.toWalletTypeValue.set(data.toWalletType);
    }

    const incomingCurrency = data?.currency;
    if (incomingCurrency === 'NGN' || incomingCurrency === 'USD') {
      this.transferCurrency.set(incomingCurrency);
    }
  }

  onSubmit() {
    if (this.transferForm.invalid) {
      this.transferForm.markAllAsTouched();
      return;
    }

    const { fromWalletType, toWalletType, amount } = this.transferForm.value;
    if (!fromWalletType || !toWalletType || !amount || amount <= 0) return;

    this.isSubmitting.set(true);

    const request: TransferRequest = {
      fromWalletType,
      toWalletType,
      amount,
      currency: this.transferCurrency()
    };

    this.walletService.transferBetweenWallets(request).subscribe({
      next: () => {
        this.isSubmitting.set(false);
        this.ref.close(true);
      },
      error: () => {
        this.isSubmitting.set(false);
        this.ref.close(false);
      }
    });
  }

  cancel() {
    this.ref.close();
  }
}
