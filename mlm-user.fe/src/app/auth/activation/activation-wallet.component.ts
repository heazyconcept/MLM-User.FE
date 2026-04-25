import {
  Component,
  inject,
  ChangeDetectionStrategy,
  signal,
  ChangeDetectorRef,
  OnInit,
  computed
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { InputNumberModule } from 'primeng/inputnumber';
import { SelectModule } from 'primeng/select';
import { MessageModule } from 'primeng/message';
import { RegistrationService, type RegistrationWallet } from '../../services/registration.service';
import { WalletService } from '../../services/wallet.service';
import { UserService } from '../../services/user.service';
import { getRequiredAmount } from '../../core/constants/registration.constants';

@Component({
  selector: 'app-activation-wallet',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    ReactiveFormsModule,
    ButtonModule,
    InputNumberModule,
    SelectModule,
    MessageModule
  ],
  templateUrl: './activation-wallet.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ActivationWalletComponent implements OnInit {
  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef);
  private fb = inject(FormBuilder);
  private registrationService = inject(RegistrationService);
  private walletService = inject(WalletService);
  private userService = inject(UserService);

  registrationWallet = signal<RegistrationWallet | null>(null);
  loading = signal(true);
  errorMessage = signal<string | null>(null);
  transferring = signal(false);
  activating = signal(false);

  currencyOptions = [
    { label: 'NGN', value: 'NGN' },
    { label: 'USD', value: 'USD' }
  ];

  userCurrency = computed(() => this.userService.currentUser()?.currency ?? 'NGN');
  userPackage = computed(() => this.userService.currentUser()?.package ?? 'NICKEL');
  requiredAmount = computed(() =>
    getRequiredAmount(this.userPackage(), this.userCurrency())
  );
  cashBalance = computed(() => {
    const wallet = this.walletService.getWallet(this.userCurrency())();
    return wallet?.cashBalance ?? 0;
  });

  transferForm = this.fb.group({
    amount: [0, [Validators.required, Validators.min(0.01)]],
    currency: ['NGN' as 'NGN' | 'USD', Validators.required]
  });

  canActivate = computed(() => {
    const wallet = this.registrationWallet();
    if (!wallet) return false;
    const required = this.requiredAmount();
    return wallet.balance >= required;
  });

  ngOnInit(): void {
    this.loadData();
  }

  private loadData(): void {
    this.loading.set(true);
    this.errorMessage.set(null);
    this.cdr.markForCheck();

    this.registrationService.getRegistrationWallet().subscribe({
      next: (wallet) => {
        this.registrationWallet.set(wallet);
        this.loading.set(false);
        this.cdr.markForCheck();
      },
      error: () => {
        this.registrationWallet.set(null);
        this.loading.set(false);
        this.cdr.markForCheck();
      }
    });

    // Skip fetchWallets when unactivated — GET /wallets returns 403 for unactivated users.
    // CASH balance will show 0; user can add funds or pay online.
    if (this.userService.isPaid()) {
      this.walletService.fetchWallets().subscribe({
        next: () => this.cdr.markForCheck(),
        error: () => {}
      });
    }
  }

  onTransfer(): void {
    if (!this.transferForm.valid) return;
    const { amount, currency } = this.transferForm.value;
    if (amount == null || amount <= 0 || !currency) return;

    this.transferring.set(true);
    this.errorMessage.set(null);
    this.cdr.markForCheck();

    this.registrationService.transferToRegistration(amount, currency).subscribe({
      next: () => {
        this.transferring.set(false);
        this.transferForm.patchValue({ amount: 0 });
        this.loadData();
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.transferring.set(false);
        const msg = err?.error?.message ?? (Array.isArray(err?.error?.message) ? err.error.message?.[0] : null)
          ?? 'Transfer failed. Please try again.';
        this.errorMessage.set(msg);
        this.cdr.markForCheck();
      }
    });
  }

  onActivate(): void {
    if (!this.canActivate()) return;

    this.activating.set(true);
    this.errorMessage.set(null);
    this.cdr.markForCheck();

    this.registrationService.activate().subscribe({
      next: () => {
        this.activating.set(false);
        this.userService.fetchProfile().subscribe({
          next: () => {
            this.router.navigate(['/dashboard']);
          },
          error: () => this.router.navigate(['/dashboard']),
          complete: () => this.cdr.markForCheck()
        });
      },
      error: (err) => {
        this.activating.set(false);
        const msg = err?.error?.message ?? (Array.isArray(err?.error?.message) ? err.error.message?.[0] : null)
          ?? (typeof err?.error === 'string' ? err.error : null);
        const msgStr = typeof msg === 'string' ? msg : 'Activation failed. Please try again.';
        if (msgStr.toLowerCase().includes('already activated')) {
          this.userService.fetchProfile().subscribe(() => {
            this.router.navigate(['/dashboard']);
          });
          return;
        }
        this.errorMessage.set(msgStr);
        this.cdr.markForCheck();
      }
    });
  }

  formatAmount(amount: number, currency: 'NGN' | 'USD'): string {
    const sym = currency === 'NGN' ? '₦' : '$';
    return `${sym}${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
}
