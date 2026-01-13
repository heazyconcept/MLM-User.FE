import { Component, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { SelectModule } from 'primeng/select';
import { AuthInputComponent } from '../../../auth/components/auth-input/auth-input.component';
import { FileUploadComponent } from '../../components/file-upload/file-upload.component';

@Component({
  selector: 'app-identity-kyc',
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterModule,
    ButtonModule,
    SelectModule,
    AuthInputComponent,
    FileUploadComponent
  ],
  templateUrl: './identity-kyc.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class IdentityKycComponent {
  private fb = inject(FormBuilder);
  private router = inject(Router);

  isLoading = signal<boolean>(false);

  idTypes = [
    { label: 'National ID', value: 'national_id' },
    { label: 'Passport', value: 'passport' },
    { label: 'Driver’s License', value: 'drivers_license' }
  ];

  kycForm = this.fb.group({
    idType: ['', [Validators.required]],
    idNumber: ['', [Validators.required, Validators.minLength(11), Validators.maxLength(11)]],
    idDocument: [null, [Validators.required]],
    selfie: [null, [Validators.required]]
  });

  onFileSelected(field: string, file: File) {
    this.kycForm.get(field)?.setValue(file as any);
  }

  onSubmit() {
    if (this.kycForm.valid) {
      this.isLoading.set(true);
      setTimeout(() => {
        this.isLoading.set(false);
        this.router.navigate(['/onboarding/bank']);
      }, 1000);
    } else {
      this.kycForm.markAllAsTouched();
    }
  }
}

