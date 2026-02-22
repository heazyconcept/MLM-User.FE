import { Component, inject, signal, computed, ChangeDetectionStrategy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { DialogModule } from 'primeng/dialog';
import { ButtonModule } from 'primeng/button';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { NotificationService, Notification, NotificationCategory } from '../../../services/notification.service';

const CATEGORY_TABS: { value: '' | NotificationCategory; label: string }[] = [
  { value: '', label: 'All' },
  { value: 'earnings', label: 'Earnings' },
  { value: 'wallet', label: 'Wallet' },
  { value: 'orders', label: 'Orders' },
  { value: 'network', label: 'Network' },
  { value: 'system', label: 'System' }
];

const READ_FILTER_TABS: { value: 'all' | 'unread' | 'read'; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'unread', label: 'Unread' },
  { value: 'read', label: 'Read' }
];

@Component({
  selector: 'app-notifications-list',
  standalone: true,
  imports: [CommonModule, RouterLink, DialogModule, ButtonModule, ProgressSpinnerModule],
  templateUrl: './notifications-list.component.html',
  styleUrl: './notifications-list.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class NotificationsListComponent implements OnInit {
  private notificationService = inject(NotificationService);

  activeTab = signal<'' | NotificationCategory>('');
  readFilterTab = signal<'all' | 'unread' | 'read'>('all');
  categoryTabs = CATEGORY_TABS;
  readFilterTabs = READ_FILTER_TABS;
  selectedNotification = signal<Notification | null>(null);

  notifications = signal<Notification[]>([]);
  unreadCount = computed(() => this.notificationService.unreadCount());
  loading = signal<boolean>(false);
  error = signal<string | null>(null);

  filteredNotifications = computed(() => {
    const list = this.notifications();
    const tab = this.activeTab();
    if (!tab) return list;
    return list.filter(n => (n.category ?? 'system') === tab);
  });

  ngOnInit(): void {
    this.load();
    this.notificationService.loadUnreadCount().subscribe();
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    const readFilter = this.readFilterTab();
    const isRead = readFilter === 'all' ? undefined : readFilter === 'read';
    this.notificationService.loadNotifications({ isRead, limit: 50 }).subscribe({
      next: (data) => {
        this.notifications.set(data);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(err instanceof Error ? err.message : String(err));
        this.loading.set(false);
      }
    });
  }

  setTab(value: '' | NotificationCategory): void {
    this.activeTab.set(value);
  }

  setReadFilter(value: 'all' | 'unread' | 'read'): void {
    this.readFilterTab.set(value);
    this.load();
  }

  markAllAsRead(): void {
    this.notificationService.markAllAsRead();
    this.load();
  }

  openNotification(notification: Notification): void {
    this.notificationService.markAsRead(notification.id);
    this.selectedNotification.set(notification);
    this.load();
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
