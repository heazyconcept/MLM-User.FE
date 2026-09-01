import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, ChangeDetectionStrategy, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators, FormsModule } from '@angular/forms';
import { RouterModule, Router } from '@angular/router';
import { CheckboxModule } from 'primeng/checkbox';
import { AuthService } from '../../services/auth.service';
import { UserService } from '../../services/user.service';
import { ModalService } from '../../services/modal.service';
import { LoadingService } from '../../services/loading.service';
import { resolveLoginErrorMessage } from '../../core/utils/login-error.util';
import {
  PROFILE_SETUP_ACTION_LABEL,
  PROFILE_SETUP_LOGIN_MESSAGE,
  PROFILE_SETUP_TITLE,
  resolvePostLoginRedirect,
} from '../../core/utils/profile-complete.util';
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
  changeDetection: ChangeDetectionStrategy.OnPush,
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
    rememberMe: [false],
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
            const dest = resolvePostLoginRedirect(
              result.paymentStatus,
              this.userService.currentUser()?.isProfileComplete,
            );

            if (dest.promptProfile) {
              this.modalService.open(
                'warning',
                PROFILE_SETUP_TITLE,
                PROFILE_SETUP_LOGIN_MESSAGE,
                dest.path,
                PROFILE_SETUP_ACTION_LABEL,
              );
              void this.router.navigate([dest.path], { queryParams: dest.queryParams });
              return;
            }

            this.modalService.open(
              'success',
              'Login Successful',
              'Welcome back! You have been successfully logged in.',
              dest.path,
            );

            setTimeout(() => {
              this.modalService.close();
              void this.router.navigate([dest.path], { queryParams: dest.queryParams });
            }, 2000);
          },
          error: (err: HttpErrorResponse) => {
            this.isLoading.set(false);
            this.loadingService.hide();
            if (typeof ngDevMode !== 'undefined' && ngDevMode) {
              console.error('Login failed', err);
            }
            this.modalService.open(
              'error',
              'Login Failed',
              resolveLoginErrorMessage(err),
            );
          },
        });
      }
    } else {
      this.loginForm.markAllAsTouched();
    }
  }
}
