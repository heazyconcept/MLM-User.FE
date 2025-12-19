import { Injectable, signal, computed } from '@angular/core';

export interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  timestamp: string;
  isRead: boolean;
}

const NOTIFICATION_KEY = 'mlm_notifications';

@Injectable({
  providedIn: 'root'
})
export class NotificationService {
  private notificationsSignal = signal<Notification[]>([]);

  readonly allNotifications = computed(() => this.notificationsSignal());
  readonly unreadCount = computed(() => this.notificationsSignal().filter(n => !n.isRead).length);

  constructor() {
    this.loadNotifications();
  }

  private loadNotifications() {
    const saved = localStorage.getItem(NOTIFICATION_KEY);
    if (saved) {
      this.notificationsSignal.set(JSON.parse(saved));
    }
  }

  private saveNotifications(notifications: Notification[]) {
    localStorage.setItem(NOTIFICATION_KEY, JSON.stringify(notifications));
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
