import { Component, inject, signal, computed, ChangeDetectionStrategy, OnInit } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators, AbstractControl, ValidationErrors } from '@angular/forms';
import { RouterModule, Router, ActivatedRoute } from '@angular/router';
import { CheckboxModule } from 'primeng/checkbox';
import { SelectModule } from 'primeng/select';
import { environment } from '../../../environments/environment';
import { AuthService, type RegisterRequest } from '../../services/auth.service';
import { UserService } from '../../services/user.service';
import { ReferralService } from '../../services/referral.service';
import { ModalService } from '../../services/modal.service';
import { LoadingService } from '../../services/loading.service';
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
export class RegisterComponent implements OnInit {
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private userService = inject(UserService);
  private referralService = inject(ReferralService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private modalService = inject(ModalService);
  protected loadingService = inject(LoadingService);
  referralValid = signal<boolean | null>(null);
  referralValidating = signal(false);

  ngOnInit(): void {
    this.applyPackageFromRoute();

    // Prefill: query param (?ref=ABC123) or localStorage (from /ref/:code) overrides default
    const queryRef = this.route.snapshot.queryParamMap.get('ref')?.trim();
    const storedCode = localStorage.getItem('referralCode');
    const codeToUse = queryRef || storedCode || environment.defaultReferralCode || '';
    if (queryRef) {
      localStorage.setItem('referralCode', queryRef);
    }
    this.registerForm.patchValue({ referralCode: codeToUse });
    if (codeToUse) {
      this.referralValidating.set(true);
      this.referralService.validateReferralCode(codeToUse).subscribe({
        next: (res) => {
          this.referralValidating.set(false);
          this.referralValid.set(res.valid);
        },
        error: () => {
          this.referralValidating.set(false);
          this.referralValid.set(false);
        }
      });
    }
  }

  /** Path segment from marketing site: /auth/register/RUBY (see mlm-app-package-query-handoff.md). */
  private applyPackageFromRoute(): void {
    const raw = this.route.snapshot.paramMap.get('packageCode')?.trim();
    if (!raw) return;
    let decoded = raw;
    try {
      decoded = decodeURIComponent(raw);
    } catch {
      /* keep raw */
    }
    const normalized = decoded.toUpperCase();
    const allowed = new Set(this.packages.map((p) => p.value));
    if (!allowed.has(normalized)) return;
    this.registerForm.patchValue({ package: normalized });
  }

  onReferralBlur(): void {
    const code = this.registerForm.get('referralCode')?.value?.trim();
    if (!code) {
      this.referralValid.set(null);
      this.referralValidating.set(false);
      return;
    }
    this.referralValidating.set(true);
    this.referralValid.set(null);
    this.referralService.validateReferralCode(code).subscribe({
      next: (res) => {
        this.referralValidating.set(false);
        this.referralValid.set(res.valid);
      },
      error: () => {
        this.referralValidating.set(false);
        this.referralValid.set(false);
      }
    });
  }
  currentStep = signal<number>(1);
  totalSteps = signal<number>(2);

  packages = [
    { label: 'Nickel', value: 'NICKEL' },
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
    email: ['', [this.optionalEmailValidator.bind(this)]],
    password: ['', [Validators.required, this.passwordStrengthValidator]],
    confirmPassword: ['', [Validators.required]],

    // Step 2: Membership
    package: ['', [Validators.required]],
    currency: ['', [Validators.required]],
    referralCode: [environment.defaultReferralCode ?? ''],
    placementParentUserId: [''],
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

  /** Empty or whitespace-only is valid; non-empty must pass email format. */
  private optionalEmailValidator(control: AbstractControl): ValidationErrors | null {
    const trimmed = typeof control.value === 'string' ? control.value.trim() : '';
    if (!trimmed) {
      return null;
    }
    return Validators.email({ value: trimmed } as AbstractControl);
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
                (this.registerForm.get('email')?.valid ?? false));
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

  onSubmit() {
    if (this.registerForm.valid) {
      this.loadingService.show();

      const formValue = this.registerForm.value;
      const code = formValue.referralCode?.trim();
      const placementId = formValue.placementParentUserId?.trim();
      const emailTrim = formValue.email?.trim() ?? '';
      const payload: RegisterRequest = {
        username: formValue.username!,
        ...(emailTrim ? { email: emailTrim } : {}),
        password: formValue.password!,
        package: formValue.package!,
        currency: formValue.currency!,
        ...(code ? { referralCode: code } : {}),
        ...(placementId ? { placementParentUserId: placementId } : {})
      };

      this.authService.register(payload).subscribe({
        next: () => {
          localStorage.removeItem('referralCode');
          this.userService.fetchProfile().subscribe({
            next: () => {
              this.loadingService.hide();
              const path = this.userService.isPaid() ? '/dashboard' : '/auth/activation';
              this.router.navigate([path]);
            },
            error: () => {
              this.loadingService.hide();
              this.router.navigate(['/auth/activation']);
            }
          });
        },
        error: (err) => {
          this.loadingService.hide();
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
