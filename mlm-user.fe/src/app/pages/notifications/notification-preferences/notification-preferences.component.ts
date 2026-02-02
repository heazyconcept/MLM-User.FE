import { Component, inject, signal, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ToggleSwitchModule } from 'primeng/toggleswitch';
import { NotificationService, NotificationCategory } from '../../../services/notification.service';

const PREFERENCE_OPTIONS: { key: NotificationCategory; label: string }[] = [
  { key: 'earnings', label: 'Earnings' },
  { key: 'wallet', label: 'Wallet' },
  { key: 'orders', label: 'Orders' },
  { key: 'network', label: 'Network' },
  { key: 'system', label: 'System' }
];

@Component({
  selector: 'app-notification-preferences',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule, ToggleSwitchModule],
  templateUrl: './notification-preferences.component.html',
  styleUrl: './notification-preferences.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class NotificationPreferencesComponent implements OnInit {
  private notificationService = inject(NotificationService);

  preferenceOptions = PREFERENCE_OPTIONS;
  localPrefs = signal<Record<NotificationCategory, boolean>>({
    earnings: true,
    wallet: true,
    orders: true,
    network: true,
    system: true
  });
  savedMessage = signal<string | null>(null);

  ngOnInit(): void {
    const prefs = this.notificationService.preferences();
    this.localPrefs.set({ ...prefs });
  }

  setPreference(key: NotificationCategory, value: boolean): void {
    this.localPrefs.update(p => ({ ...p, [key]: value }));
    this.savedMessage.set(null);
  }

  save(): void {
    this.notificationService.updatePreferences(this.localPrefs());
    this.savedMessage.set('Preferences saved.');
    setTimeout(() => this.savedMessage.set(null), 3000);
  }
}
