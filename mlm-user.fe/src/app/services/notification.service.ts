import { Injectable, signal, computed, inject } from '@angular/core';
import { Observable, of } from 'rxjs';
import { map, catchError, switchMap } from 'rxjs/operators';
import { ApiService } from './api.service';
import {
  ApiNotificationItem,
  NotificationCategory,
  NotificationType,
  NOTIFICATION_TYPE_TO_CATEGORY,
  notificationTypeToUiType,
  UnreadCountResponse,
  NOTIFICATION_TYPES_BY_CATEGORY,
} from '../core/models/notifications';

export type { NotificationCategory };

/** UI notification shape (used by list and header). */
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

const PREFERENCES_KEY = 'mlm_notification_preferences';

const DEFAULT_PREFERENCES: Record<NotificationCategory, boolean> = {
  earnings: true,
  wallet: true,
  orders: true,
  network: true,
  system: true,
};

export interface NotificationListParams {
  type?: NotificationType;
  isRead?: boolean;
  limit?: number;
  offset?: number;
}

export interface NotificationPreferencesApi {
  channelPreferences?: Record<string, boolean>;
  typePreferences?: Record<string, boolean>;
}

@Injectable({
  providedIn: 'root',
})
export class NotificationService {
  private api = inject(ApiService);

  private notificationsSignal = signal<Notification[]>([]);
  private unreadCountSignal = signal<number>(0);
  private preferencesSignal = signal<Record<NotificationCategory, boolean>>(DEFAULT_PREFERENCES);
  private loadingSignal = signal<boolean>(false);
  private errorSignal = signal<string | null>(null);
  private preferencesLoadedSignal = signal<boolean>(false);

  readonly allNotifications = computed(() => this.notificationsSignal());
  readonly unreadCount = computed(() => this.unreadCountSignal());
  readonly preferences = this.preferencesSignal.asReadonly();
  readonly loading = this.loadingSignal.asReadonly();
  readonly error = this.errorSignal.asReadonly();
  readonly preferencesLoaded = this.preferencesLoadedSignal.asReadonly();

  constructor() {
    this.loadPreferencesFromStorage();
  }

  private loadPreferencesFromStorage(): void {
    const saved = localStorage.getItem(PREFERENCES_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as Record<string, boolean>;
        const next: Record<NotificationCategory, boolean> = { ...DEFAULT_PREFERENCES };
        (Object.keys(next) as NotificationCategory[]).forEach((k) => {
          if (typeof parsed[k] === 'boolean') next[k] = parsed[k];
        });
        this.preferencesSignal.set(next);
      } catch {
        // keep defaults
      }
    }
  }

  private mapApiItemToNotification(item: ApiNotificationItem): Notification {
    const category = NOTIFICATION_TYPE_TO_CATEGORY[item.type];
    const message = item.message ?? item.body ?? '';
    const title = item.title ?? item.type.replace(/_/g, ' ');
    return {
      id: item.id,
      title,
      message,
      type: notificationTypeToUiType(item.type),
      timestamp: item.createdAt,
      isRead: item.isRead,
      category,
      actionUrl: item.actionUrl,
      actionLabel: item.actionLabel,
    };
  }

  /**
   * Load notifications from API. Call from list page or layout.
   */
  loadNotifications(params?: NotificationListParams): Observable<Notification[]> {
    this.loadingSignal.set(true);
    this.errorSignal.set(null);
    const limit = params?.limit ?? 20;
    const offset = params?.offset ?? 0;
    const query: Record<string, string | number | boolean> = { limit, offset };
    if (params?.type != null) query['type'] = params.type;
    if (params?.isRead != null) query['isRead'] = params.isRead;

    return this.api.get<
      ApiNotificationItem[] | { items?: ApiNotificationItem[]; notifications?: ApiNotificationItem[] }
    >('notifications', query).pipe(
      map((raw) => {
        const items = Array.isArray(raw) ? raw : (raw?.items ?? raw?.notifications ?? []);
        const list = items.map((item) => this.mapApiItemToNotification(item as ApiNotificationItem));
        this.notificationsSignal.set(list);
        this.loadingSignal.set(false);
        return list;
      }),
      catchError((err) => {
        const msg = err?.error?.message ?? (Array.isArray(err?.error?.message) ? err.error.message?.[0] : null) ?? 'Failed to load notifications.';
        this.errorSignal.set(msg);
        this.loadingSignal.set(false);
        return of([]);
      })
    );
  }

  /**
   * Load unread count from API. Call from header/layout so badge is correct.
   */
  loadUnreadCount(): Observable<number> {
    return this.api.get<UnreadCountResponse>('notifications/unread-count').pipe(
      map((res) => {
        const count = typeof res === 'number' ? res : (res && typeof (res as { count?: number }).count === 'number' ? (res as { count: number }).count : 0);
        this.unreadCountSignal.set(count);
        return count;
      }),
      catchError(() => {
        return of(0);
      })
    );
  }

  /**
   * Refresh list and unread count (e.g. when opening notifications page).
   */
  refresh(): Observable<{ list: Notification[]; count: number }> {
    return this.loadNotifications().pipe(
      switchMap((list) =>
        this.loadUnreadCount().pipe(map((count) => ({ list, count })))
      )
    );
  }

  getById(id: string): Notification | undefined {
    return this.notificationsSignal().find((n) => n.id === id);
  }

  /**
   * Mark one notification as read.
   */
  markAsRead(id: string): void {
    this.api.put(`notifications/${id}/read`, {}).subscribe({
      next: () => {
        const updated = this.notificationsSignal().map((n) =>
          n.id === id ? { ...n, isRead: true } : n
        );
        this.notificationsSignal.set(updated);
        const current = this.unreadCountSignal();
        if (current > 0) this.unreadCountSignal.set(current - 1);
      },
      error: () => {
        // optimistic: still update locally on error so UI is consistent
        const updated = this.notificationsSignal().map((n) =>
          n.id === id ? { ...n, isRead: true } : n
        );
        this.notificationsSignal.set(updated);
      },
    });
  }

  /**
   * Mark all notifications as read.
   */
  markAllAsRead(): void {
    this.api.put('notifications/read-all', {}).subscribe({
      next: () => {
        const updated = this.notificationsSignal().map((n) => ({ ...n, isRead: true }));
        this.notificationsSignal.set(updated);
        this.unreadCountSignal.set(0);
      },
      error: () => {
        const updated = this.notificationsSignal().map((n) => ({ ...n, isRead: true }));
        this.notificationsSignal.set(updated);
        this.unreadCountSignal.set(0);
      },
    });
  }

  /**
   * Clear local list and set unread to 0 (no API). Use for "clear" in header; list will refetch on next load.
   */
  clearAll(): void {
    this.notificationsSignal.set([]);
    this.unreadCountSignal.set(0);
  }

  /**
   * Get preferences from API. Falls back to localStorage if 403/404.
   */
  getPreferences(): Observable<Record<NotificationCategory, boolean>> {
    return this.api.get<NotificationPreferencesApi>('notifications/preferences').pipe(
      map((res) => {
        this.preferencesLoadedSignal.set(true);
        const typePrefs = res?.typePreferences ?? {};
        const derived: Record<NotificationCategory, boolean> = { ...DEFAULT_PREFERENCES };
        (Object.keys(derived) as NotificationCategory[]).forEach((cat) => {
          const types = NOTIFICATION_TYPES_BY_CATEGORY[cat];
          const anyOn = types.some((t) => typePrefs[t] !== false);
          derived[cat] = anyOn;
        });
        this.preferencesSignal.set(derived);
        this.savePreferencesToStorage(derived);
        return derived;
      }),
      catchError(() => {
        this.preferencesLoadedSignal.set(true);
        return of(this.preferencesSignal());
      })
    );
  }

  /**
   * Update preferences (API + local). Body uses typePreferences mapped from category toggles.
   */
  updatePreferences(prefs: Partial<Record<NotificationCategory, boolean>>): void {
    const current = this.preferencesSignal();
    const next: Record<NotificationCategory, boolean> = { ...current, ...prefs };
    this.preferencesSignal.set(next);

    const typePreferences: Record<string, boolean> = {};
    (Object.keys(NOTIFICATION_TYPES_BY_CATEGORY) as NotificationCategory[]).forEach((cat) => {
      const enabled = next[cat] ?? true;
      NOTIFICATION_TYPES_BY_CATEGORY[cat].forEach((t) => {
        typePreferences[t] = enabled;
      });
    });

    this.api.put('notifications/preferences', { typePreferences }).subscribe({
      next: () => this.savePreferencesToStorage(next),
      error: () => this.savePreferencesToStorage(next),
    });
  }

  private savePreferencesToStorage(prefs: Record<NotificationCategory, boolean>): void {
    localStorage.setItem(PREFERENCES_KEY, JSON.stringify(prefs));
  }

  /**
   * Legacy: add a local-only notification (e.g. toast). Not sent to API.
   * Kept for backward compatibility; prefer server-generated notifications.
   */
  add(notification: Omit<Notification, 'id' | 'timestamp' | 'isRead'>): void {
    const newNotification: Notification = {
      ...notification,
      id: Math.random().toString(36).substring(2, 9),
      timestamp: new Date().toISOString(),
      isRead: false,
    };
    const updated = [newNotification, ...this.notificationsSignal()];
    this.notificationsSignal.set(updated);
    this.unreadCountSignal.update((c) => c + 1);
  }
}
