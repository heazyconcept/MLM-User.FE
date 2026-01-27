import { Component, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { SelectModule } from 'primeng/select';
import { DatePickerModule } from 'primeng/datepicker';
import { AuthInputComponent } from '../../../auth/components/auth-input/auth-input.component';
import { FileUploadComponent } from '../../components/file-upload/file-upload.component';

@Component({
  selector: 'app-profile-info',
  imports: [
    CommonModule,
    ReactiveFormsModule,
    ButtonModule,
    SelectModule,
    DatePickerModule,
    AuthInputComponent,
    FileUploadComponent
  ],
  templateUrl: './profile.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ProfileInfoComponent {
  private fb = inject(FormBuilder);
  private router = inject(Router);

  isLoading = signal<boolean>(false);

  genders = [
    { label: 'Male', value: 'male' },
    { label: 'Female', value: 'female' },
    { label: 'Other', value: 'other' }
  ];

  profileForm = this.fb.group({
    firstName: ['', [Validators.required]],
    lastName: ['', [Validators.required]],
    username: [{ value: 'user_123', disabled: true }, [Validators.required]],
    dob: ['', [Validators.required]],
    gender: ['']
  });

  onFileSelected(file: File) {
    console.log('Profile photo selected:', file);
  }

  onSubmit() {
    if (this.profileForm.valid) {
      this.isLoading.set(true);
      // Simulated 1s delay
      setTimeout(() => {
        this.isLoading.set(false);
        this.router.navigate(['/onboarding/contact']);
      }, 1000);
    } else {
      this.profileForm.markAllAsTouched();
    }
  }
}

