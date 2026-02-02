import { Injectable, signal, computed } from '@angular/core';

export type NotificationCategory = 'earnings' | 'wallet' | 'orders' | 'network' | 'system';

export interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  timestamp: string;
  isRead: boolean;
  category?: NotificationCategory;
  actionUrl?: string;
  actionLabel?: string;
}

const NOTIFICATION_KEY = 'mlm_notifications';
const PREFERENCES_KEY = 'mlm_notification_preferences';

const DEFAULT_PREFERENCES: Record<NotificationCategory, boolean> = {
  earnings: true,
  wallet: true,
  orders: true,
  network: true,
  system: true
};

@Injectable({
  providedIn: 'root'
})
export class NotificationService {
  private notificationsSignal = signal<Notification[]>([]);
  private preferencesSignal = signal<Record<NotificationCategory, boolean>>(DEFAULT_PREFERENCES);

  readonly allNotifications = computed(() => this.notificationsSignal());
  readonly unreadCount = computed(() => this.notificationsSignal().filter(n => !n.isRead).length);
  readonly preferences = this.preferencesSignal.asReadonly();

  constructor() {
    this.loadNotifications();
    this.loadPreferences();
  }

  private loadNotifications() {
    const saved = localStorage.getItem(NOTIFICATION_KEY);
    if (saved) {
      this.notificationsSignal.set(JSON.parse(saved));
    }
  }

  private loadPreferences() {
    const saved = localStorage.getItem(PREFERENCES_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as Record<string, boolean>;
        this.preferencesSignal.set({ ...DEFAULT_PREFERENCES, ...parsed });
      } catch {
        // keep defaults
      }
    }
  }

  private saveNotifications(notifications: Notification[]) {
    localStorage.setItem(NOTIFICATION_KEY, JSON.stringify(notifications));
  }

  private savePreferences(prefs: Record<NotificationCategory, boolean>) {
    localStorage.setItem(PREFERENCES_KEY, JSON.stringify(prefs));
  }

  getById(id: string): Notification | undefined {
    return this.notificationsSignal().find(n => n.id === id);
  }

  updatePreferences(prefs: Partial<Record<NotificationCategory, boolean>>) {
    const current = this.preferencesSignal();
    const next = { ...current, ...prefs };
    this.preferencesSignal.set(next);
    this.savePreferences(next);
  }

  add(notification: Omit<Notification, 'id' | 'timestamp' | 'isRead'>) {
    const newNotification: Notification = {
      ...notification,
      id: Math.random().toString(36).substring(2, 9),
      timestamp: new Date().toISOString(),
      isRead: false
    };

    const updated = [newNotification, ...this.notificationsSignal()];
    this.notificationsSignal.set(updated);
    this.saveNotifications(updated);
  }

  markAsRead(id: string) {
    const updated = this.notificationsSignal().map(n => 
      n.id === id ? { ...n, isRead: true } : n
    );
    this.notificationsSignal.set(updated);
    this.saveNotifications(updated);
  }

  markAllAsRead() {
    const updated = this.notificationsSignal().map(n => ({ ...n, isRead: true }));
    this.notificationsSignal.set(updated);
    this.saveNotifications(updated);
  }

  clearAll() {
    this.notificationsSignal.set([]);
    this.saveNotifications([]);
  }
}
