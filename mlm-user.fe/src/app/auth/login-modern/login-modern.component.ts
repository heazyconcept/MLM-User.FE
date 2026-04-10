import { Component, inject, ChangeDetectionStrategy, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators, FormsModule } from '@angular/forms';
import { RouterModule, Router } from '@angular/router';
import { CheckboxModule } from 'primeng/checkbox';
import { AuthService } from '../../services/auth.service';
import { UserService } from '../../services/user.service';
import { ModalService } from '../../services/modal.service';
import { LoadingService } from '../../services/loading.service';
import { InputTextModule } from 'primeng/inputtext';
import { PasswordModule } from 'primeng/password';
// import { AuthInputComponent } from '../components/auth-input/auth-input.component';

@Component({
  selector: 'app-login-modern',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    FormsModule,
    RouterModule,
    CheckboxModule,
    InputTextModule,
    PasswordModule,
    // AuthInputComponent
  ],
  templateUrl: './login-modern.component.html',
  styleUrl: './login-modern.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class LoginModernComponent {
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private userService = inject(UserService);
  private router = inject(Router);
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
            const redirectPath =
              result.paymentStatus === 'PAID' ? '/dashboard' : '/auth/activation';
            
            this.modalService.open(
              'success',
              'Login Successful',
              'Welcome back! You have been successfully logged in.',
              redirectPath
            );
            
            setTimeout(() => {
              this.router.navigate([redirectPath]);
            }, 2000);
          },
          error: (err) => {
            this.isLoading.set(false);
            this.loadingService.hide();
            if (typeof ngDevMode !== 'undefined' && ngDevMode) {
              console.error('Login failed', err);
            }
            this.modalService.open('error', 'Login Failed', 'Invalid username or password. Please try again.');
          }
        });
      }
    } else {
      this.loginForm.markAllAsTouched();
    }
  }
}
