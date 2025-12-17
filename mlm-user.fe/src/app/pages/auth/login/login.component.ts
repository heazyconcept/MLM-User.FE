import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { RouterModule, Router } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { CheckboxModule } from 'primeng/checkbox';
import { InputTextModule } from 'primeng/inputtext';
import { PasswordModule } from 'primeng/password';
import { RippleModule } from 'primeng/ripple';
import { AuthService } from '../../../services/auth.service';
import { MessageModule } from 'primeng/message';
import { LoadingService } from '../../../services/loading.service';
import { UserService } from '../../../services/user.service';
import { ModalService } from '../../../services/modal.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterModule,
    ButtonModule,
    CheckboxModule,
    InputTextModule,
    PasswordModule,
    RippleModule,
    MessageModule
  ],
  templateUrl: './login.component.html'
})
export class LoginComponent {
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private router = inject(Router);
  private userService = inject(UserService);
  private modalService = inject(ModalService);
  loadingService = inject(LoadingService); // Public for template access

  loginForm = this.fb.group({
    email: ['pelumi123@gmail.com', [Validators.required, Validators.email]],
    password: ['Password123#', [Validators.required]],
    rememberMe: [false]
  });

  onSubmit() {
    if (this.loginForm.valid) {
      const { email, password } = this.loginForm.value;
      if (email && password) {
        this.loadingService.show();
        this.authService.login(email, password).subscribe({
          next: (result) => {
            this.loadingService.hide();
            
            // Registration Fee Status Check (On Every Login)
            // The payment status has been fetched from the server in AuthService.login()
            // This ensures we always have the latest status, even if it changed externally
            // (e.g., admin override, payment retry, failed payment)
            const paymentStatus = result.paymentStatus;
            
            // Apply Access Rules:
            // - RegistrationFeeStatus = UNPAID → Redirect to Restricted Dashboard
            // - RegistrationFeeStatus = PAID → Redirect to Full Dashboard
            // The dashboard component will automatically show the appropriate view based on payment status
            const redirectPath = '/dashboard';
            
            // Show success modal with automatic redirect
            this.modalService.open(
              'success',
              'Login Successful',
              'Welcome back! You have been successfully logged in.',
              redirectPath
            );
            
            // Automatically redirect after a short delay to show the modal
            // The dashboard component will automatically show restricted or full view based on payment status
            setTimeout(() => {
              this.router.navigate([redirectPath]);
            }, 2000);
          },
          error: () => {
            this.loadingService.hide();
            // Show error modal
            this.modalService.open(
              'error',
              'Login Failed',
              'Invalid email or password. Please try again.'
            );
          }
        });
      }
    } else {
      this.loginForm.markAllAsTouched();
    }
  }
}
