import { Component, inject, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { CardModule } from 'primeng/card';
import { ButtonModule } from 'primeng/button';
import { SelectModule } from 'primeng/select';
import { InputTextModule } from 'primeng/inputtext';
import { MessageModule } from 'primeng/message';
import { UserService } from '../../../services/user.service';
import { LoadingService } from '../../../services/loading.service';
import { ModalService } from '../../../services/modal.service';

interface PaymentMethod {
  label: string;
  value: string;
}

@Component({
  selector: 'app-registration-payment',
  imports: [
    CommonModule,
    ReactiveFormsModule,
    CardModule,
    ButtonModule,
    SelectModule,
    InputTextModule,
    MessageModule
  ],
  templateUrl: './registration-payment.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class RegistrationPaymentComponent {
  private fb = inject(FormBuilder);
  private router = inject(Router);
  private userService = inject(UserService);
  private loadingService = inject(LoadingService);
  private modalService = inject(ModalService);

  paymentMethods: PaymentMethod[] = [
    { label: 'Credit Card', value: 'credit_card' },
    { label: 'Debit Card', value: 'debit_card' },
    { label: 'Bank Transfer', value: 'bank_transfer' },
    { label: 'Mobile Money', value: 'mobile_money' }
  ];

  paymentForm = this.fb.group({
    paymentMethod: ['', [Validators.required]],
    amount: [{ value: 5000, disabled: true }] // Registration fee amount in Naira
  });

  onSubmit(): void {
    if (this.paymentForm.valid) {
      this.loadingService.show();
      
      // Simulate payment processing
      setTimeout(() => {
        this.loadingService.hide();
        
        // Simulate random success/failure (90% success rate for demo)
        const isSuccess = Math.random() > 0.1;
        
        if (isSuccess) {
          // Update payment status
          this.userService.updatePaymentStatus('PAID');
          
          // Small delay to ensure signal update propagates
          setTimeout(() => {
            // Show success modal
            this.modalService.open(
              'success',
              'Payment Successful',
              'Your registration fee of ₦5,000 has been paid successfully. You now have full access to all features.',
              '/dashboard'
            );
          }, 100);
        } else {
          // Show error modal
          this.modalService.open(
            'error',
            'Payment Failed',
            'Payment processing failed. Please try again or contact support if the problem persists.'
          );
        }
      }, 1500);
    } else {
      this.paymentForm.markAllAsTouched();
      this.modalService.open(
        'error',
        'Validation Error',
        'Please select a payment method to continue.'
      );
    }
  }

  goBack(): void {
    this.router.navigate(['/dashboard']);
  }
}

