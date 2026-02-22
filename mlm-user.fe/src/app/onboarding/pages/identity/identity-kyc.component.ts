import { Component, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { SelectModule } from 'primeng/select';
import { FileUploadComponent } from '../../components/file-upload/file-upload.component';
import { OnboardingService } from '../../../services/onboarding.service';
import { ModalService } from '../../../services/modal.service';

const ID_TYPE_TO_API: Record<string, 'NATIONAL_ID' | 'PASSPORT' | 'DRIVERS_LICENSE'> = {
  national_id: 'NATIONAL_ID',
  passport: 'PASSPORT',
  drivers_license: 'DRIVERS_LICENSE'
};

@Component({
  selector: 'app-identity-kyc',
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterModule,
    SelectModule,
    FileUploadComponent
  ],
  templateUrl: './identity-kyc.component.html',
  styleUrl: './identity-kyc.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class IdentityKycComponent {
  private fb = inject(FormBuilder);
  private router = inject(Router);
  private onboardingService = inject(OnboardingService);
  private modalService = inject(ModalService);


  isLoading = signal<boolean>(false);

  idTypes = [
    { label: 'National ID', value: 'national_id' },
    { label: 'Passport', value: 'passport' },
    { label: 'Driver\'s License', value: 'drivers_license' }
  ];

  kycForm = this.fb.group({
    idType: ['', [Validators.required]],
    idNumber: ['', [Validators.required, Validators.minLength(11), Validators.maxLength(11)]],
    idDocument: [null as File | null],
    selfie: [null as File | null]
  });

  onFileSelected(field: string, file: File): void {
    this.kycForm.get(field)?.setValue(file);
  }

  onSubmit(): void {
    if (this.kycForm.invalid) {
      this.kycForm.markAllAsTouched();
      return;
    }

    const value = this.kycForm.getRawValue();
    const idTypeRaw = typeof value.idType === 'string' ? value.idType : undefined;
    const idTypeApi = idTypeRaw ? ID_TYPE_TO_API[idTypeRaw] ?? 'NATIONAL_ID' : 'NATIONAL_ID';

    const formData = new FormData();
    formData.append('idType', idTypeApi);
    formData.append('idNumber', value.idNumber ?? '');
    if (value.idDocument instanceof File) {
      formData.append('document', value.idDocument, value.idDocument.name);
    }
    if (value.selfie instanceof File) {
      formData.append('selfie', value.selfie, value.selfie.name);
    }

    this.isLoading.set(true);
    this.onboardingService.submitIdentity(formData).subscribe({
      next: () => {
        this.isLoading.set(false);
        this.router.navigate(['/onboarding/bank']);
      },
      error: () => {
        this.isLoading.set(false);
        if (typeof ngDevMode !== 'undefined' && ngDevMode) {
          console.error('Identity submission failed');
        }
        this.modalService.open(
          'error',
          'Could not submit',
          'We couldn\'t submit your identity details. Please try again.'
        );
      }
    });
  }
}
