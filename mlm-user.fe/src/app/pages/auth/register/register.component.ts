import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators, AbstractControl, ValidationErrors } from '@angular/forms';
import { RouterModule, Router } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { CheckboxModule } from 'primeng/checkbox';
import { InputTextModule } from 'primeng/inputtext';
import { PasswordModule } from 'primeng/password';
import { RippleModule } from 'primeng/ripple';
import { AuthService } from '../../../services/auth.service';
import { MessageModule } from 'primeng/message';
import { LoadingService } from '../../../services/loading.service';
import { ModalService } from '../../../services/modal.service';

@Component({
  selector: 'app-register',
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
  templateUrl: './register.component.html'
})
export class RegisterComponent {
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private router = inject(Router);
  loadingService = inject(LoadingService);
  private modalService = inject(ModalService);

  registerForm = this.fb.group({
    firstName: ['', [Validators.required]],
    lastName: ['', [Validators.required]],
    email: ['', [Validators.required, Validators.email]],
    phoneNumber: ['', [Validators.required]],
    password: ['', [Validators.required, Validators.minLength(8)]],
    confirmPassword: ['', [Validators.required]],
    referralCode: [''],
    acceptTerms: [false, [Validators.requiredTrue]]
  }, { validators: this.passwordMatchValidator });

  passwordMatchValidator(control: AbstractControl): ValidationErrors | null {
    const password = control.get('password');
    const confirmPassword = control.get('confirmPassword');

    if (password && confirmPassword && password.value !== confirmPassword.value) {
      confirmPassword.setErrors({ passwordMismatch: true });
      return { passwordMismatch: true };
    } else {
        if (confirmPassword?.hasError('passwordMismatch')) {
            delete confirmPassword.errors?.['passwordMismatch'];
            if (!Object.keys(confirmPassword.errors || {}).length) {
                confirmPassword.setErrors(null);
            }
        }
    }
    return null;
  }

  onSubmit() {
    if (this.registerForm.valid) {
      this.loadingService.show();
      // Status 'UNPAID' is handled by the backend/service
      this.authService.register({ ...this.registerForm.value, status: 'UNPAID' }).subscribe({
        next: () => {
          this.loadingService.hide();
          this.modalService.open(
            'success', 
            'Account Created', 
            'Your account has been created successfully.', 
            '/login'
          );
        },
        error: () => {
          this.loadingService.hide();
        }
      });
    } else {
        this.registerForm.markAllAsTouched();
    }
  }
}
