import { Component, inject, signal, ChangeDetectionStrategy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { SelectModule } from 'primeng/select';
import { OnboardingService } from '../../../services/onboarding.service';
import { ModalService } from '../../../services/modal.service';
import { LoadingService } from '../../../services/loading.service';

@Component({
  selector: 'app-bank-details',
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterModule,
    SelectModule
  ],
  templateUrl: './bank-details.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class BankDetailsComponent implements OnInit {
  private fb = inject(FormBuilder);
  private router = inject(Router);
  private onboardingService = inject(OnboardingService);
  private modalService = inject(ModalService);
  protected loadingService = inject(LoadingService);
  accountTypes = [
    { label: 'Savings', value: 'savings' },
    { label: 'Current', value: 'current' }
  ];

  bankForm = this.fb.group({
    bankName: ['', [Validators.required]],
    accountNumber: ['', [Validators.required, Validators.pattern(/^\d{8,11}$/)]],
    accountName: ['', [Validators.required]],
    accountType: ['savings' as 'savings' | 'current', [Validators.required]]
  });

  ngOnInit(): void {
    this.loadingService.show();
    this.onboardingService.getBankDetails().subscribe({
      next: (data: Record<string, unknown>) => {
        const bankName = (data['bankName'] ?? data['bank_name']) as string | undefined;
        const accountNumber = (data['accountNumber'] ?? data['account_number']) as string | undefined;
        const accountName = (data['accountName'] ?? data['account_name']) as string | undefined;
        const accountType = (data['accountType'] ?? data['account_type']) as string | undefined;
        if (bankName || accountNumber || accountName || accountType) {
          this.bankForm.patchValue({
            bankName: bankName ?? '',
            accountNumber: accountNumber ?? '',
            accountName: accountName ?? '',
            accountType: accountType?.toLowerCase() === 'current' ? 'current' : 'savings'
          });
        }
        this.loadingService.hide();
      },
      error: () => {
        this.loadingService.hide();
        /* silently ignore — user will fill in */
      }
    });
  }

  skip(): void {
    this.router.navigate(['/onboarding/preferences']);
  }

  onSubmit(): void {
    if (this.bankForm.invalid) {
      this.bankForm.markAllAsTouched();
      return;
    }

    const value = this.bankForm.getRawValue();
    const accountType = (value.accountType === 'current' ? 'CURRENT' : 'SAVINGS') as 'SAVINGS' | 'CURRENT';
    const payload = {
      bankName: value.bankName ?? '',
      accountNumber: value.accountNumber ?? '',
      accountName: value.accountName ?? '',
      accountType
    };

    this.loadingService.show();
    this.onboardingService.updateBankDetails(payload).subscribe({
      next: () => {
        this.loadingService.hide();
        this.router.navigate(['/onboarding/preferences']);
      },
      error: () => {
        this.loadingService.hide();
        if (typeof ngDevMode !== 'undefined' && ngDevMode) {
          console.error('Bank details update failed');
        }
        this.modalService.open(
          'error',
          'Could not save',
          'We couldn\'t save your bank details. Please try again.'
        );
      }
    });
  }
}
