import { Component, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { AuthInputComponent } from '../../../auth/components/auth-input/auth-input.component';

@Component({
  selector: 'app-bank-details',
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterModule,
    ButtonModule,
    AuthInputComponent
  ],
  templateUrl: './bank-details.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class BankDetailsComponent {
  private fb = inject(FormBuilder);
  private router = inject(Router);

  isLoading = signal<boolean>(false);

  bankForm = this.fb.group({
    bankName: ['', [Validators.required]],
    accountNumber: ['', [Validators.required, Validators.pattern(/^\d{10}$/)]],
    accountName: ['', [Validators.required]],
    accountType: ['savings']
  });

  skip() {
    this.router.navigate(['/onboarding/preferences']);
  }

  onSubmit() {
    if (this.bankForm.valid) {
      this.isLoading.set(true);
      setTimeout(() => {
        this.isLoading.set(false);
        this.router.navigate(['/onboarding/preferences']);
      }, 1000);
    } else {
      this.bankForm.markAllAsTouched();
    }
  }
}

