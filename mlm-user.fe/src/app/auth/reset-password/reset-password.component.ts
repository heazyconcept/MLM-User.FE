import { Component, inject, ChangeDetectionStrategy, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators, AbstractControl, ValidationErrors } from '@angular/forms';
import { RouterModule, Router, ActivatedRoute } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { AuthInputComponent } from '../components/auth-input/auth-input.component';
import { AuthService } from '../../services/auth.service';
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
export class ResetPasswordComponent implements OnInit {
  private fb = inject(FormBuilder);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private authService = inject(AuthService);
  private modalService = inject(ModalService);

  isLoading = signal<boolean>(false);
  private resetToken = '';

  resetPasswordForm = this.fb.group({
    password: ['', [Validators.required, Validators.minLength(8)]],
    confirmPassword: ['', [Validators.required]]
  }, { validators: this.passwordMatchValidator });

  ngOnInit() {
    this.route.queryParams.subscribe(params => {
      this.resetToken = params['token'] ?? '';
    });
  }

  passwordMatchValidator(control: AbstractControl): ValidationErrors | null {
    const password = control.get('password')?.value;
    const confirmPassword = control.get('confirmPassword')?.value;
    return password === confirmPassword ? null : { passwordMismatch: true };
  }

  onSubmit() {
    if (this.resetPasswordForm.valid) {
      if (!this.resetToken) {
        this.modalService.open('error', 'Invalid Link', 'The reset link is invalid or has expired. Please request a new one.');
        return;
      }

      this.isLoading.set(true);
      const newPassword = this.resetPasswordForm.value.password!;

      this.authService.resetPassword(this.resetToken, newPassword).subscribe({
        next: () => {
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
        },
        error: (err) => {
          this.isLoading.set(false);
          if (typeof ngDevMode !== 'undefined' && ngDevMode) {
            console.error('Reset password failed', err);
          }
          this.modalService.open('error', 'Reset Failed', 'Failed to reset password. The link may have expired.');
        }
      });
    } else {
      this.resetPasswordForm.markAllAsTouched();
    }
  }
}

