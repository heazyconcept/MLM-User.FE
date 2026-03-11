import { Component, inject, signal, ChangeDetectionStrategy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { SelectModule } from 'primeng/select';
import { DatePickerModule } from 'primeng/datepicker';
import { FileUploadComponent } from '../../components/file-upload/file-upload.component';
import { OnboardingService } from '../../../services/onboarding.service';
import { UserService } from '../../../services/user.service';
import { ModalService } from '../../../services/modal.service';
import { LoadingService } from '../../../services/loading.service';

@Component({
  selector: 'app-profile-info',
  imports: [
    CommonModule,
    ReactiveFormsModule,
    SelectModule,
    DatePickerModule,
    FileUploadComponent
  ],
  templateUrl: './profile.component.html',
  styleUrl: './profile.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ProfileInfoComponent implements OnInit {
  private fb = inject(FormBuilder);
  private router = inject(Router);
  private onboardingService = inject(OnboardingService);
  private userService = inject(UserService);
  private modalService = inject(ModalService);
  protected loadingService = inject(LoadingService);

  private selectedPhotoFile: File | null = null;

  genders = [
    { label: 'Male', value: 'male' },
    { label: 'Female', value: 'female' },
    { label: 'Other', value: 'other' }
  ];

  profileForm = this.fb.group({
    firstName: ['', [Validators.required]],
    lastName: ['', [Validators.required]],
    dob: [null as Date | null, [Validators.required]],
    gender: ['']
  });

  ngOnInit(): void {
    const user = this.userService.currentUser();
    if (user) {
      this.profileForm.patchValue({
        firstName: user.firstName ?? '',
        lastName: user.lastName ?? ''
      });
      const u = user as unknown as Record<string, unknown>;
      const dob = u['dateOfBirth'] as string | undefined;
      if (dob) {
        this.profileForm.patchValue({ dob: new Date(dob) });
      }
    }
  }

  onFileSelected(file: File): void {
    this.selectedPhotoFile = file;
  }

  onSubmit(): void {
    if (this.profileForm.invalid) {
      this.profileForm.markAllAsTouched();
      return;
    }

    const value = this.profileForm.getRawValue();
    const dob = value.dob;
    const str = (v: string | undefined | null) => (typeof v === 'string' ? v.trim() : undefined) || undefined;
    const payload: Record<string, unknown> = {
      firstName: str(value.firstName),
      lastName: str(value.lastName),
      dateOfBirth: dob instanceof Date ? dob.toISOString().slice(0, 10) : undefined,
      gender: str(value.gender)
    };
    Object.keys(payload).forEach(k => payload[k] === undefined && delete payload[k]);

    this.loadingService.show();

    this.onboardingService.updateProfile(payload).subscribe({
      next: () => {
        if (this.selectedPhotoFile) {
          this.onboardingService.uploadProfilePhoto(this.selectedPhotoFile).subscribe({
            next: () => this.handleSuccess(),
            error: () => this.handleSuccess()
          });
        } else {
          this.handleSuccess();
        }
      },
      error: (err) => {
        this.loadingService.hide();
        if (typeof ngDevMode !== 'undefined' && ngDevMode && err?.error) {
          console.error('Profile update failed', err.error);
        }
        this.modalService.open(
          'error',
          'Could not save',
          'We couldn\'t save your profile. Please try again.'
        );
      }
    });
  }

  private handleSuccess(): void {
    this.loadingService.hide();
    this.userService.fetchProfile().subscribe({
      next: () => this.router.navigate(['/onboarding/contact']),
      error: () => this.router.navigate(['/onboarding/contact'])
    });
  }
}
