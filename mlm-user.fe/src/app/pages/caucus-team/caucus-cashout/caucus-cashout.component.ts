import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputTextModule } from 'primeng/inputtext';
import { formatCaucusNgn } from '../../../core/utils/caucus-format.util';
import { AuthService } from '../../../services/auth.service';
import { CaucusService } from '../../../services/caucus.service';
import { ModalService } from '../../../services/modal.service';
import { OnboardingService } from '../../../services/onboarding.service';
import { UserService } from '../../../services/user.service';
import { CaucusPageHeaderComponent } from '../components/caucus-page-header.component';
import { CaucusPageShellComponent } from '../components/caucus-page-shell.component';
import { CaucusPanelComponent } from '../components/caucus-panel.component';

@Component({
  selector: 'app-caucus-cashout',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    ButtonModule,
    InputNumberModule,
    InputTextModule,
    CaucusPageShellComponent,
    CaucusPageHeaderComponent,
    CaucusPanelComponent,
  ],
  templateUrl: './caucus-cashout.component.html',
})
export class CaucusCashoutComponent implements OnInit {
  private readonly caucus = inject(CaucusService);
  private readonly userService = inject(UserService);
  private readonly onboarding = inject(OnboardingService);
  private readonly auth = inject(AuthService);
  private readonly modal = inject(ModalService);
  private readonly router = inject(Router);

  amount = signal(0);
  pin = signal('');
  submitting = signal(false);
  error = signal<string | null>(null);
  bank = signal<{ bankName: string; accountNumber: string; accountName: string } | null>(null);

  me = this.caucus.me;
  isImpersonating = computed(() => !!this.auth.impersonation());
  hasPin = computed(() => this.userService.currentUser()?.hasTransactionPin ?? false);
  hasBank = computed(() => !!this.bank());
  balance = computed(() => this.me()?.wallet?.balanceNgn ?? 0);

  formatMoney = formatCaucusNgn;

  ngOnInit(): void {
    this.caucus.loadMe().subscribe((m) => {
      this.amount.set(m?.wallet?.balanceNgn ?? 0);
    });
    this.loadBank();
  }

  onPinChange(value: string): void {
    this.pin.set(value.replace(/\D/g, '').slice(0, 4));
  }

  canSubmit(): boolean {
    const bal = this.balance();
    const amt = this.amount();
    return (
      !this.isImpersonating() &&
      this.hasPin() &&
      this.hasBank() &&
      amt >= 0.01 &&
      amt <= bal &&
      /^\d{4}$/.test(this.pin())
    );
  }

  submit(): void {
    if (!this.canSubmit()) {
      return;
    }
    this.submitting.set(true);
    this.error.set(null);
    this.caucus.withdraw(this.amount(), this.pin()).subscribe({
      next: () => {
        this.submitting.set(false);
        const bank = this.bank();
        this.modal.open(
          'success',
          'Cash out submitted',
          `Your cash out of ${formatCaucusNgn(this.amount())} has been submitted. Payout will be processed to ${bank?.bankName ?? 'your bank'}.`,
        );
        void this.router.navigate(['/caucus']);
      },
      error: (err: Error) => {
        this.submitting.set(false);
        this.error.set(err.message);
      },
    });
  }

  private loadBank(): void {
    const u = this.userService.currentUser();
    if (u?.bankName && u.accountNumber) {
      this.bank.set({
        bankName: u.bankName,
        accountNumber: u.accountNumber,
        accountName: u.accountName ?? '',
      });
      return;
    }
    this.onboarding.getBankDetails().subscribe({
      next: (data: Record<string, unknown>) => {
        const bankName = String(data['bankName'] ?? data['bank_name'] ?? '');
        const accountNumber = String(
          data['accountNumber'] ??
            data['account_number'] ??
            data['accountNumberMasked'] ??
            data['account_number_masked'] ??
            '',
        );
        const accountName = String(data['accountName'] ?? data['account_name'] ?? '');
        if (bankName && accountNumber) {
          this.bank.set({ bankName, accountNumber, accountName });
        }
      },
      error: () => undefined,
    });
  }
}
