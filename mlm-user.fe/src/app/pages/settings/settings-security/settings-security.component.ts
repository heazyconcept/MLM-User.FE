import { Component, inject, signal, computed, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators, AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';
import { UserService } from '../../../services/user.service';
import { ModalService } from '../../../services/modal.service';

type PinFormState = 'IDLE' | 'CHANGE' | 'RESET_REQUEST' | 'RESET';

@Component({
  selector: 'app-settings-security',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './settings-security.component.html',
  styleUrl: './settings-security.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SettingsSecurityComponent {
  private fb = inject(FormBuilder);
  private userService = inject(UserService);
  private cdr = inject(ChangeDetectorRef);
  private modalService = inject(ModalService);

  isSaving = signal(false);

  // ── Password ──
  passwordForm = this.fb.group(
    {
      currentPassword: ['', [Validators.required]],
      newPassword: ['', [Validators.required, Validators.minLength(6)]],
      confirmPassword: ['', [Validators.required]]
    },
    { validators: this.confirmMatchValidator('newPassword', 'confirmPassword', 'passwordMismatch') }
  );

  // ── Transaction PIN ──
  hasPin = computed(() => this.userService.currentUser()?.hasTransactionPin ?? false);
  pinFormState = signal<PinFormState>('IDLE');
  isPinSaving = signal(false);

  changePinForm = this.fb.group(
    {
      oldPin: ['', [Validators.required, Validators.pattern(/^\d{4}$/)]],
      newPin: ['', [Validators.required, Validators.pattern(/^\d{4}$/)]],
      confirmNewPin: ['', [Validators.required, Validators.pattern(/^\d{4}$/)]]
    },
    { validators: this.confirmMatchValidator('newPin', 'confirmNewPin', 'pinMismatch') }
  );

  resetPinForm = this.fb.group(
    {
      otp: ['', [Validators.required, Validators.minLength(4)]],
      newPin: ['', [Validators.required, Validators.pattern(/^\d{4}$/)]],
      confirmNewPin: ['', [Validators.required, Validators.pattern(/^\d{4}$/)]]
    },
    { validators: this.confirmMatchValidator('newPin', 'confirmNewPin', 'pinMismatch') }
  );

  // ── Shared validator factory ──
  private confirmMatchValidator(field1: string, field2: string, errorKey: string): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      const v1 = control.get(field1)?.value;
      const v2 = control.get(field2)?.value;
      return v1 === v2 ? null : { [errorKey]: true };
    };
  }

  private isImpersonationBlocked(err: unknown): boolean {
    const error = err as { status?: number; error?: { error?: string; code?: string } } | undefined;
    return (
      error?.status === 403 &&
      (error?.error?.error === 'IMPERSONATION_ACTION_BLOCKED' ||
        error?.error?.code === 'IMPERSONATION_ACTION_BLOCKED')
    );
  }

  // ── Password actions ──
  save(): void {
    if (this.passwordForm.invalid || this.passwordForm.pristine) return;
    this.isSaving.set(true);
    const { currentPassword, newPassword } = this.passwordForm.getRawValue();
    this.userService.changePassword(currentPassword ?? '', newPassword ?? '').subscribe({
      next: () => {
        this.passwordForm.reset();
        this.isSaving.set(false);
        this.cdr.markForCheck();
        this.modalService.open('success', 'Password Updated', 'Your password has been updated successfully.');
      },
      error: (err) => {
        this.isSaving.set(false);
        this.cdr.markForCheck();
        if (this.isImpersonationBlocked(err)) {
          this.modalService.open('error', 'Action Disabled', 'Action disabled during impersonation.');
          return;
        }
        this.modalService.open('error', 'Could not update password', 'Please try again.');
      }
    });
  }

  // ── PIN actions ──
  showChangePin(): void {
    this.changePinForm.reset();
    this.pinFormState.set('CHANGE');
  }

  showResetPin(): void {
    this.resetPinForm.reset();
    this.pinFormState.set('RESET_REQUEST');
  }

  cancelPinAction(): void {
    this.pinFormState.set('IDLE');
  }

  submitChangePin(): void {
    if (this.changePinForm.invalid) return;
    this.isPinSaving.set(true);
    const { oldPin, newPin, confirmNewPin } = this.changePinForm.getRawValue();
    this.userService.changeTransactionPin(oldPin ?? '', newPin ?? '', confirmNewPin ?? '').subscribe({
      next: () => {
        this.isPinSaving.set(false);
        this.pinFormState.set('IDLE');
        this.cdr.markForCheck();
        this.modalService.open('success', 'PIN Changed', 'Your transaction PIN has been updated successfully.');
      },
      error: (err) => {
        this.isPinSaving.set(false);
        this.cdr.markForCheck();
        if (this.isImpersonationBlocked(err)) {
          this.modalService.open('error', 'Action Disabled', 'Action disabled during impersonation.');
          return;
        }
        const msg = err?.error?.message ?? 'Could not change PIN. Please check your current PIN and try again.';
        this.modalService.open('error', 'PIN Change Failed', msg);
      }
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
        this.modalService.open('success', 'OTP Sent', 'A reset code has been sent to your registered email.');
      },
      error: (err) => {
        this.isPinSaving.set(false);
        this.cdr.markForCheck();
        if (this.isImpersonationBlocked(err)) {
          this.modalService.open('error', 'Action Disabled', 'Action disabled during impersonation.');
          return;
        }
        this.modalService.open('error', 'Request Failed', 'Could not send reset OTP. Please try again.');
      }
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
        this.modalService.open('success', 'PIN Reset', 'Your transaction PIN has been reset successfully.');
      },
      error: (err) => {
        this.isPinSaving.set(false);
        this.cdr.markForCheck();
        if (this.isImpersonationBlocked(err)) {
          this.modalService.open('error', 'Action Disabled', 'Action disabled during impersonation.');
          return;
        }
        const msg = err?.error?.message ?? 'Could not reset PIN. Please check your OTP and try again.';
        this.modalService.open('error', 'PIN Reset Failed', msg);
      }
    });
  }
}
