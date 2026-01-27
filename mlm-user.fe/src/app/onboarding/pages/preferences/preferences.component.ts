import { Component, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { SelectModule } from 'primeng/select';
import { CheckboxModule } from 'primeng/checkbox';
import { ModalService } from '../../../services/modal.service';

@Component({
  selector: 'app-preferences',
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterModule,
    ButtonModule,
    SelectModule,
    CheckboxModule
  ],
  templateUrl: './preferences.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PreferencesComponent {
  private fb = inject(FormBuilder);
  private router = inject(Router);
  private modalService = inject(ModalService);

  isLoading = signal<boolean>(false);

  languages = [
    { label: 'English', value: 'en' },
    { label: 'French', value: 'fr' },
    { label: 'Spanish', value: 'es' }
  ];

  currencies = [
    { label: 'US Dollar ($)', value: 'USD' },
    { label: 'Nigerian Naira (₦)', value: 'NGN' }
  ];

  prefForm = this.fb.group({
    language: ['en'],
    currency: ['USD'],
    emailNotifications: [true],
    smsNotifications: [false]
  });

  onSubmit() {
    this.isLoading.set(true);
    setTimeout(() => {
      this.isLoading.set(false);
      this.modalService.open(
        'success',
        'Setup Complete!',
        'Your profile has been successfully set up. You are now ready to explore your dashboard.',
        '/dashboard'
      );
      setTimeout(() => {
        this.router.navigate(['/dashboard']);
      }, 2000);
    }, 1000);
  }
}

