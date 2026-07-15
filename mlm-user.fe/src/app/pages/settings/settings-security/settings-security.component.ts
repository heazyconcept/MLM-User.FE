import {
  Component,
  inject,
  signal,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
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
import { RouterModule } from '@angular/router';
import { UserService } from '../../../services/user.service';
import { ModalService } from '../../../services/modal.service';

@Component({
  selector: 'app-settings-security',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './settings-security.component.html',
  styleUrl: './settings-security.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
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
      confirmPassword: ['', [Validators.required]],
    },
    {
      validators: this.confirmMatchValidator('newPassword', 'confirmPassword', 'passwordMismatch'),
    },
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
        this.modalService.open(
          'success',
          'Password Updated',
          'Your password has been updated successfully.',
        );
      },
      error: (err) => {
        this.isSaving.set(false);
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
        const msg = Array.isArray(raw) ? raw.join(' ') : (raw ?? 'Please try again.');
        this.modalService.open('error', 'Password Update Failed', msg);
      },
    });
  }
}
