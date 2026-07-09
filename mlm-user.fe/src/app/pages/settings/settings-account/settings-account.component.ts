import { Component, inject, signal, computed, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { UserService } from '../../../services/user.service';
import { MerchantService } from '../../../services/merchant.service';
import { formatMerchantUsernameLabel } from '../../../core/utils/merchant-display.util';

@Component({
  selector: 'app-settings-account',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './settings-account.component.html',
  styleUrl: './settings-account.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SettingsAccountComponent implements OnInit {
  private userService = inject(UserService);
  private merchantService = inject(MerchantService);

  firstName = signal('');
  lastName = signal('');
  savedMessage = signal<string | null>(null);

  currentUser = this.userService.currentUser;

  username = computed(() => {
    const user = this.currentUser();
    const base = user?.username || (user?.email ? user.email.split('@')[0] : '');
    if (!base) return '—';
    if (!this.merchantService.isActiveMerchant()) return base;
    return formatMerchantUsernameLabel(base, this.merchantService.profile()?.businessName) || base;
  });

  hasChanges = computed(() => {
    const user = this.currentUser();
    if (!user) return false;
    return this.firstName() !== user.firstName || this.lastName() !== user.lastName;
  });

  ngOnInit(): void {
    const user = this.currentUser();
    if (user) {
      this.firstName.set(user.firstName);
      this.lastName.set(user.lastName);
    }
  }

  save(): void {
    if (!this.hasChanges()) return;
    this.userService.updateProfile({
      firstName: this.firstName(),
      lastName: this.lastName()
    });
    this.savedMessage.set('Account updated successfully.');
    setTimeout(() => this.savedMessage.set(null), 3000);
  }
}
