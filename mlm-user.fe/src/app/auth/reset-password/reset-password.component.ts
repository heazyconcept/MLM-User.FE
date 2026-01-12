import { Component, inject, ChangeDetectionStrategy, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators, AbstractControl, ValidationErrors } from '@angular/forms';
import { RouterModule, Router } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { AuthInputComponent } from '../components/auth-input/auth-input.component';
import { LoadingService } from '../../services/loading.service';
import { ModalService } from '../../services/modal.service';

@Component({
  selector: 'app-reset-password',
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterModule,
    ButtonModule,
    AuthInputComponent
  ],
  templateUrl: './reset-password.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ResetPasswordComponent {
  private fb = inject(FormBuilder);
  private router = inject(Router);
  private modalService = inject(ModalService);
  
  isLoading = signal<boolean>(false);

  resetPasswordForm = this.fb.group({
    password: ['', [Validators.required, Validators.minLength(6)]],
    confirmPassword: ['', [Validators.required]]
  }, { validators: this.passwordMatchValidator });

  passwordMatchValidator(control: AbstractControl): ValidationErrors | null {
    const password = control.get('password')?.value;
    const confirmPassword = control.get('confirmPassword')?.value;
    return password === confirmPassword ? null : { passwordMismatch: true };
  }

  onSubmit() {
    if (this.resetPasswordForm.valid) {
      this.isLoading.set(true);
      // Simulated 2s delay as per spec
      setTimeout(() => {
        this.isLoading.set(false);
        this.modalService.open(
          'success',
          'Password Reset',
          'Your password has been successfully reset. You can now log in with your new password.',
          '/auth/login'
        );
        setTimeout(() => {
          this.router.navigate(['/auth/login']);
        }, 2000);
      }, 2000);
    } else {
      this.resetPasswordForm.markAllAsTouched();
    }
  }
}

