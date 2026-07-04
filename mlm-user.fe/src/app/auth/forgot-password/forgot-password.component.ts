import {
  Component,
  inject,
  signal,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  DestroyRef,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { InputTextModule } from 'primeng/inputtext';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-forgot-password',
  imports: [CommonModule, ReactiveFormsModule, RouterModule, InputTextModule],
  templateUrl: './forgot-password.component.html',
  styleUrl: './forgot-password.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ForgotPasswordComponent {
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private cdr = inject(ChangeDetectorRef);
  private destroyRef = inject(DestroyRef);

  isLoading = signal<boolean>(false);
  submitted = signal<boolean>(false);
  rateLimitError = signal<string | null>(null);

  forgotPasswordForm = this.fb.group({
    username: ['', Validators.required],
    email: ['', [Validators.required, Validators.email]],
  });

  constructor() {
    this.clearApiErrorOnChange('username');
    this.clearApiErrorOnChange('email');
  }

  onSubmit() {
    if (this.forgotPasswordForm.valid) {
      const { username, email } = this.forgotPasswordForm.value;
      this.isLoading.set(true);
      this.rateLimitError.set(null);

      this.authService.forgotPassword(username!, email!).subscribe({
        next: () => {
          this.isLoading.set(false);
          this.submitted.set(true);
        },
        error: (err) => {
          this.isLoading.set(false);

          if (err?.status === 429) {
            this.rateLimitError.set('Too many requests. Please try again later.');
            this.cdr.markForCheck();
            return;
          }

          if (err?.status === 400) {
            this.applyValidationErrors(err?.error?.message);
            this.cdr.markForCheck();
            return;
          }

          if (typeof ngDevMode !== 'undefined' && ngDevMode) {
            console.error('Forgot password failed', err);
          }
          this.submitted.set(true);
        },
      });
    } else {
      this.forgotPasswordForm.markAllAsTouched();
      this.cdr.markForCheck();
    }
  }

  getFieldError(field: 'username' | 'email'): string | null {
    const control = this.forgotPasswordForm.get(field);
    if (!control?.invalid || !control.touched) {
      return null;
    }

    const apiError = control.getError('api');
    if (typeof apiError === 'string') {
      return apiError;
    }

    if (field === 'username' && control.hasError('required')) {
      return 'Please enter your username';
    }

    if (field === 'email') {
      if (control.hasError('required')) {
        return 'Email is required';
      }
      if (control.hasError('email')) {
        return 'Please enter a valid email';
      }
    }

    return null;
  }

  private clearApiErrorOnChange(field: 'username' | 'email') {
    this.forgotPasswordForm
      .get(field)
      ?.valueChanges.pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        const control = this.forgotPasswordForm.get(field);
        if (!control?.hasError('api')) {
          return;
        }

        const { api: _api, ...remainingErrors } = control.errors ?? {};
        control.setErrors(Object.keys(remainingErrors).length ? remainingErrors : null);
        this.cdr.markForCheck();
      });
  }

  private applyValidationErrors(message: string | string[] | undefined) {
    const messages = Array.isArray(message) ? message : message ? [message] : [];

    for (const msg of messages) {
      const lower = msg.toLowerCase();
      if (lower.includes('username')) {
        this.setApiError('username', msg);
      } else if (lower.includes('email')) {
        this.setApiError('email', msg);
      }
    }

    if (messages.length > 0) {
      this.forgotPasswordForm.markAllAsTouched();
    }
  }

  private setApiError(field: 'username' | 'email', message: string) {
    const control = this.forgotPasswordForm.get(field);
    control?.setErrors({ ...(control.errors ?? {}), api: message });
    control?.markAsTouched();
  }
}
