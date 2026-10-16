import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  input,
  OnInit,
  output,
  signal,
} from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ButtonModule } from 'primeng/button';
import { InputNumberModule } from 'primeng/inputnumber';
import { SelectModule } from 'primeng/select';
import { DynamicDialogConfig, DynamicDialogRef } from 'primeng/dynamicdialog';
import { AuthService } from '../../../services/auth.service';
import { LegacyClubService } from '../../../services/legacy-club.service';
import { UserService } from '../../../services/user.service';
import { TransferRequest, WalletService } from '../../../services/wallet.service';
import { LegacyPanelComponent } from './legacy-panel.component';

export type VoucherBridgeDirection = 'to-legacy' | 'to-network';

const DIRECTION_OPTIONS: { value: VoucherBridgeDirection; label: string }[] = [
  {
    value: 'to-legacy',
    label: 'Network Product Voucher → Legacy product voucher',
  },
  {
    value: 'to-network',
    label: 'Legacy product voucher → Network Product Voucher',
  },
];

@Component({
  selector: 'app-voucher-bridge-transfer',
  imports: [
    CommonModule,
    DecimalPipe,
    ReactiveFormsModule,
    RouterLink,
    ButtonModule,
    InputNumberModule,
    SelectModule,
    LegacyPanelComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './voucher-bridge-transfer.component.html',
})
export class VoucherBridgeTransferComponent implements OnInit {
  private router = inject(Router);
  private fb = inject(FormBuilder);
  private auth = inject(AuthService);
  private userService = inject(UserService);
  private walletService = inject(WalletService);
  private legacyClub = inject(LegacyClubService);
  private destroyRef = inject(DestroyRef);
  private dialogConfig = inject(DynamicDialogConfig, { optional: true });
  private dialogRef = inject(DynamicDialogRef, { optional: true });

  /** Legacy voucher balance from parent (e.g. legacy voucher page). */
  legacyVoucherBalance = input<number | undefined>(undefined);
  initialDirection = input<VoucherBridgeDirection>('to-legacy');
  /** When false, render without outer legacy panel (e.g. dialog). */
  showPanel = input(true);
  transferred = output<void>();

  private dialogHidePanel = signal(false);
  showPanelEffective = computed(() => !this.dialogHidePanel() && this.showPanel());

  private legacyBalanceLoaded = signal(0);
  displayLegacyVoucherBalance = computed(
    () => this.legacyVoucherBalance() ?? this.legacyBalanceLoaded(),
  );

  directionOptions = DIRECTION_OPTIONS;
  submitting = signal(false);
  private direction = signal<VoucherBridgeDirection>('to-legacy');

  isImpersonating = computed(() => !!this.auth.impersonation());
  currency = computed(() => this.userService.displayCurrency());
  currencySymbol = computed(() => (this.currency() === 'NGN' ? '₦' : '$'));
  isLegacyMember = this.legacyClub.isMember;

  networkVoucherBalance = computed(() => {
    const wallet = this.walletService
      .allWallets()
      .find((item) => item.currency === this.currency());
    return wallet?.voucherBalance ?? 0;
  });

  sourceBalance = computed(() =>
    this.direction() === 'to-legacy'
      ? this.networkVoucherBalance()
      : this.displayLegacyVoucherBalance(),
  );

  transferForm = this.fb.group({
    direction: ['to-legacy' as VoucherBridgeDirection, Validators.required],
    amount: [null as number | null, [Validators.required, Validators.min(1)]],
  });

  ngOnInit(): void {
    const data = this.dialogConfig?.data as
      | { initialDirection?: VoucherBridgeDirection; showPanel?: boolean }
      | undefined;
    const initial = data?.initialDirection ?? this.initialDirection();
    this.direction.set(initial);
    this.transferForm.patchValue({ direction: initial });
    if (data?.showPanel === false) {
      this.dialogHidePanel.set(true);
    }

    this.walletService.fetchWallets().subscribe();
    this.legacyClub.loadMe().subscribe({ error: () => undefined });
    this.refreshLegacyBalance();

    this.transferForm
      .get('direction')
      ?.valueChanges.pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((value) => {
        if (value === 'to-legacy' || value === 'to-network') {
          this.direction.set(value);
          this.transferForm.patchValue({ amount: null });
          this.transferForm.markAsPristine();
        }
      });
  }

  amountInvalid(): boolean {
    const control = this.transferForm.get('amount');
    return !!control && control.invalid && (control.dirty || control.touched);
  }

  transfer(): void {
    if (this.transferForm.invalid || this.isImpersonating()) {
      this.transferForm.markAllAsTouched();
      return;
    }

    const direction = this.transferForm.value.direction;
    const amount = this.transferForm.value.amount;
    if (!direction || amount == null || amount < 1) return;

    const fromWalletType = direction === 'to-legacy' ? 'VOUCHER' : 'LEGACY_VOUCHER';
    const toWalletType = direction === 'to-legacy' ? 'LEGACY_VOUCHER' : 'VOUCHER';
    const request: TransferRequest = {
      fromWalletType,
      toWalletType,
      amount,
      currency: this.currency(),
    };

    this.submitting.set(true);
    this.walletService
      .transferBetweenWallets(request, {
        suppressSuccessModal: !!this.dialogRef,
      })
      .subscribe({
        next: () => {
          this.submitting.set(false);
          this.transferForm.patchValue({ amount: null });
          this.transferForm.markAsPristine();
          this.refreshLegacyBalance();
          this.transferred.emit();
          if (this.dialogRef) {
            this.dialogRef.close(true);
            setTimeout(() => this.walletService.showTransferSuccessModal(request), 0);
          }
        },
        error: (err) => {
          this.submitting.set(false);
          const code = err?.error?.code as string | undefined;
          if (code === 'NOT_LEGACY_MEMBER') {
            this.dialogRef?.close(false);
            void this.router.navigate(['/legacy']);
          }
        },
      });
  }

  private refreshLegacyBalance(): void {
    this.legacyClub.getVoucher().subscribe({
      next: (res) => this.legacyBalanceLoaded.set(res.balance),
      error: () => undefined,
    });
  }
}
