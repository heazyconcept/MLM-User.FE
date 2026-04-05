import { Component, inject, ChangeDetectionStrategy, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { RouterModule, Router } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { CheckboxModule } from 'primeng/checkbox';
import { RippleModule } from 'primeng/ripple';
import { AuthService } from '../../services/auth.service';
import { MessageModule } from 'primeng/message';
import { LoadingService } from '../../services/loading.service';
import { UserService } from '../../services/user.service';
import { ModalService } from '../../services/modal.service';
import { AuthInputComponent } from '../components/auth-input/auth-input.component';

@Component({
  selector: 'app-login',
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterModule,
    ButtonModule,
    CheckboxModule,
    RippleModule,
    MessageModule,
    AuthInputComponent
  ],
  templateUrl: './login.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class LoginComponent {
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private router = inject(Router);
  private userService = inject(UserService);
  private modalService = inject(ModalService);
  private loadingService = inject(LoadingService);
  
  isLoading = signal<boolean>(false);

  loginForm = this.fb.group({
    username: ['', [Validators.required, Validators.minLength(3)]],
    password: ['', [Validators.required]],
    rememberMe: [false]
  });

  onSubmit() {
    if (this.loginForm.valid) {
      const { username, password } = this.loginForm.value;
      if (username && password) {
        this.isLoading.set(true);
        this.loadingService.show();
        this.authService.login(username, password).subscribe({
          next: (result) => {
            this.isLoading.set(false);
            this.loadingService.hide();
            
            // Registration Fee Status Check (On Every Login)
            // The payment status has been fetched from the server in AuthService.login()
            // This ensures we always have the latest status, even if it changed externally
            // (e.g., admin override, payment retry, failed payment)
            const paymentStatus = result.paymentStatus;
            const redirectPath = paymentStatus === 'PAID' ? '/dashboard' : '/auth/activation';
            
            // Show success modal with automatic redirect
            this.modalService.open(
              'success',
              'Login Successful',
              'Welcome back! You have been successfully logged in.',
              redirectPath
            );
            
            // PAID → dashboard; UNPAID → activation choice (dashboard remains available from there)
            setTimeout(() => {
              this.router.navigate([redirectPath]);
            }, 2000);
          },
          error: () => {
            this.isLoading.set(false);
            this.loadingService.hide();
            // Show error modal
            this.modalService.open(
              'error',
              'Login Failed',
              'Invalid username or password. Please try again.'
            );
          }
        });
      }
    } else {
      this.loginForm.markAllAsTouched();
    }
  }
}
