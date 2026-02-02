import { Component, inject, signal, computed, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { DialogModule } from 'primeng/dialog';
import { ButtonModule } from 'primeng/button';
import { NotificationService, Notification, NotificationCategory } from '../../../services/notification.service';

const CATEGORY_TABS: { value: '' | NotificationCategory; label: string }[] = [
  { value: '', label: 'All' },
  { value: 'earnings', label: 'Earnings' },
  { value: 'wallet', label: 'Wallet' },
  { value: 'orders', label: 'Orders' },
  { value: 'network', label: 'Network' },
  { value: 'system', label: 'System' }
];

@Component({
  selector: 'app-notifications-list',
  standalone: true,
  imports: [CommonModule, RouterLink, DialogModule, ButtonModule],
  templateUrl: './notifications-list.component.html',
  styleUrl: './notifications-list.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class NotificationsListComponent {
  private notificationService = inject(NotificationService);

  activeTab = signal<'' | NotificationCategory>('');
  categoryTabs = CATEGORY_TABS;
  selectedNotification = signal<Notification | null>(null);

  notifications = this.notificationService.allNotifications;
  unreadCount = this.notificationService.unreadCount;

  filteredNotifications = computed(() => {
    const list = this.notifications();
    const tab = this.activeTab();
    if (!tab) return list;
    return list.filter(n => (n.category ?? 'system') === tab);
  });

  setTab(value: '' | NotificationCategory): void {
    this.activeTab.set(value);
  }

  markAllAsRead(): void {
    this.notificationService.markAllAsRead();
  }

  openNotification(notification: Notification): void {
    this.notificationService.markAsRead(notification.id);
    this.selectedNotification.set(notification);
  }

  closeDetailModal(): void {
    this.selectedNotification.set(null);
  }

  getTypeBadgeClass(type: Notification['type']): string {
    const base = 'px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide';
    const colors: Record<Notification['type'], string> = {
      info: 'bg-blue-50 text-blue-600',
      success: 'bg-green-50 text-green-600',
      warning: 'bg-amber-50 text-amber-600',
      error: 'bg-red-50 text-red-600'
    };
    return `${base} ${colors[type] ?? 'bg-gray-100 text-gray-600'}`;
  }
}
