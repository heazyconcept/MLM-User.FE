import { Component, inject, signal, computed, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators, AbstractControl, ValidationErrors } from '@angular/forms';
import { RouterModule, Router } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { CheckboxModule } from 'primeng/checkbox';
import { SelectModule } from 'primeng/select'; // PrimeNG v21 Select
import { RippleModule } from 'primeng/ripple';
import { AuthService } from '../../services/auth.service';
import { MessageModule } from 'primeng/message';
import { ModalService } from '../../services/modal.service';
import { AuthInputComponent } from '../components/auth-input/auth-input.component';

@Component({
  selector: 'app-register',
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterModule,
    ButtonModule,
    CheckboxModule,
    SelectModule,
    RippleModule,
    MessageModule,
    AuthInputComponent
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
  totalSteps = signal<number>(3);

  packages = [
    { label: 'Silver', value: 'silver' },
    { label: 'Gold', value: 'gold' },
    { label: 'Platinum', value: 'platinum' },
    { label: 'Ruby', value: 'ruby' },
    { label: 'Diamond', value: 'diamond' }
  ];

  registerForm = this.fb.group({
    // Step 1: Personal Info
    firstName: ['', [Validators.required]],
    lastName: ['', [Validators.required]],
    email: ['', [Validators.required, Validators.email]],
    phoneNumber: ['', [Validators.required]],
    
    // Step 2: Account Security
    password: ['', [Validators.required, Validators.minLength(8)]],
    confirmPassword: ['', [Validators.required]],
    sponsorUsername: [''],
    
    // Step 3: Membership
    package: ['', [Validators.required]],
    acceptTerms: [false, [Validators.requiredTrue]]
  }, { validators: this.passwordMatchValidator });

  passwordMatchValidator(control: AbstractControl): ValidationErrors | null {
    const password = control.get('password')?.value;
    const confirmPassword = control.get('confirmPassword')?.value;
    return password === confirmPassword ? null : { passwordMismatch: true };
  }

  isStepValid(step: number): boolean {
    if (step === 1) {
      return !!(this.registerForm.get('firstName')?.valid && 
                this.registerForm.get('lastName')?.valid && 
                this.registerForm.get('email')?.valid && 
                this.registerForm.get('phoneNumber')?.valid);
    }
    if (step === 2) {
      return !!(this.registerForm.get('password')?.valid && 
                this.registerForm.get('confirmPassword')?.valid &&
                !this.registerForm.hasError('passwordMismatch'));
    }
    if (step === 3) {
      return !!(this.registerForm.get('package')?.valid && 
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
      this.registerForm.get('firstName')?.markAsTouched();
      this.registerForm.get('lastName')?.markAsTouched();
      this.registerForm.get('email')?.markAsTouched();
      this.registerForm.get('phoneNumber')?.markAsTouched();
    } else if (step === 2) {
      this.registerForm.get('password')?.markAsTouched();
      this.registerForm.get('confirmPassword')?.markAsTouched();
    } else if (step === 3) {
      this.registerForm.get('package')?.markAsTouched();
      this.registerForm.get('acceptTerms')?.markAsTouched();
    }
  }

  onSubmit() {
    if (this.registerForm.valid) {
      this.isLoading.set(true);
      this.authService.register({ ...this.registerForm.value, status: 'UNPAID' }).subscribe({
        next: () => {
          this.isLoading.set(false);
          this.modalService.open(
            'success', 
            'Account Created', 
            'Your account has been created successfully. Please verify your email.', 
            '/auth/verify'
          );
          setTimeout(() => {
            this.router.navigate(['/auth/verify']);
          }, 2000);
        },
        error: () => {
          this.isLoading.set(false);
        }
      });
    } else {
        this.registerForm.markAllAsTouched();
    }
  }
}
