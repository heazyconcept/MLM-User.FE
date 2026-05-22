import { Component, inject, signal, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators, AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';
import { UserService } from '../../../services/user.service';
import { ModalService } from '../../../services/modal.service';

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

  passwordForm = this.fb.group(
    {
      currentPassword: ['', [Validators.required]],
      newPassword: ['', [Validators.required, Validators.minLength(6)]],
      confirmPassword: ['', [Validators.required]]
    },
    { validators: this.confirmMatchValidator() }
  );

  private confirmMatchValidator(): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      const newP = control.get('newPassword')?.value;
      const confirm = control.get('confirmPassword')?.value;
      return newP === confirm ? null : { passwordMismatch: true };
    };
  }

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
      error: () => {
        this.isSaving.set(false);
        this.cdr.markForCheck();
        this.modalService.open('error', 'Could not update password', 'Please try again.');
      }
    });
  }
}
