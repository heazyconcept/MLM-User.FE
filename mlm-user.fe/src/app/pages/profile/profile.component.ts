import { Component, inject, ChangeDetectionStrategy, ChangeDetectorRef, signal, effect, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { CardModule } from 'primeng/card';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { TextareaModule } from 'primeng/textarea';
import { BadgeModule } from 'primeng/badge';
import { UserService } from '../../services/user.service';
import { OnboardingService } from '../../services/onboarding.service';
import { ModalService } from '../../services/modal.service';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    CardModule,
    ButtonModule,
    InputTextModule,
    TextareaModule,
    BadgeModule
  ],
  templateUrl: './profile.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ProfileComponent implements OnInit {
  private fb = inject(FormBuilder);
  private userService = inject(UserService);
  private onboardingService = inject(OnboardingService);
  private modalService = inject(ModalService);
  private cdr = inject(ChangeDetectorRef);

  isEditMode = signal<boolean>(false);
  isSaving = signal<boolean>(false);
  currentUser = this.userService.currentUser;

  profileForm = this.fb.group({
    firstName: ['', [Validators.required]],
    lastName: ['', [Validators.required]],
    email: [{ value: '', disabled: true }],
    phoneNumber: ['', [Validators.required]],
    address: [''],
    bankName: [''],
    accountNumber: [''],
    accountName: ['']
  });

  constructor() {
    // Effect to update form when user data changes
    effect(() => {
      const user = this.currentUser();
      if (user && !this.isEditMode()) {
        this.populateForm(user);
      }
    });

    // Initialize form with current user data
    const user = this.currentUser();
    if (user) {
      this.populateForm(user);
    }
  }

  ngOnInit(): void {
    this.userService.fetchProfile().subscribe({
      next: (user) => {
        this.populateForm(user);
        this.cdr.markForCheck();
        this.fetchBankDetails();
        this.fetchIdentityDetails();
      },
      error: () => {}
    });
  }

  private fetchIdentityDetails(): void {
    this.onboardingService.getIdentity().subscribe({
      next: (data) => {
        const status = (data['kycStatus'] ?? data['status'] ?? data['kyc_status']) as string | undefined;
        if (status && ['PENDING', 'VERIFIED', 'REJECTED'].includes(status.toUpperCase())) {
          this.userService.updateProfile({
            kycStatus: status.toUpperCase() as 'PENDING' | 'VERIFIED' | 'REJECTED'
          });
          this.cdr.markForCheck();
        }
      },
      error: () => {}
    });
  }

  private fetchBankDetails(): void {
    this.onboardingService.getBankDetails().subscribe({
      next: (data) => {
        const bankName = (data['bankName'] ?? data['bank_name']) as string | undefined;
        const accountNumber = (data['accountNumber'] ?? data['account_number']) as string | undefined;
        const accountNumberMasked = (data['accountNumberMasked'] ?? data['account_number_masked']) as string | undefined;
        const accountName = (data['accountName'] ?? data['account_name']) as string | undefined;
        const displayAccountNumber = accountNumber ?? accountNumberMasked;
        if (bankName || displayAccountNumber || accountName) {
          this.userService.updateProfile({
            bankName: bankName ?? undefined,
            accountNumber: displayAccountNumber ?? undefined,
            accountName: accountName ?? undefined
          });
          this.profileForm.patchValue({
            bankName: bankName ?? '',
            accountNumber: displayAccountNumber ?? '',
            accountName: accountName ?? ''
          });
          this.cdr.markForCheck();
        }
      },
      error: () => {}
    });
  }

  private populateForm(user: NonNullable<ReturnType<typeof this.currentUser>>): void {
    this.profileForm.patchValue({
      firstName: user.firstName || '',
      lastName: user.lastName || '',
      email: user.email || '',
      phoneNumber: user.phoneNumber || '',
      address: user.address || '',
      bankName: user.bankName || '',
      accountNumber: user.accountNumber || '',
      accountName: user.accountName || ''
    });
    this.cdr.markForCheck();
  }

  enterEditMode(): void {
    const user = this.currentUser();
    if (user) {
      this.populateForm(user);
    }
    this.isEditMode.set(true);
    this.cdr.markForCheck();
  }

  cancelEdit(): void {
    const user = this.currentUser();
    if (user) {
      this.populateForm(user);
    }
    this.isEditMode.set(false);
    this.profileForm.markAsUntouched();
    this.cdr.markForCheck();
  }

  onSubmit(): void {
    if (this.profileForm.valid) {
      this.isSaving.set(true);
      const formValue = this.profileForm.getRawValue();

      const profilePayload = {
        firstName: formValue.firstName?.trim() || undefined,
        lastName: formValue.lastName?.trim() || undefined,
        phone: formValue.phoneNumber?.trim() || undefined,
        address: formValue.address?.trim() || undefined
      };
      Object.keys(profilePayload).forEach(k => (profilePayload as Record<string, unknown>)[k] === undefined && delete (profilePayload as Record<string, unknown>)[k]);

      this.onboardingService.updateProfile(profilePayload).subscribe({
        next: () => {
          const hasBankFields = formValue.bankName?.trim() || formValue.accountNumber?.trim() || formValue.accountName?.trim();
          if (hasBankFields) {
            const bankPayload = {
              bankName: formValue.bankName?.trim() ?? '',
              accountNumber: formValue.accountNumber?.trim() ?? '',
              accountName: formValue.accountName?.trim() ?? '',
              accountType: 'SAVINGS' as const
            };
            this.onboardingService.updateBankDetails(bankPayload).subscribe({
              next: () => this.handleSaveSuccess(),
              error: () => this.handleSaveSuccess()
            });
          } else {
            this.handleSaveSuccess();
          }
        },
        error: () => {
          this.isSaving.set(false);
          this.modalService.open('error', 'Could not save', 'We couldn\'t save your profile. Please try again.');
          this.cdr.markForCheck();
        }
      });
    } else {
      this.profileForm.markAllAsTouched();
      this.cdr.markForCheck();
    }
  }

  private handleSaveSuccess(): void {
    this.userService.fetchProfile().subscribe({
      next: () => {
        this.fetchBankDetails();
        this.fetchIdentityDetails();
        this.isSaving.set(false);
        this.isEditMode.set(false);
        this.cdr.markForCheck();
        this.modalService.open('success', 'Profile Updated', 'Your profile has been updated successfully.');
      },
      error: () => {
        this.isSaving.set(false);
        this.isEditMode.set(false);
        this.cdr.markForCheck();
        this.modalService.open('success', 'Profile Updated', 'Your profile has been updated successfully.');
      }
    });
  }
}
