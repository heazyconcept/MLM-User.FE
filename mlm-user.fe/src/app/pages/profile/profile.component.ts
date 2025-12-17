import { Component, inject, ChangeDetectionStrategy, ChangeDetectorRef, signal, computed, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { CardModule } from 'primeng/card';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { TextareaModule } from 'primeng/textarea';
import { BadgeModule } from 'primeng/badge';
import { UserService } from '../../services/user.service';
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
export class ProfileComponent {
  private fb = inject(FormBuilder);
  private userService = inject(UserService);
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
      
      // Simulate API call delay
      setTimeout(() => {
        // Update user profile
        this.userService.updateProfile({
          firstName: formValue.firstName || '',
          lastName: formValue.lastName || '',
          phoneNumber: formValue.phoneNumber || undefined,
          address: formValue.address || undefined,
          bankName: formValue.bankName || undefined,
          accountNumber: formValue.accountNumber || undefined,
          accountName: formValue.accountName || undefined
        });

        this.isSaving.set(false);
        this.isEditMode.set(false);
        this.cdr.markForCheck();

        // Show success modal
        this.modalService.open(
          'success',
          'Profile Updated',
          'Your profile has been updated successfully.'
        );
      }, 500);
    } else {
      this.profileForm.markAllAsTouched();
      this.cdr.markForCheck();
    }
  }
}
