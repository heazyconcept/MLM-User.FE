import { Component, inject, ChangeDetectionStrategy, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators, FormsModule } from '@angular/forms';
import { RouterModule, Router } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { CheckboxModule } from 'primeng/checkbox';
import { RippleModule } from 'primeng/ripple';
import { AuthService } from '../../services/auth.service';
import { MessageModule } from 'primeng/message';
import { ModalService } from '../../services/modal.service';
import { FloatLabelModule } from 'primeng/floatlabel';
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
    ButtonModule,
    CheckboxModule,
    RippleModule,
    MessageModule,
    FloatLabelModule,
    InputTextModule,
    PasswordModule,
    // AuthInputComponent
  ],
  templateUrl: './login-modern.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class LoginModernComponent {
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private router = inject(Router);
  private modalService = inject(ModalService);
  
  isLoading = signal<boolean>(false);

  loginForm = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required]],
    rememberMe: [false]
  });

  onSubmit() {
    if (this.loginForm.valid) {
      const { email, password } = this.loginForm.value;
      if (email && password) {
        this.isLoading.set(true);
        this.authService.login(email, password).subscribe({
          next: (result) => {
            this.isLoading.set(false);
            const redirectPath = '/dashboard';
            
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
          error: () => {
            this.isLoading.set(false);
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
