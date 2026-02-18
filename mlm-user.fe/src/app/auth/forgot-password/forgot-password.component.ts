import { Component, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { AuthInputComponent } from '../components/auth-input/auth-input.component';
import { AuthService } from '../../services/auth.service';
import { ModalService } from '../../services/modal.service';

@Component({
  selector: 'app-forgot-password',
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterModule,
    ButtonModule,
    AuthInputComponent
  ],
  templateUrl: './forgot-password.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ForgotPasswordComponent {
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private modalService = inject(ModalService);

  isLoading = signal<boolean>(false);

  forgotPasswordForm = this.fb.group({
    email: ['', [Validators.required, Validators.email]]
  });

  onSubmit() {
    if (this.forgotPasswordForm.valid) {
      const email = this.forgotPasswordForm.value.email!;
      this.isLoading.set(true);

      this.authService.forgotPassword(email).subscribe({
        next: () => {
          this.isLoading.set(false);
          this.modalService.open(
            'success',
            'Email Sent',
            'If an account exists with that email, you will receive a password reset link shortly.',
            '/auth/login'
          );
        },
        error: () => {
          this.isLoading.set(false);
          this.modalService.open(
            'success',
            'Email Sent',
            'If an account exists with that email, you will receive a password reset link shortly.',
            '/auth/login'
          );
        }
      });
    } else {
      this.forgotPasswordForm.markAllAsTouched();
    }
  }
}
