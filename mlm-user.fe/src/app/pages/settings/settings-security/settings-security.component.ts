import { Component, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators, AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

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

  savedMessage = signal<string | null>(null);

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
    this.passwordForm.reset();
    this.savedMessage.set('Password updated successfully.');
    setTimeout(() => this.savedMessage.set(null), 3000);
  }
}
