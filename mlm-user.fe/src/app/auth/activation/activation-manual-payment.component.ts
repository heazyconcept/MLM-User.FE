import {
  Component,
  inject,
  ChangeDetectionStrategy,
  signal,
  computed,
  OnInit,
  OnDestroy,
  ChangeDetectorRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { forkJoin, Subscription, timer } from 'rxjs';
import { switchMap, takeWhile } from 'rxjs/operators';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { MessageModule } from 'primeng/message';
import { MessageService } from 'primeng/api';
import {
  RegistrationService,
  type CompanyBankAccount,
  type ManualRegistrationPayment,
} from '../../services/registration.service';
import { UserService } from '../../services/user.service';
import { getRequiredAmount } from '../../core/constants/registration.constants';

const EVIDENCE_ACCEPT = 'image/jpeg,image/png,image/gif,image/webp,application/pdf';
const MAX_EVIDENCE_BYTES = 10 * 1024 * 1024;
const POLL_INTERVAL_MS = 15_000;

type PageState = 'loading' | 'idle' | 'pending' | 'rejected' | 'approved';

@Component({
  selector: 'app-activation-manual-payment',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    ReactiveFormsModule,
    ButtonModule,
    InputTextModule,
    MessageModule,
  ],
  templateUrl: './activation-manual-payment.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ActivationManualPaymentComponent implements OnInit, OnDestroy {
  private router = inject(Router);
  private fb = inject(FormBuilder);
  private cdr = inject(ChangeDetectorRef);
  private registrationService = inject(RegistrationService);
  private userService = inject(UserService);
  private messageService = inject(MessageService);

  private pollSub: Subscription | null = null;

  pageState = signal<PageState>('loading');
  companyBank = signal<CompanyBankAccount | null>(null);
  manualPayment = signal<ManualRegistrationPayment | null>(null);
  errorMessage = signal<string | null>(null);
  submitting = signal(false);
  copiedAccount = signal(false);
  evidenceFile = signal<File | null>(null);
  evidencePreviewUrl = signal<string | null>(null);

  userCurrency = computed(() => this.userService.currentUser()?.currency ?? 'NGN');
  userPackage = computed(() => this.userService.currentUser()?.package ?? 'NICKEL');
  requiredAmount = computed(() =>
    getRequiredAmount(this.userPackage(), this.userCurrency()),
  );

  submitForm = this.fb.group({
    depositorName: ['', [Validators.required, Validators.minLength(2)]],
  });

  ngOnInit(): void {
    if (this.userService.isPaid()) {
      this.router.navigate(['/dashboard']);
      return;
    }
    this.loadPageData();
  }

  ngOnDestroy(): void {
    this.stopPolling();
    this.revokeEvidencePreview();
  }

  loadPageData(): void {
    this.pageState.set('loading');
    this.errorMessage.set(null);
    this.cdr.markForCheck();

    forkJoin({
      bank: this.registrationService.getCompanyBankAccount(),
      payment: this.registrationService.getManualPayment(),
    }).subscribe({
      next: ({ bank, payment }) => {
        this.companyBank.set(bank);
        this.applyManualPayment(payment);
        this.cdr.markForCheck();
      },
      error: () => {
        this.pageState.set('idle');
        this.errorMessage.set('Could not load payment details. Please try again.');
        this.cdr.markForCheck();
      },
    });
  }

  onEvidenceSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    const validationError = this.validateEvidenceFile(file);
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
    if (this.pageState() === 'pending' || this.submitting()) return;

    this.errorMessage.set(null);

    if (this.submitForm.invalid) {
      this.submitForm.markAllAsTouched();
      this.errorMessage.set('Depositor name is required.');
      this.cdr.markForCheck();
      return;
    }

    const evidence = this.evidenceFile();
    if (!evidence) {
      this.errorMessage.set('Payment evidence (receipt or screenshot) is required.');
      this.cdr.markForCheck();
      return;
    }

    const depositorName = String(this.submitForm.value.depositorName ?? '').trim();
    this.submitting.set(true);
    this.cdr.markForCheck();

    this.registrationService.submitManualPayment(depositorName, evidence).subscribe({
      next: (payment) => {
        this.submitting.set(false);
        this.applyManualPayment(payment);
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

  displayAmount(payment: ManualRegistrationPayment | null): string {
    if (payment?.amount != null && payment.amount > 0) {
      return this.formatAmount(payment.amount, payment.currency);
    }
    return this.formatAmount(this.requiredAmount(), this.userCurrency());
  }

  private applyManualPayment(payment: ManualRegistrationPayment | null): void {
    this.manualPayment.set(payment);

    if (payment?.status === 'APPROVED') {
      this.pageState.set('approved');
      this.stopPolling();
      this.handleApproved();
      return;
    }

    if (payment?.status === 'PENDING') {
      this.pageState.set('pending');
      this.submitForm.patchValue({ depositorName: payment.depositorName });
      this.startPolling();
      return;
    }

    if (payment?.status === 'REJECTED') {
      this.pageState.set('rejected');
      this.stopPolling();
      return;
    }

    this.pageState.set('idle');
    this.stopPolling();
  }

  private handleApproved(): void {
    this.userService.fetchProfile().subscribe({
      next: () => this.router.navigate(['/dashboard']),
      error: () => this.router.navigate(['/dashboard']),
    });
  }

  private startPolling(): void {
    this.stopPolling();
    this.pollSub = timer(POLL_INTERVAL_MS, POLL_INTERVAL_MS)
      .pipe(
        switchMap(() => this.registrationService.getManualPayment()),
        takeWhile((payment) => payment?.status === 'PENDING', true),
      )
      .subscribe((payment) => {
        if (!payment) return;
        if (payment.status !== 'PENDING') {
          this.applyManualPayment(payment);
          this.cdr.markForCheck();
        }
      });
  }

  private stopPolling(): void {
    this.pollSub?.unsubscribe();
    this.pollSub = null;
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
        : 'Could not submit payment. Please try again.';

    const lower = msgStr.toLowerCase();
    if (lower.includes('already paid') || lower.includes('already activated')) {
      this.userService.fetchProfile().subscribe(() => this.router.navigate(['/dashboard']));
      return;
    }
    if (lower.includes('pending manual payment')) {
      this.registrationService.getManualPayment().subscribe((payment) => {
        this.applyManualPayment(payment);
        this.cdr.markForCheck();
      });
      return;
    }

    this.errorMessage.set(msgStr);
    this.cdr.markForCheck();
  }

  private validateEvidenceFile(file: File): string | null {
    if (file.size > MAX_EVIDENCE_BYTES) {
      return 'Evidence file must be 10MB or smaller.';
    }
    const allowed = [
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
      'application/pdf',
    ];
    if (!allowed.includes(file.type)) {
      return 'Upload a JPEG, PNG, GIF, WebP image, or PDF receipt.';
    }
    return null;
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
