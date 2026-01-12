import { Component, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { RouterModule, Router } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { AuthInputComponent } from '../components/auth-input/auth-input.component';
import { LoadingService } from '../../services/loading.service';

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
  private router = inject(Router);

  isLoading = signal<boolean>(false);

  forgotPasswordForm = this.fb.group({
    email: ['', [Validators.required, Validators.email]]
  });

  onSubmit() {
    if (this.forgotPasswordForm.valid) {
      this.isLoading.set(true);
      // Simulated 1.5s delay as per spec
      setTimeout(() => {
        this.isLoading.set(false);
        this.router.navigate(['/auth/reset-password']);
      }, 1500);
    } else {
      this.forgotPasswordForm.markAllAsTouched();
    }
  }
}

