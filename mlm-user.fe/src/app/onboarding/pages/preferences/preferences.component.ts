import {
  Component,
  inject,
  computed,
  ChangeDetectionStrategy,
  OnInit,
  ChangeDetectorRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { SelectModule } from 'primeng/select';
import { CheckboxModule } from 'primeng/checkbox';
import { ModalService } from '../../../services/modal.service';
import { LoadingService } from '../../../services/loading.service';
import { OnboardingService } from '../../../services/onboarding.service';
import { UserService } from '../../../services/user.service';

@Component({
  selector: 'app-preferences',
  imports: [CommonModule, ReactiveFormsModule, RouterModule, SelectModule, CheckboxModule],
  templateUrl: './preferences.component.html',
  styleUrl: './preferences.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PreferencesComponent implements OnInit {
  private fb = inject(FormBuilder);
  private router = inject(Router);
  private modalService = inject(ModalService);
  private onboardingService = inject(OnboardingService);
  private userService = inject(UserService);
  private cdr = inject(ChangeDetectorRef);
  protected loadingService = inject(LoadingService);

  languages = [
    { label: 'English', value: 'en' },
    { label: 'French', value: 'fr' },
    { label: 'Spanish', value: 'es' },
  ];

  accountCurrency = computed(() => this.userService.displayCurrency());
  accountCurrencyLabel = computed(() =>
    this.accountCurrency() === 'NGN' ? 'Nigerian Naira (₦)' : 'US Dollar ($)',
  );

  prefForm = this.fb.group({
    language: ['en'],
    emailNotifications: [true],
    smsNotifications: [false],
  });

  ngOnInit(): void {
    this.loadingService.show();
    this.onboardingService.getPreferences().subscribe({
      next: (data) => {
        const lang = (data['preferredLanguage'] ?? data['preferred_language']) as
          | string
          | undefined;
        if (lang) {
          this.prefForm.patchValue({ language: lang });
        }
        this.loadingService.hide();
      },
      error: () => {
        this.loadingService.hide();
      },
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
    const payload = {
      preferredLanguage: value.language ?? undefined,
      displayCurrency: this.accountCurrency(),
    };

    this.loadingService.show();
    this.onboardingService.updatePreferences(payload).subscribe({
      next: () => {
        this.loadingService.hide();
        const redirectPath = '/dashboard';
        const message = this.userService.isPaid()
          ? 'Your profile has been successfully set up. You are now ready to explore your dashboard.'
          : 'Your preferences were saved. Complete activation from your dashboard when you are ready to unlock all features.';
        this.modalService.open('success', 'Setup Complete!', message, redirectPath);
        this.userService.fetchProfile().subscribe({
          next: () => {},
          error: () => {},
        });
        setTimeout(() => {
          this.router.navigate([redirectPath]);
        }, 2000);
      },
      error: () => {
        this.loadingService.hide();
        if (typeof ngDevMode !== 'undefined' && ngDevMode) {
          console.error('Preferences update failed');
        }
        this.modalService.open(
          'error',
          'Could not save',
          "We couldn't save your preferences. Please try again.",
        );
      },
    });
  }
}
