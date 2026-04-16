import { Component, ChangeDetectionStrategy, inject, OnInit, signal, computed, type Signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { CommonModule, DecimalPipe } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { startWith } from 'rxjs';
import { CardModule } from 'primeng/card';
import { InputNumberModule } from 'primeng/inputnumber';
import { ButtonModule } from 'primeng/button';
import { MessageModule } from 'primeng/message';
import { DynamicDialogConfig, DynamicDialogRef, DynamicDialogModule } from 'primeng/dynamicdialog';
import { ConfirmationService } from 'primeng/api';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { Router } from '@angular/router';
import { WalletService } from '../../../services/wallet.service';
import { UserService } from '../../../services/user.service';
import { formatWithdrawalAmountInWords } from '../../../core/utils/amount-in-words';

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
    ConfirmDialogModule
  ],
  templateUrl: './withdrawal.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class WithdrawalComponent implements OnInit {
  private config = inject(DynamicDialogConfig);
  private ref = inject(DynamicDialogRef);
  private fb = inject(FormBuilder);
  private walletService = inject(WalletService);
  private userService = inject(UserService);
  private confirmationService = inject(ConfirmationService);
  private router = inject(Router);


  currency = signal<'NGN' | 'USD' | null>(null);
  wallet = computed(() => {
    const curr = this.currency();
    return curr ? this.walletService.getWallet(curr)() : null;
  });

  bankDetails = computed(() => {
    const user = this.userService.currentUser();
    return {
      bankName: user?.bankName,
      accountNumber: user?.accountNumber,
      accountName: user?.accountName
    };
  });

  withdrawalForm: FormGroup;
  isSubmitting = signal(false);

  /** Latest amount control value for spelled-out line */
  private amountValue!: Signal<number | null>;
  /** e.g. "ten thousand naira" */
  amountInWords = computed(() =>
    formatWithdrawalAmountInWords(this.amountValue(), this.currency())
  );

  constructor() {
    this.withdrawalForm = this.fb.group({
      amount: [null, [Validators.required, Validators.min(0.01)]]
    });
    const amountCtrl = this.withdrawalForm.get('amount')!;
    this.amountValue = toSignal(amountCtrl.valueChanges.pipe(startWith(amountCtrl.value)), {
      initialValue: amountCtrl.value as number | null
    });
  }

  ngOnInit() {
    const data = this.config.data;
    if (data && data.currency) {
      this.currency.set(data.currency);
      const w = this.walletService.getWallet(data.currency as 'NGN' | 'USD')();
      if (w) {
        this.withdrawalForm.get('amount')?.addValidators(Validators.max(w.cashBalance));
        this.withdrawalForm.get('amount')?.updateValueAndValidity();
      }
    }
  }

  onSubmit() {
    if (this.withdrawalForm.valid && this.hasBankDetails()) {
      const amount = this.withdrawalForm.value.amount as number;
      const bank = this.bankDetails();
      const formattedAmount = WithdrawalComponent.formatAmountWithCommas(amount);

      this.confirmationService.confirm({
        message: `Confirm withdrawal of ${this.currency() === 'NGN' ? '₦' : '$'}${formattedAmount} to ${bank.bankName} (${bank.accountNumber})?`,
        header: 'Confirm Withdrawal',
        icon: 'pi pi-exclamation-triangle',
        acceptButtonProps: { label: 'Confirm', severity: 'success' },
        rejectButtonProps: { label: 'Cancel', severity: 'secondary', outlined: true },
        accept: () => {
          this.processWithdrawal();
        }
      });
    }
  }

  hasBankDetails(): boolean {
    const bank = this.bankDetails();
    return !!(bank.bankName && bank.accountNumber && bank.accountName);
  }

  private processWithdrawal() {
    this.isSubmitting.set(true);
    const amount = this.withdrawalForm.value.amount;
    const curr = this.currency()!;
    const bank = this.bankDetails();

    this.walletService.withdraw({
      currency: curr,
      amount,
      bankName: bank.bankName!,
      accountNumber: bank.accountNumber!,
      accountName: bank.accountName!
    }).subscribe({
      next: (created) => {
        this.walletService.fetchWallets().subscribe();
        this.isSubmitting.set(false);
        this.ref.close(true);
        this.router.navigate(['/withdrawals', created.id]);
      },
      error: () => {
        this.isSubmitting.set(false);
      }
    });
  }

  cancel() {
    this.ref.close();
  }

  /** Matches display style e.g. 50,000,001.00 */
  private static formatAmountWithCommas(amount: number): string {
    return amount.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  }
}


