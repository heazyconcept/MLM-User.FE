import { Component, inject, signal, ChangeDetectionStrategy, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { SelectModule } from 'primeng/select';
import { CheckboxModule } from 'primeng/checkbox';
import { ModalService } from '../../../services/modal.service';
import { OnboardingService } from '../../../services/onboarding.service';
import { UserService } from '../../../services/user.service';

@Component({
  selector: 'app-preferences',
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterModule,
    SelectModule,
    CheckboxModule
  ],
  templateUrl: './preferences.component.html',
  styleUrl: './preferences.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PreferencesComponent implements OnInit {
  private fb = inject(FormBuilder);
  private router = inject(Router);
  private modalService = inject(ModalService);
  private onboardingService = inject(OnboardingService);
  private userService = inject(UserService);
  private cdr = inject(ChangeDetectorRef);

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
    currency: ['USD' as 'NGN' | 'USD'],
    emailNotifications: [true],
    smsNotifications: [false]
  });

  ngOnInit(): void {
    // Use the registration currency from user profile as the initial default
    const registrationCurrency = this.userService.currentUser()?.currency;
    if (registrationCurrency === 'NGN' || registrationCurrency === 'USD') {
      this.prefForm.patchValue({ currency: registrationCurrency });
    }

    // Then try to load saved preferences (overrides the above if they exist)
    this.onboardingService.getPreferences().subscribe({
      next: (data) => {
        const lang = (data['preferredLanguage'] ?? data['preferred_language']) as string | undefined;
        const currency = (data['displayCurrency'] ?? data['display_currency']) as 'NGN' | 'USD' | undefined;
        if (lang || currency) {
          this.prefForm.patchValue({
            language: lang ?? 'en',
            currency: currency ?? registrationCurrency ?? 'USD'
          });
        }
      },
      error: () => {}
    });
  }

  toggleCheckbox(controlName: 'emailNotifications' | 'smsNotifications'): void {
    const control = this.prefForm.get(controlName);
    if (control) {
      control.setValue(!control.value);
      this.cdr.markForCheck();
    }
  }

  onSubmit(): void {
    const value = this.prefForm.getRawValue();
    const displayCurrency: 'NGN' | 'USD' = value.currency === 'NGN' ? 'NGN' : 'USD';
    const payload = {
      preferredLanguage: value.language ?? undefined,
      displayCurrency
    };

    this.isLoading.set(true);
    this.onboardingService.updatePreferences(payload).subscribe({
      next: () => {
        this.isLoading.set(false);
        this.modalService.open(
          'success',
          'Setup Complete!',
          'Your profile has been successfully set up. You are now ready to explore your dashboard.',
          '/dashboard'
        );
        this.userService.fetchProfile().subscribe({
          next: () => {},
          error: () => {}
        });
        setTimeout(() => {
          this.router.navigate(['/dashboard']);
        }, 2000);
      },
      error: () => {
        this.isLoading.set(false);
        if (typeof ngDevMode !== 'undefined' && ngDevMode) {
          console.error('Preferences update failed');
        }
        this.modalService.open(
          'error',
          'Could not save',
          'We couldn\'t save your preferences. Please try again.'
        );
      }
    });
  }
}
