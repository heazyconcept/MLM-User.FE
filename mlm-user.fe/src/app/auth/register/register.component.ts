import { Component, inject, signal, computed, ChangeDetectionStrategy, OnInit } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators, AbstractControl, ValidationErrors } from '@angular/forms';
import { RouterModule, Router } from '@angular/router';
import { CheckboxModule } from 'primeng/checkbox';
import { SelectModule } from 'primeng/select';
import { AuthService, type RegisterRequest } from '../../services/auth.service';
import { PaymentService } from '../../services/payment.service';
import { ReferralService } from '../../services/referral.service';
import { ModalService } from '../../services/modal.service';
import { InputTextModule } from 'primeng/inputtext';
import { PasswordModule } from 'primeng/password';
import { environment } from '../../../environments/environment';

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
export class RegisterComponent implements OnInit {
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private paymentService = inject(PaymentService);
  private referralService = inject(ReferralService);
  private router = inject(Router);
  private modalService = inject(ModalService);

  isLoading = signal<boolean>(false);
  referralValid = signal<boolean | null>(null);

  ngOnInit(): void {
    const storedCode = localStorage.getItem('referralCode');
    if (storedCode) {
      this.registerForm.patchValue({ referralCode: storedCode });
      localStorage.removeItem('referralCode');
      // Auto-validate the pre-filled referral code
      this.referralService.validateReferralCode(storedCode).subscribe({
        next: (res) => this.referralValid.set(res.valid),
        error: () => this.referralValid.set(false)
      });
    }
  }

  onReferralBlur(): void {
    const code = this.registerForm.get('referralCode')?.value?.trim();
    if (!code) {
      this.referralValid.set(null);
      return;
    }
    this.referralService.validateReferralCode(code).subscribe({
      next: (res) => this.referralValid.set(res.valid),
      error: () => this.referralValid.set(false)
    });
  }
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
    username: ['', [Validators.required, Validators.minLength(3)]],
    email: ['', [Validators.email]],
    password: ['', [Validators.required, this.passwordStrengthValidator]],
    confirmPassword: ['', [Validators.required]],

    // Step 2: Membership
    package: ['', [Validators.required]],
    currency: ['', [Validators.required]],
    referralCode: [environment.defaultReferralCode],
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
      return !!(this.registerForm.get('username')?.valid &&
                this.registerForm.get('password')?.valid &&
                this.registerForm.get('confirmPassword')?.valid &&
                !this.registerForm.hasError('passwordMismatch') &&
                (this.registerForm.get('email')?.valid));
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
      this.registerForm.get('username')?.markAsTouched();
      this.registerForm.get('email')?.markAsTouched();
      this.registerForm.get('password')?.markAsTouched();
      this.registerForm.get('confirmPassword')?.markAsTouched();
    } else if (step === 2) {
      this.registerForm.get('package')?.markAsTouched();
      this.registerForm.get('currency')?.markAsTouched();
      this.registerForm.get('acceptTerms')?.markAsTouched();
    }
  }

  private initiateRegistrationPayment(packageName: string, currency: string): void {
    const callbackUrl = typeof window !== 'undefined'
      ? `${window.location.origin}/auth/payment/callback`
      : undefined;
    this.paymentService.initiateRegistrationPayment(packageName, currency, callbackUrl).subscribe({
      next: (res) => {
        this.isLoading.set(false);
        const gatewayUrl = res.authorizationUrl ?? res.gatewayUrl;
        if (typeof ngDevMode !== 'undefined' && ngDevMode) {
          console.debug('[Register] Payment initiate response:', { hasGatewayUrl: !!gatewayUrl, hasReference: !!res.reference, res });
        }
        if (gatewayUrl) {
          window.location.href = gatewayUrl;
        } else if (res.reference) {
          this.router.navigate(['/auth/register/payment-pending'], {
            queryParams: { reference: res.reference },
            state: { reference: res.reference }
          });
        } else {
          this.modalService.open(
            'success',
            'Account Created',
            'Your account has been created. Complete your profile to get started.',
            '/onboarding/profile'
          );
          setTimeout(() => this.router.navigate(['/onboarding/profile']), 2000);
        }
      },
      error: (err) => {
        this.isLoading.set(false);
        if (typeof ngDevMode !== 'undefined' && ngDevMode) {
          console.error('[Register] Payment initiate failed:', err);
        }
        this.modalService.open(
          'success',
          'Account Created',
          'Your account has been created. You can complete your registration payment later.',
          '/onboarding/profile'
        );
        setTimeout(() => this.router.navigate(['/onboarding/profile']), 2000);
      }
    });
  }

  onSubmit() {
    if (this.registerForm.valid) {
      this.isLoading.set(true);

      const formValue = this.registerForm.value;
      const payload: RegisterRequest = {
        username: formValue.username!,
        password: formValue.password!,
        package: formValue.package!,
        currency: formValue.currency!,
        referralCode: formValue.referralCode?.trim() || environment.defaultReferralCode,
        ...(formValue.email ? { email: formValue.email } : {})
      };

      this.authService.register(payload).subscribe({
        next: () => {
          this.initiateRegistrationPayment(formValue.package!, formValue.currency!);
        },
        error: (err) => {
          this.isLoading.set(false);
          if (typeof ngDevMode !== 'undefined' && ngDevMode) {
            console.error('Registration failed', err);
          }
          this.modalService.open('error', 'Registration Failed', 'Registration failed. Please try again.');
        }
      });
    } else {
      this.registerForm.markAllAsTouched();
    }
  }
}
