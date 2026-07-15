import {
  afterNextRender,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  computed,
  ElementRef,
  inject,
  OnInit,
  signal,
  viewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  ReactiveFormsModule,
  FormBuilder,
  Validators,
  AbstractControl,
  ValidationErrors,
  ValidatorFn,
} from '@angular/forms';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { CardModule } from 'primeng/card';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { TextareaModule } from 'primeng/textarea';
import { BadgeModule } from 'primeng/badge';
import { DynamicDialogConfig, DynamicDialogRef } from 'primeng/dynamicdialog';
import { UserService } from '../../services/user.service';
import { OnboardingService } from '../../services/onboarding.service';
import { ModalService } from '../../services/modal.service';
import { forkJoin, of } from 'rxjs';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    ReactiveFormsModule,
    CardModule,
    ButtonModule,
    InputTextModule,
    TextareaModule,
    BadgeModule,
  ],
  templateUrl: './profile.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProfileComponent implements OnInit {
  private fb = inject(FormBuilder);
  private userService = inject(UserService);
  private onboardingService = inject(OnboardingService);
  private modalService = inject(ModalService);
  private cdr = inject(ChangeDetectorRef);
  private route = inject(ActivatedRoute);
  private dialogConfig = inject(DynamicDialogConfig, { optional: true });
  private dialogRef = inject(DynamicDialogRef, { optional: true });
  private transactionPinSection = viewChild<ElementRef<HTMLElement>>('transactionPinSection');
  private shouldScrollToTransactionPin = signal(false);

  isEditMode = signal<boolean>(false);
  isSaving = signal<boolean>(false);
  isChangingPassword = signal<boolean>(false);
  hasPin = computed(() => this.userService.currentUser()?.hasTransactionPin ?? false);
  pinFormState = signal<'IDLE' | 'CHANGE' | 'RESET_REQUEST' | 'RESET' | 'SETUP'>('IDLE');
  isPinSaving = signal(false);
  currentUser = this.userService.currentUser;
  isDialogMode = signal<boolean>(false);
  private closeOnSave = true;

  profileForm = this.fb.group({
    firstName: ['', [Validators.required]],
    lastName: ['', [Validators.required]],
    email: [{ value: '', disabled: true }],
    phoneNumber: ['', [Validators.required, Validators.pattern(/^[0-9]{11}$/)]],
    address: [''],
    bankName: [''],
    accountNumber: [''],
    accountName: [''],
    accountType: ['SAVINGS'],
  });

  passwordForm = this.fb.group(
    {
      currentPassword: ['', [Validators.required]],
      newPassword: ['', [Validators.required, Validators.minLength(6)]],
      confirmPassword: ['', [Validators.required]],
    },
    { validators: this.confirmMatchValidator() },
  );

  changePinForm = this.fb.group(
    {
      oldPin: ['', [Validators.required, Validators.pattern(/^\d{4}$/)]],
      newPin: ['', [Validators.required, Validators.pattern(/^\d{4}$/)]],
      confirmNewPin: ['', [Validators.required, Validators.pattern(/^\d{4}$/)]],
    },
    { validators: this.confirmPinMatchValidator('newPin', 'confirmNewPin') },
  );

  resetPinForm = this.fb.group(
    {
      otp: ['', [Validators.required, Validators.minLength(4)]],
      newPin: ['', [Validators.required, Validators.pattern(/^\d{4}$/)]],
      confirmNewPin: ['', [Validators.required, Validators.pattern(/^\d{4}$/)]],
    },
    { validators: this.confirmPinMatchValidator('newPin', 'confirmNewPin') },
  );

  setupPinForm = this.fb.group(
    {
      pin: ['', [Validators.required, Validators.pattern(/^\d{4}$/)]],
      confirmPin: ['', [Validators.required, Validators.pattern(/^\d{4}$/)]],
    },
    { validators: this.confirmPinMatchValidator('pin', 'confirmPin') },
  );

  constructor() {
    afterNextRender(() => {
      if (!this.shouldScrollToTransactionPin()) return;
      this.transactionPinSection()?.nativeElement.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
    });
  }

  ngOnInit(): void {
    const dialogData = this.dialogConfig?.data as
      { startInEdit?: boolean; dialogMode?: boolean; closeOnSave?: boolean } | undefined;
    if (dialogData?.dialogMode) {
      this.isDialogMode.set(true);
      this.closeOnSave = dialogData.closeOnSave !== false;
    }

    const user = this.currentUser();
    if (user) {
      this.populateForm(user);
    }

    if (dialogData?.startInEdit) {
      this.isEditMode.set(true);
    }

    if (this.route.snapshot.queryParamMap.get('pinAction') === 'setup' && !this.hasPin()) {
      this.showSetupPin();
      this.shouldScrollToTransactionPin.set(true);
    }

    // Reactive bank validators: conditionally require bank fields only if any bank details are filled in
    this.profileForm.valueChanges.subscribe(() => {
      const bankName = this.profileForm.get('bankName')?.value;
      const accountNumber = this.profileForm.get('accountNumber')?.value;
      const accountName = this.profileForm.get('accountName')?.value;

      const hasAny = !!(bankName?.trim() || accountNumber?.trim() || accountName?.trim());

      const bankNameCtrl = this.profileForm.get('bankName');
      const accountNumberCtrl = this.profileForm.get('accountNumber');
      const accountNameCtrl = this.profileForm.get('accountName');

      if (hasAny) {
        bankNameCtrl?.setValidators([Validators.required]);
        accountNumberCtrl?.setValidators([Validators.required, Validators.pattern(/^\d{8,11}$/)]);
        accountNameCtrl?.setValidators([Validators.required]);
      } else {
        bankNameCtrl?.clearValidators();
        accountNumberCtrl?.clearValidators();
        accountNameCtrl?.clearValidators();
      }

      bankNameCtrl?.updateValueAndValidity({ emitEvent: false });
      accountNumberCtrl?.updateValueAndValidity({ emitEvent: false });
      accountNameCtrl?.updateValueAndValidity({ emitEvent: false });
    });

    // Load bank details
    this.onboardingService.getBankDetails().subscribe({
      next: (data: Record<string, unknown>) => {
        const bankName = (data['bankName'] ?? data['bank_name']) as string | undefined;
        const accountNumber = (data['accountNumber'] ?? data['account_number']) as
          string | undefined;
        const accountNumberMasked = (data['accountNumberMasked'] ??
          data['account_number_masked']) as string | undefined;
        const accountName = (data['accountName'] ?? data['account_name']) as string | undefined;
        const accountType = (data['accountType'] ?? data['account_type']) as string | undefined;
        const displayAccountNumber = accountNumber ?? accountNumberMasked;
        if (bankName || displayAccountNumber || accountName || accountType) {
          this.userService.updateProfile({
            bankName: bankName ?? undefined,
            accountNumber: displayAccountNumber ?? undefined,
            accountName: accountName ?? undefined,
          });
          this.profileForm.patchValue({
            bankName: bankName ?? '',
            accountNumber: displayAccountNumber ?? '',
            accountName: accountName ?? '',
            accountType: accountType?.toUpperCase() === 'CURRENT' ? 'CURRENT' : 'SAVINGS',
          });
          this.cdr.markForCheck();
        }
      },
      error: () => {
        /* silently ignore */
      },
    });
  }

  private populateForm(user: NonNullable<ReturnType<typeof this.currentUser>>): void {
    this.profileForm.patchValue({
      firstName: user.firstName || '',
      lastName: user.lastName || '',
      email: user.email || '',
      phoneNumber: user.phoneNumber || '',
      address: user.address || '',
      bankName: user.bankName || '',
      accountNumber: user.accountNumber || '',
      accountName: user.accountName || '',
    });
    this.cdr.markForCheck();
  }

  enterEditMode(): void {
    const user = this.currentUser();
    if (user) {
      this.populateForm(user);
    }
    this.isEditMode.set(true);
    this.cdr.markForCheck();
  }

  cancelEdit(): void {
    if (this.isDialogMode()) {
      this.dialogRef?.close(false);
      return;
    }
    const user = this.currentUser();
    if (user) {
      this.populateForm(user);
    }
    this.isEditMode.set(false);
    this.profileForm.markAsUntouched();
    this.cdr.markForCheck();
  }

  onSubmit(): void {
    if (this.profileForm.valid) {
      this.isSaving.set(true);
      const formValue = this.profileForm.getRawValue();

      const profilePayload = {
        firstName: formValue.firstName?.trim() || undefined,
        lastName: formValue.lastName?.trim() || undefined,
        phone: formValue.phoneNumber?.trim() || undefined,
        address: formValue.address?.trim() || undefined,
      };
      Object.keys(profilePayload).forEach(
        (k) =>
          (profilePayload as Record<string, unknown>)[k] === undefined &&
          delete (profilePayload as Record<string, unknown>)[k],
      );

      const bankName = formValue.bankName?.trim() || '';
      const accountNumber = formValue.accountNumber?.trim() || '';
      const accountName = formValue.accountName?.trim() || '';
      const accountType = (formValue.accountType === 'CURRENT' ? 'CURRENT' : 'SAVINGS') as
        'SAVINGS' | 'CURRENT';

      const hasBankInfo = !!(bankName || accountNumber || accountName);

      const profile$ = this.onboardingService.updateProfile(profilePayload);
      const bank$ = hasBankInfo
        ? this.onboardingService.updateBankDetails({
            bankName,
            accountNumber,
            accountName,
            accountType,
          })
        : of(null);

      forkJoin({ profile: profile$, bank: bank$ }).subscribe({
        next: () => {
          this.handleSaveSuccess();
        },
        error: (err) => {
          this.isSaving.set(false);
          const raw = err?.error?.message;
          const msg = Array.isArray(raw)
            ? raw.join(' ')
            : (raw ?? "We couldn't save your profile and bank details. Please try again.");
          this.modalService.open('error', 'Save Failed', msg);
          this.cdr.markForCheck();
        },
      });
    } else {
      this.profileForm.markAllAsTouched();
      this.cdr.markForCheck();
    }
  }

  private confirmMatchValidator(): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      const newP = control.get('newPassword')?.value;
      const confirm = control.get('confirmPassword')?.value;
      return newP === confirm ? null : { passwordMismatch: true };
    };
  }

  private confirmPinMatchValidator(field1: string, field2: string): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      const v1 = control.get(field1)?.value;
      const v2 = control.get(field2)?.value;
      return v1 === v2 ? null : { pinMismatch: true };
    };
  }

  changePassword(): void {
    if (this.passwordForm.invalid || this.passwordForm.pristine) return;
    this.isChangingPassword.set(true);
    const { currentPassword, newPassword } = this.passwordForm.getRawValue();
    this.userService.changePassword(currentPassword ?? '', newPassword ?? '').subscribe({
      next: () => {
        this.passwordForm.reset();
        this.isChangingPassword.set(false);
        this.cdr.markForCheck();
        this.modalService.open(
          'success',
          'Password Updated',
          'Your password has been updated successfully.',
        );
      },
      error: (err) => {
        this.isChangingPassword.set(false);
        this.cdr.markForCheck();
        const raw = err?.error?.message;
        const msg = Array.isArray(raw) ? raw.join(' ') : (raw ?? 'Please try again.');
        this.modalService.open('error', 'Password Update Failed', msg);
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

  showChangePin(): void {
    this.changePinForm.reset();
    this.pinFormState.set('CHANGE');
  }

  showResetPin(): void {
    this.resetPinForm.reset();
    this.pinFormState.set('RESET_REQUEST');
  }

  showSetupPin(): void {
    this.setupPinForm.reset();
    this.pinFormState.set('SETUP');
  }

  cancelPinAction(): void {
    this.pinFormState.set('IDLE');
  }

  submitSetupPin(): void {
    if (this.setupPinForm.invalid) return;
    this.isPinSaving.set(true);
    const { pin, confirmPin } = this.setupPinForm.getRawValue();
    this.userService.setTransactionPin(pin ?? '', confirmPin ?? '').subscribe({
      next: () => {
        this.isPinSaving.set(false);
        this.pinFormState.set('IDLE');
        this.cdr.markForCheck();
        this.modalService.open(
          'success',
          'PIN Set',
          'Your transaction PIN has been set successfully.',
        );
      },
      error: (err) => {
        this.isPinSaving.set(false);
        this.cdr.markForCheck();
        if (this.isImpersonationBlocked(err)) {
          this.modalService.open(
            'error',
            'Action Disabled',
            'Action disabled during impersonation.',
          );
          return;
        }
        const msg = err?.error?.message ?? 'Could not set transaction PIN. Please try again.';
        this.modalService.open('error', 'PIN Setup Failed', msg);
      },
    });
  }

  submitChangePin(): void {
    if (this.changePinForm.invalid) return;
    this.isPinSaving.set(true);
    const { oldPin, newPin, confirmNewPin } = this.changePinForm.getRawValue();
    this.userService
      .changeTransactionPin(oldPin ?? '', newPin ?? '', confirmNewPin ?? '')
      .subscribe({
        next: () => {
          this.isPinSaving.set(false);
          this.pinFormState.set('IDLE');
          this.cdr.markForCheck();
          this.modalService.open(
            'success',
            'PIN Changed',
            'Your transaction PIN has been updated successfully.',
          );
        },
        error: (err) => {
          this.isPinSaving.set(false);
          this.cdr.markForCheck();
          if (this.isImpersonationBlocked(err)) {
            this.modalService.open(
              'error',
              'Action Disabled',
              'Action disabled during impersonation.',
            );
            return;
          }
          const msg =
            err?.error?.message ??
            'Could not change PIN. Please check your current PIN and try again.';
          this.modalService.open('error', 'PIN Change Failed', msg);
        },
      });
  }

  requestPinResetOtp(): void {
    this.isPinSaving.set(true);
    this.userService.requestTransactionPinReset().subscribe({
      next: () => {
        this.isPinSaving.set(false);
        this.resetPinForm.reset();
        this.pinFormState.set('RESET');
        this.cdr.markForCheck();
        this.modalService.open(
          'success',
          'OTP Sent',
          'A reset code has been sent to your registered email.',
        );
      },
      error: (err) => {
        this.isPinSaving.set(false);
        this.cdr.markForCheck();
        if (this.isImpersonationBlocked(err)) {
          this.modalService.open(
            'error',
            'Action Disabled',
            'Action disabled during impersonation.',
          );
          return;
        }
        const raw = err?.error?.message;
        const msg = Array.isArray(raw)
          ? raw.join(' ')
          : (raw ?? 'Could not send reset OTP. Please try again.');
        this.modalService.open('error', 'Request Failed', msg);
      },
    });
  }

  submitResetPin(): void {
    if (this.resetPinForm.invalid) return;
    this.isPinSaving.set(true);
    const { otp, newPin, confirmNewPin } = this.resetPinForm.getRawValue();
    this.userService.resetTransactionPin(otp ?? '', newPin ?? '', confirmNewPin ?? '').subscribe({
      next: () => {
        this.isPinSaving.set(false);
        this.pinFormState.set('IDLE');
        this.cdr.markForCheck();
        this.modalService.open(
          'success',
          'PIN Reset',
          'Your transaction PIN has been reset successfully.',
        );
      },
      error: (err) => {
        this.isPinSaving.set(false);
        this.cdr.markForCheck();
        if (this.isImpersonationBlocked(err)) {
          this.modalService.open(
            'error',
            'Action Disabled',
            'Action disabled during impersonation.',
          );
          return;
        }
        const msg =
          err?.error?.message ?? 'Could not reset PIN. Please check your OTP and try again.';
        this.modalService.open('error', 'PIN Reset Failed', msg);
      },
    });
  }

  private handleSaveSuccess(): void {
    this.userService.fetchProfile().subscribe();
    this.isSaving.set(false);
    this.isEditMode.set(false);
    this.cdr.markForCheck();
    this.modalService.open(
      'success',
      'Profile Updated',
      'Your profile has been updated successfully.',
    );

    if (this.isDialogMode() && this.closeOnSave) {
      this.dialogRef?.close(true);
    }
  }
}
