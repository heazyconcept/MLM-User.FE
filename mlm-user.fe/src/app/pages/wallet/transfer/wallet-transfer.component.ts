import { Component, ChangeDetectionStrategy, inject, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { InputNumberModule } from 'primeng/inputnumber';
import { ButtonModule } from 'primeng/button';
import { SelectModule } from 'primeng/select';
import { DynamicDialogConfig, DynamicDialogRef, DynamicDialogModule } from 'primeng/dynamicdialog';
import { WalletService, TransferRequest } from '../../../services/wallet.service';
import { UserService } from '../../../services/user.service';

type TargetWallet = 'AUTOSHIP' | 'VOUCHER' | 'REGISTRATION';

const TARGET_OPTIONS: { value: TargetWallet; label: string }[] = [
  { value: 'AUTOSHIP', label: 'Autoship Wallet' },
  { value: 'VOUCHER', label: 'Voucher Wallet' },
  { value: 'REGISTRATION', label: 'Registration Wallet' }
];

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
        <p class="text-xs font-semibold text-green-800 uppercase tracking-wide mb-1">From: Cash Wallet</p>
        <p class="text-lg font-bold text-green-700">{{ currencySymbol() }}{{ cashBalance() | number:'1.2-2' }}</p>
        <p class="text-[10px] text-green-600 mt-0.5">Available balance</p>
      </div>

      <form [formGroup]="transferForm" (ngSubmit)="onSubmit()" class="space-y-4">

        <!-- Target Wallet -->
        <div class="flex flex-col gap-1.5">
          <label for="target" class="text-sm font-semibold text-gray-700">Move to</label>
          <p-select
            formControlName="toWalletType"
            inputId="target"
            [options]="targetOptions"
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
            [max]="cashBalance()"
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
                Cannot exceed your cash balance.
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
              <span class="font-medium text-gray-700">Cash Wallet</span>
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

  currency = computed(() => this.userService.displayCurrency());
  currencySymbol = computed(() => (this.currency() === 'NGN' ? '₦' : '$'));

  cashBalance = computed(() => {
    const w = this.walletService.allWallets();
    const curr = this.currency();
    const wallet = w.find(ww => ww.currency === curr);
    return wallet?.cashBalance ?? 0;
  });

  targetOptions = TARGET_OPTIONS;
  isSubmitting = signal(false);

  transferForm: FormGroup;

  selectedTargetLabel = computed(() => {
    const val = this.transferForm?.get('toWalletType')?.value;
    return TARGET_OPTIONS.find(o => o.value === val)?.label ?? '';
  });

  constructor() {
    this.transferForm = this.fb.group({
      toWalletType: ['AUTOSHIP' as TargetWallet, Validators.required],
      amount: [null as number | null, [Validators.required, Validators.min(1)]]
    });
  }

  ngOnInit() {
    const data = this.config.data;
    // Pre-select target if passed from button
    if (data?.toWalletType) {
      this.transferForm.patchValue({ toWalletType: data.toWalletType });
    }
    // Set max validator based on cash balance
    const max = this.cashBalance();
    if (max > 0) {
      this.transferForm.get('amount')?.addValidators(Validators.max(max));
      this.transferForm.get('amount')?.updateValueAndValidity();
    }
  }

  onSubmit() {
    if (this.transferForm.invalid) {
      this.transferForm.markAllAsTouched();
      return;
    }

    const { toWalletType, amount } = this.transferForm.value;
    if (!toWalletType || !amount || amount <= 0) return;

    this.isSubmitting.set(true);

    const request: TransferRequest = {
      fromWalletType: 'CASH',
      toWalletType,
      amount,
      currency: this.currency()
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
