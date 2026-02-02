import { Component, inject, signal, computed, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { SelectModule } from 'primeng/select';
import { ToggleSwitchModule } from 'primeng/toggleswitch';
import { UserService } from '../../../services/user.service';

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

  currentUser = this.userService.currentUser;
  language = signal<string>('en');
  darkMode = signal<boolean>(false);
  savedMessage = signal<string | null>(null);

  languages = [
    { label: 'English', value: 'en' },
    { label: 'Français', value: 'fr' }
  ];

  displayCurrency = computed(() => this.currentUser()?.currency ?? 'NGN');

  private lastSavedLanguage = signal<string>('en');
  private lastSavedDarkMode = signal<boolean>(false);

  hasChanges = computed(() =>
    this.language() !== this.lastSavedLanguage() || this.darkMode() !== this.lastSavedDarkMode()
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
    localStorage.setItem('mlm_settings_language', this.language());
    localStorage.setItem('mlm_settings_darkMode', String(this.darkMode()));
    this.lastSavedLanguage.set(this.language());
    this.lastSavedDarkMode.set(this.darkMode());
    this.savedMessage.set('Preferences saved.');
    setTimeout(() => this.savedMessage.set(null), 3000);
  }
}
