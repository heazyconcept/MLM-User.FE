import { Component, inject, ChangeDetectionStrategy, ChangeDetectorRef, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators, AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { CardModule } from 'primeng/card';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { TextareaModule } from 'primeng/textarea';
import { BadgeModule } from 'primeng/badge';
import { DynamicDialogConfig, DynamicDialogRef } from 'primeng/dynamicdialog';
import { UserService } from '../../services/user.service';
import { OnboardingService } from '../../services/onboarding.service';
import { ModalService } from '../../services/modal.service';
import { forkJoin, of } from 'rxjs';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
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
  private dialogConfig = inject(DynamicDialogConfig, { optional: true });
  private dialogRef = inject(DynamicDialogRef, { optional: true });

  isEditMode = signal<boolean>(false);
  isSaving = signal<boolean>(false);
  isChangingPassword = signal<boolean>(false);
  currentUser = this.userService.currentUser;
  isDialogMode = signal<boolean>(false);
  private closeOnSave = true;

  profileForm = this.fb.group({
    firstName: ['', [Validators.required]],
    lastName: ['', [Validators.required]],
    email: [{ value: '', disabled: true }],
    phoneNumber: ['', [Validators.required, Validators.pattern(/^[0-9]{11}$/)]],
    address: [''],
    bankName: [''],
    accountNumber: [''],
    accountName: [''],
    accountType: ['SAVINGS']
  });

  passwordForm = this.fb.group(
    {
      currentPassword: ['', [Validators.required]],
      newPassword: ['', [Validators.required, Validators.minLength(6)]],
      confirmPassword: ['', [Validators.required]]
    },
    { validators: this.confirmMatchValidator() }
  );

  ngOnInit(): void {
    const dialogData = this.dialogConfig?.data as
      | { startInEdit?: boolean; dialogMode?: boolean; closeOnSave?: boolean }
      | undefined;
    if (dialogData?.dialogMode) {
      this.isDialogMode.set(true);
      this.closeOnSave = dialogData.closeOnSave !== false;
    }

    const user = this.currentUser();
    if (user) {
      this.populateForm(user);
    }

    if (dialogData?.startInEdit) {
      this.isEditMode.set(true);
    }

    // Reactive bank validators: conditionally require bank fields only if any bank details are filled in
    this.profileForm.valueChanges.subscribe(() => {
      const bankName = this.profileForm.get('bankName')?.value;
      const accountNumber = this.profileForm.get('accountNumber')?.value;
      const accountName = this.profileForm.get('accountName')?.value;

      const hasAny = !!(bankName?.trim() || accountNumber?.trim() || accountName?.trim());

      const bankNameCtrl = this.profileForm.get('bankName');
      const accountNumberCtrl = this.profileForm.get('accountNumber');
      const accountNameCtrl = this.profileForm.get('accountName');

      if (hasAny) {
        bankNameCtrl?.setValidators([Validators.required]);
        accountNumberCtrl?.setValidators([Validators.required, Validators.pattern(/^\d{8,11}$/)]);
        accountNameCtrl?.setValidators([Validators.required]);
      } else {
        bankNameCtrl?.clearValidators();
        accountNumberCtrl?.clearValidators();
        accountNameCtrl?.clearValidators();
      }

      bankNameCtrl?.updateValueAndValidity({ emitEvent: false });
      accountNumberCtrl?.updateValueAndValidity({ emitEvent: false });
      accountNameCtrl?.updateValueAndValidity({ emitEvent: false });
    });

    // Load bank details
    this.onboardingService.getBankDetails().subscribe({
      next: (data: Record<string, unknown>) => {
        const bankName = (data['bankName'] ?? data['bank_name']) as string | undefined;
        const accountNumber = (data['accountNumber'] ?? data['account_number']) as string | undefined;
        const accountNumberMasked = (data['accountNumberMasked'] ?? data['account_number_masked']) as string | undefined;
        const accountName = (data['accountName'] ?? data['account_name']) as string | undefined;
        const accountType = (data['accountType'] ?? data['account_type']) as string | undefined;
        const displayAccountNumber = accountNumber ?? accountNumberMasked;
        if (bankName || displayAccountNumber || accountName || accountType) {
          this.userService.updateProfile({
            bankName: bankName ?? undefined,
            accountNumber: displayAccountNumber ?? undefined,
            accountName: accountName ?? undefined
          });
          this.profileForm.patchValue({
            bankName: bankName ?? '',
            accountNumber: displayAccountNumber ?? '',
            accountName: accountName ?? '',
            accountType: accountType?.toUpperCase() === 'CURRENT' ? 'CURRENT' : 'SAVINGS'
          });
          this.cdr.markForCheck();
        }
      },
      error: () => { /* silently ignore */ }
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
    if (this.isDialogMode()) {
      this.dialogRef?.close(false);
      return;
    }
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

      const bankName = formValue.bankName?.trim() || '';
      const accountNumber = formValue.accountNumber?.trim() || '';
      const accountName = formValue.accountName?.trim() || '';
      const accountType = (formValue.accountType === 'CURRENT' ? 'CURRENT' : 'SAVINGS') as 'SAVINGS' | 'CURRENT';

      const hasBankInfo = !!(bankName || accountNumber || accountName);

      const profile$ = this.onboardingService.updateProfile(profilePayload);
      const bank$ = hasBankInfo
        ? this.onboardingService.updateBankDetails({
            bankName,
            accountNumber,
            accountName,
            accountType
          })
        : of(null);

      forkJoin({ profile: profile$, bank: bank$ }).subscribe({
        next: () => {
          this.handleSaveSuccess();
        },
        error: () => {
          this.isSaving.set(false);
          this.modalService.open('error', 'Could not save', 'We couldn\'t save your profile and bank details. Please try again.');
          this.cdr.markForCheck();
        }
      });
    } else {
      this.profileForm.markAllAsTouched();
      this.cdr.markForCheck();
    }
  }

  private confirmMatchValidator(): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      const newP = control.get('newPassword')?.value;
      const confirm = control.get('confirmPassword')?.value;
      return newP === confirm ? null : { passwordMismatch: true };
    };
  }

  changePassword(): void {
    if (this.passwordForm.invalid || this.passwordForm.pristine) return;
    this.isChangingPassword.set(true);
    const { currentPassword, newPassword } = this.passwordForm.getRawValue();
    this.userService.changePassword(currentPassword ?? '', newPassword ?? '').subscribe({
      next: () => {
        this.passwordForm.reset();
        this.isChangingPassword.set(false);
        this.cdr.markForCheck();
        this.modalService.open('success', 'Password Updated', 'Your password has been updated successfully.');
      },
      error: () => {
        this.isChangingPassword.set(false);
        this.cdr.markForCheck();
        this.modalService.open('error', 'Could not update password', 'Please try again.');
      }
    });
  }

  private handleSaveSuccess(): void {
    this.userService.fetchProfile().subscribe();
    this.isSaving.set(false);
    this.isEditMode.set(false);
    this.cdr.markForCheck();
    this.modalService.open('success', 'Profile Updated', 'Your profile has been updated successfully.');

    if (this.isDialogMode() && this.closeOnSave) {
      this.dialogRef?.close(true);
    }
  }
}
