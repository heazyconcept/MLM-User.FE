import { Component, inject, signal, computed, ChangeDetectionStrategy } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators, AbstractControl, ValidationErrors } from '@angular/forms';
import { RouterModule, Router } from '@angular/router';
import { CheckboxModule } from 'primeng/checkbox';
import { SelectModule } from 'primeng/select';
import { AuthService, type RegisterRequest } from '../../services/auth.service';
import { ModalService } from '../../services/modal.service';
import { InputTextModule } from 'primeng/inputtext';
import { PasswordModule } from 'primeng/password';

@Component({
  selector: 'app-register',
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterModule,
    CheckboxModule,
    SelectModule,
    InputTextModule,
    PasswordModule
  ],
  templateUrl: './register.component.html',
  styleUrl: './register.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class RegisterComponent {
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private router = inject(Router);
  private modalService = inject(ModalService);

  isLoading = signal<boolean>(false);
  currentStep = signal<number>(1);
  totalSteps = signal<number>(2);

  packages = [
    { label: 'Silver', value: 'SILVER' },
    { label: 'Gold', value: 'GOLD' },
    { label: 'Platinum', value: 'PLATINUM' },
    { label: 'Ruby', value: 'RUBY' },
    { label: 'Diamond', value: 'DIAMOND' }
  ];

  currencies = [
    { label: 'Nigerian Naira (NGN)', value: 'NGN' },
    { label: 'US Dollar (USD)', value: 'USD' }
  ];

  registerForm = this.fb.group({
    // Step 1: Account Credentials
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, this.passwordStrengthValidator]],
    confirmPassword: ['', [Validators.required]],

    // Step 2: Membership
    package: ['', [Validators.required]],
    currency: ['', [Validators.required]],
    referralCode: [''],
    acceptTerms: [false, [Validators.requiredTrue]]
  }, { validators: this.passwordMatchValidator });

  private passwordValue = toSignal(
    this.registerForm.get('password')!.valueChanges,
    { initialValue: this.registerForm.get('password')!.value ?? '' }
  );

  passwordChecklist = computed(() => {
    const password = this.passwordValue() ?? '';

    const hasMinLength = password.length >= 8;
    const hasLetter = /[A-Za-z]/.test(password);
    const hasNumber = /\d/.test(password);
    const hasSymbol = /[^A-Za-z0-9]/.test(password);

    return [
      { key: 'length', label: 'At least 8 characters', met: hasMinLength },
      { key: 'letter', label: 'At least one letter (A\u2013Z)', met: hasLetter },
      { key: 'number', label: 'At least one number (0\u20139)', met: hasNumber },
      { key: 'symbol', label: 'At least one symbol (! @ # $ % & *)', met: hasSymbol }
    ];
  });

  passwordStrengthValidator(control: AbstractControl): ValidationErrors | null {
    const value = control.value ?? '';
    if (value.length < 8) return { passwordStrength: 'length' };
    if (!/[A-Za-z]/.test(value)) return { passwordStrength: 'letter' };
    if (!/\d/.test(value)) return { passwordStrength: 'number' };
    if (!/[^A-Za-z0-9]/.test(value)) return { passwordStrength: 'symbol' };
    return null;
  }

  getPasswordErrorMessage(): string | null {
    const control = this.registerForm.get('password');
    if (!control?.invalid || !control?.touched) return null;
    if (control.hasError('required')) return 'Password is required';
    const strength = control.getError('passwordStrength');
    if (strength === 'length') return 'At least 8 characters required';
    if (strength === 'letter') return 'Include at least one letter (A\u2013Z)';
    if (strength === 'number') return 'Include at least one number (0\u20139)';
    if (strength === 'symbol') return 'Include at least one symbol (e.g. ! @ # $ % & *)';
    return null;
  }

  passwordMatchValidator(control: AbstractControl): ValidationErrors | null {
    const password = control.get('password')?.value;
    const confirmPassword = control.get('confirmPassword')?.value;
    return password === confirmPassword ? null : { passwordMismatch: true };
  }

  isStepValid(step: number): boolean {
    if (step === 1) {
      return !!(this.registerForm.get('email')?.valid &&
                this.registerForm.get('password')?.valid &&
                this.registerForm.get('confirmPassword')?.valid &&
                !this.registerForm.hasError('passwordMismatch'));
    }
    if (step === 2) {
      return !!(this.registerForm.get('package')?.valid &&
                this.registerForm.get('currency')?.valid &&
                this.registerForm.get('acceptTerms')?.valid);
    }
    return false;
  }

  nextStep() {
    if (this.currentStep() < this.totalSteps() && this.isStepValid(this.currentStep())) {
      this.currentStep.update(s => s + 1);
    } else {
      this.markStepAsTouched(this.currentStep());
    }
  }

  prevStep() {
    if (this.currentStep() > 1) {
      this.currentStep.update(s => s - 1);
    }
  }

  markStepAsTouched(step: number) {
    if (step === 1) {
      this.registerForm.get('email')?.markAsTouched();
      this.registerForm.get('password')?.markAsTouched();
      this.registerForm.get('confirmPassword')?.markAsTouched();
    } else if (step === 2) {
      this.registerForm.get('package')?.markAsTouched();
      this.registerForm.get('currency')?.markAsTouched();
      this.registerForm.get('acceptTerms')?.markAsTouched();
    }
  }

  onSubmit() {
    if (this.registerForm.valid) {
      this.isLoading.set(true);

      const formValue = this.registerForm.value;
      const payload: RegisterRequest = {
        email: formValue.email!,
        password: formValue.password!,
        package: formValue.package!,
        currency: formValue.currency!,
        ...(formValue.referralCode ? { referralCode: formValue.referralCode } : {})
      };

      this.authService.register(payload).subscribe({
        next: () => {
          this.isLoading.set(false);
          this.modalService.open(
            'success',
            'Account Created',
            'Your account has been created successfully. Let\u2019s set up your profile.',
            '/onboarding/profile'
          );
          setTimeout(() => {
            this.router.navigate(['/onboarding/profile']);
          }, 2000);
        },
        error: (err) => {
          this.isLoading.set(false);
          const message = err?.error?.message;
          const errorMsg = Array.isArray(message) ? message.join('. ') : (message || 'Registration failed. Please try again.');
          this.modalService.open('error', 'Registration Failed', errorMsg);
        }
      });
    } else {
      this.registerForm.markAllAsTouched();
    }
  }
}
