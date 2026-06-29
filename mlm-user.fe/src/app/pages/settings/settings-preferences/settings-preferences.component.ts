import { Component, inject, signal, computed, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { SelectModule } from 'primeng/select';
import { ToggleSwitchModule } from 'primeng/toggleswitch';
import { UserService } from '../../../services/user.service';
import { OnboardingService } from '../../../services/onboarding.service';

@Component({
  selector: 'app-settings-preferences',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule, SelectModule, ToggleSwitchModule],
  templateUrl: './settings-preferences.component.html',
  styleUrl: './settings-preferences.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SettingsPreferencesComponent implements OnInit {
  private userService = inject(UserService);
  private onboardingService = inject(OnboardingService);


  currentUser = this.userService.currentUser;


  language = signal<string>('en');
  darkMode = signal<boolean>(false);
  savedMessage = signal<string | null>(null);
  isSaving = signal(false);

  languages = [
    { label: 'English', value: 'en' },
    { label: 'Français', value: 'fr' }
  ];

  accountCurrency = this.userService.displayCurrency;
  accountCurrencyLabel = computed(() =>
    this.accountCurrency() === 'NGN' ? 'Nigerian Naira (₦)' : 'US Dollar ($)',
  );

  private lastSavedLanguage = signal<string>('en');
  private lastSavedDarkMode = signal<boolean>(false);

  hasChanges = computed(() =>
    this.language() !== this.lastSavedLanguage() ||
    this.darkMode() !== this.lastSavedDarkMode()
  );

  ngOnInit(): void {
    const lang = localStorage.getItem('mlm_settings_language') ?? 'en';
    const theme = localStorage.getItem('mlm_settings_darkMode') === 'true';
    this.language.set(lang);
    this.darkMode.set(theme);
    this.lastSavedLanguage.set(lang);
    this.lastSavedDarkMode.set(theme);
  }

  save(): void {
    if (!this.hasChanges()) return;
    this.isSaving.set(true);

    const lang = this.language();
    const theme = this.darkMode();
    const accountCurrency = this.accountCurrency();

    localStorage.setItem('mlm_settings_language', lang);
    localStorage.setItem('mlm_settings_darkMode', String(theme));
    this.lastSavedLanguage.set(lang);
    this.lastSavedDarkMode.set(theme);

    this.onboardingService.updatePreferences({
      preferredLanguage: lang,
      displayCurrency: accountCurrency,
    }).subscribe({
      next: () => {
        this.userService.setDisplayCurrency(accountCurrency);
        this.isSaving.set(false);
        this.savedMessage.set('Preferences saved.');
        setTimeout(() => this.savedMessage.set(null), 3000);
      },
      error: () => {
        this.isSaving.set(false);
      }
    });
  }
}
