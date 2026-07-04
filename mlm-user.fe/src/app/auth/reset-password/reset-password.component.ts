import {
  Component,
  inject,
  ChangeDetectionStrategy,
  signal,
  OnInit,
  ChangeDetectorRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  ReactiveFormsModule,
  FormBuilder,
  Validators,
  AbstractControl,
  ValidationErrors,
} from '@angular/forms';
import { RouterModule, ActivatedRoute } from '@angular/router';
import { PasswordModule } from 'primeng/password';
import { AuthService } from '../../services/auth.service';

type ResetPageState = 'form' | 'success' | 'invalidLink';

@Component({
  selector: 'app-reset-password',
  imports: [CommonModule, ReactiveFormsModule, RouterModule, PasswordModule],
  templateUrl: './reset-password.component.html',
  styleUrl: './reset-password.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ResetPasswordComponent implements OnInit {
  private fb = inject(FormBuilder);
  private route = inject(ActivatedRoute);
  private authService = inject(AuthService);
  private cdr = inject(ChangeDetectorRef);

  isLoading = signal<boolean>(false);
  pageState = signal<ResetPageState>('form');
  apiError = signal<string | null>(null);
  rateLimitError = signal<string | null>(null);

  private resetToken = '';

  resetPasswordForm = this.fb.group(
    {
      password: ['', [Validators.required, Validators.minLength(8)]],
      confirmPassword: ['', [Validators.required]],
    },
    { validators: this.passwordMatchValidator },
  );

  ngOnInit() {
    const rawToken = this.route.snapshot.queryParamMap.get('token');
    this.resetToken = rawToken ? decodeURIComponent(rawToken) : '';

    if (!this.resetToken) {
      this.pageState.set('invalidLink');
    }
  }

  passwordMatchValidator(control: AbstractControl): ValidationErrors | null {
    const password = control.get('password')?.value;
    const confirmPassword = control.get('confirmPassword')?.value;
    return password === confirmPassword ? null : { passwordMismatch: true };
  }

  onSubmit() {
    if (this.resetPasswordForm.valid) {
      if (!this.resetToken) {
        this.pageState.set('invalidLink');
        return;
      }

      this.isLoading.set(true);
      this.apiError.set(null);
      this.rateLimitError.set(null);

      const newPassword = this.resetPasswordForm.value.password!;

      this.authService.resetPassword(this.resetToken, newPassword).subscribe({
        next: () => {
          this.isLoading.set(false);
          this.clearTokenFromUrl();
          this.pageState.set('success');
        },
        error: (err) => {
          this.isLoading.set(false);

          if (err?.status === 429) {
            this.rateLimitError.set('Too many requests. Please try again later.');
            this.cdr.markForCheck();
            return;
          }

          const raw = err?.error?.message;
          const msg = Array.isArray(raw)
            ? raw.join(' ')
            : (raw ?? 'Invalid or expired reset token. Please request a new link.');

          if (err?.status === 400) {
            this.apiError.set(msg);
            this.cdr.markForCheck();
            return;
          }

          if (typeof ngDevMode !== 'undefined' && ngDevMode) {
            console.error('Reset password failed', err);
          }
          this.apiError.set('Unable to reset your password. Please try again or request a new link.');
          this.cdr.markForCheck();
        },
      });
    } else {
      this.resetPasswordForm.markAllAsTouched();
      this.cdr.markForCheck();
    }
  }

  getPasswordError(): string | null {
    const control = this.resetPasswordForm.get('password');
    if (!control?.invalid || !control.touched) {
      return null;
    }

    if (control.hasError('required')) {
      return 'Password is required';
    }
    if (control.hasError('minlength')) {
      return 'Password must be at least 8 characters';
    }

    return null;
  }

  getConfirmPasswordError(): string | null {
    const control = this.resetPasswordForm.get('confirmPassword');
    if (!control?.touched) {
      return null;
    }

    if (control.hasError('required')) {
      return 'Please confirm your password';
    }

    if (
      this.resetPasswordForm.hasError('passwordMismatch') &&
      control.value &&
      this.resetPasswordForm.get('password')?.value
    ) {
      return 'Passwords do not match';
    }

    return null;
  }

  private clearTokenFromUrl() {
    if (typeof window === 'undefined') {
      return;
    }

    const url = new URL(window.location.href);
    url.searchParams.delete('token');
    window.history.replaceState({}, '', url.pathname + url.search + url.hash);
    this.resetToken = '';
  }
}
