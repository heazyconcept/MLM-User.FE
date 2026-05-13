import { Injectable, inject, signal, computed, OnDestroy, effect } from '@angular/core';
import { io, Socket } from 'socket.io-client';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';
import { ModalService, ModalType } from './modal.service';
import { NotificationService } from './notification.service';
import { MessageService } from 'primeng/api';
import { ApiService } from './api.service';
import {
  NotificationWirePayload,
  NotificationListResponse,
  BackendNotificationCategory,
  ApiNotificationItem,
  NotificationType,
  notificationTypeToUiType,
  NOTIFICATION_TYPE_TO_CATEGORY,
} from '../core/models/notifications';

/** Max number of catch-up notifications to show as modals (rest go silently to list). */
const MAX_CATCHUP_MODALS = 3;

/** Reconnection config */
const RECONNECT_DELAY = 3000;
const RECONNECT_ATTEMPTS = 5;

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'reconnecting';

@Injectable({ providedIn: 'root' })
export class RealTimeNotificationService {
  private authService = inject(AuthService);
  private modalService = inject(ModalService);
  private notificationService = inject(NotificationService);
  private messageService = inject(MessageService);
  private api = inject(ApiService);

  private socket: Socket | null = null;
  private notificationQueue: Array<{
    type: ModalType;
    title: string;
    message: string;
    redirectTo?: string;
    actionLabel?: string;
  }> = [];
  private isShowingModal = false;
  private initialized = false;

  /** Tracks IDs of notifications displayed as modals so we can mark them read. */
  private displayedNotificationIds: string[] = [];

  readonly connectionStatus = signal<ConnectionStatus>('disconnected');
  readonly isConnected = computed(() => this.connectionStatus() === 'connected');

  private pollingIntervalId?: any;

  constructor() {
    effect(() => {
      const isOpen = this.modalService.modalState().isOpen;
      if (!isOpen && !this.isShowingModal) {
        setTimeout(() => this.showNextIfIdle(), 100);
      }
    });
  }

  /**
   * Initialize the real-time notification system.
   * 1) REST catch-up: fetch unread notifications and display up to MAX_CATCHUP_MODALS.
   * 2) WebSocket: connect to Socket.io /notifications namespace.
   */
  initialize(): void {
    if (this.initialized) return;
    this.initialized = true;

    const token = this.authService.getAccessToken();
    if (!token) {
      console.warn('[RealTime] No auth token — skipping notification init');
      return;
    }

    // Phase A: REST catch-up
    this.syncUnreadNotifications(token);

    // Phase B: WebSocket live feed
    this.connectWebSocket(token);

    // Phase C: Fallback Polling (Safety net if WebSockets are failing/delayed)
    this.startFallbackPolling(token);
  }

  private startFallbackPolling(token: string): void {
    if (this.pollingIntervalId) {
      clearInterval(this.pollingIntervalId);
    }
    // Poll every 15 seconds as a reliable backup to WebSockets
    this.pollingIntervalId = setInterval(() => {
      // Only poll if we're not currently showing a modal, to avoid overlapping checks
      if (!this.isShowingModal && !this.modalService.modalState().isOpen) {
        this.syncUnreadNotifications(token);
      }
    }, 15000);
  }

  // ─── Phase A: REST Catch-Up ──────────────────────────────────────────

  /**
   * Pull unread notifications and display any unseen ones as modal popups.
   * Safe to call after actions that should surface a new server-generated notification immediately.
   */
  syncUnreadNotifications(_token?: string): void {
    this.api
      .get<NotificationListResponse | ApiNotificationItem[]>('notifications', {
        status: 'unread',
        limit: 50,
        offset: 0,
      })
      .subscribe({
        next: (raw) => {
          const items: ApiNotificationItem[] = Array.isArray(raw)
            ? raw
            : raw?.notifications ?? [];

          if (items.length === 0) return;

          const unseen = items.filter((notif) => !this.displayedNotificationIds.includes(notif.id));
          if (unseen.length === 0) {
            this.notificationService.loadUnreadCount().subscribe();
            return;
          }

          // Show up to MAX_CATCHUP_MODALS as modal popups
          const toShow = unseen.slice(0, MAX_CATCHUP_MODALS);
          const ids = unseen.map((n) => n.id);
          this.displayedNotificationIds.push(...ids);

          toShow.forEach((notif) => {
            const uiType = notificationTypeToUiType(notif.type);
            const isEarnings = this.isEarningsNotification(notif.type);
            const modalType = isEarnings ? 'celebration' : this.uiTypeToModalType(uiType);
            const title = notif.title ?? notif.type.replace(/_/g, ' ');
            const message = notif.message ?? notif.body ?? '';
            const action = isEarnings
              ? this.getEarningsAction(notif.actionUrl, notif.actionLabel)
              : undefined;
            this.enqueueNotification(modalType, title, message, action);
          });

          // Mark all as read
          this.markNotificationsAsRead(ids);

          // Refresh the unread count in the header badge
          this.notificationService.loadUnreadCount().subscribe();
        },
        error: (err) => {
          console.error('[RealTime] Failed to fetch unread notifications:', err);
        },
      });
  }

  /**
   * Pull unread notifications and surface any unseen ones as toast popups.
   * Useful after an action that should generate a server notification immediately.
   */
  refreshUnreadToasts(): void {
    this.api
      .get<NotificationListResponse | ApiNotificationItem[]>('notifications', {
        status: 'unread',
        limit: 50,
        offset: 0,
      })
      .subscribe({
        next: (raw) => {
          const items: ApiNotificationItem[] = Array.isArray(raw)
            ? raw
            : raw?.notifications ?? [];

          const unseen = items.filter((notif) => !this.displayedNotificationIds.includes(notif.id));
          if (unseen.length === 0) {
            this.notificationService.loadUnreadCount().subscribe();
            return;
          }

          unseen.slice(0, MAX_CATCHUP_MODALS).forEach((notif) => {
            this.messageService.add({
              severity: notificationTypeToUiType(notif.type),
              summary: notif.title ?? notif.type.replace(/_/g, ' '),
              detail: notif.message ?? notif.body ?? '',
            });
          });

          const ids = unseen.map((n) => n.id);
          this.displayedNotificationIds.push(...ids);
          this.markNotificationsAsRead(ids);
          this.notificationService.loadUnreadCount().subscribe();
        },
        error: (err) => {
          console.error('[RealTime] Failed to refresh unread toast notifications:', err);
        },
      });
  }

  private markNotificationsAsRead(ids: string[]): void {
    if (ids.length === 0) return;
    this.api.put('notifications/mark-read', { notificationIds: ids }).subscribe({
      next: (res: any) =>
        console.log(`[RealTime] Marked ${res?.count ?? ids.length} notifications as read`),
      error: (err) => console.error('[RealTime] Failed to mark as read:', err),
    });
  }

  // ─── Phase B: WebSocket Live Feed ────────────────────────────────────

  private connectWebSocket(token: string): void {
    if (this.socket?.connected) {
      console.warn('[RealTime] WebSocket already connected');
      return;
    }

    const wsUrl = environment.wsUrl ?? environment.apiUrl;

    this.connectionStatus.set('connecting');

    this.socket = io(`${wsUrl}/notifications`, {
      auth: { token },
      reconnection: true,
      reconnectionDelay: RECONNECT_DELAY,
      reconnectionAttempts: RECONNECT_ATTEMPTS,
      transports: ['websocket', 'polling'],
    });

    this.setupSocketListeners();
  }

  private setupSocketListeners(): void {
    if (!this.socket) return;

    this.socket.on('connect', () => {
      console.log('[RealTime] WebSocket connected to /notifications');
      this.connectionStatus.set('connected');
    });

    this.socket.on('ReceiveNotification', (payload: NotificationWirePayload) => {
      console.log('[RealTime] Received notification:', payload);
      this.handleLiveNotification(payload);
    });

    this.socket.on('disconnect', (reason: string) => {
      console.warn('[RealTime] WebSocket disconnected:', reason);
      this.connectionStatus.set('disconnected');
    });

    this.socket.io.on('reconnect_attempt', (attempt: number) => {
      console.log(`[RealTime] Reconnection attempt ${attempt}`);
      this.connectionStatus.set('reconnecting');
    });

    this.socket.io.on('reconnect', () => {
      console.log('[RealTime] Reconnected');
      this.connectionStatus.set('connected');
    });

    this.socket.io.on('reconnect_failed', () => {
      console.error('[RealTime] Reconnection failed after max attempts');
      this.connectionStatus.set('disconnected');
    });

    this.socket.on('connect_error', (error: Error) => {
      console.error('[RealTime] Connection error:', error.message);
    });
  }

  private handleLiveNotification(payload: NotificationWirePayload): void {
    // Determine modal type from the notification category/type
    const modalType = this.categoryToModalType(payload.category);
    const action = modalType === 'celebration'
      ? this.getEarningsAction(
          this.getMetadataString(payload.metadata, 'actionUrl'),
          this.getMetadataString(payload.metadata, 'actionLabel')
        )
      : undefined;

    this.enqueueNotification(modalType, payload.title, payload.message, action);

    // Mark as read immediately (single notification)
    this.markNotificationsAsRead([payload.id]);

    // Refresh unread count + list for the header badge / drawer
    this.notificationService.loadUnreadCount().subscribe();
  }

  // ─── Notification Queue (Modal) ──────────────────────────────────────

  private enqueueNotification(
    type: ModalType,
    title: string,
    message: string,
    action?: { redirectTo?: string; actionLabel?: string }
  ): void {
    this.notificationQueue.push({ type, title, message, ...action });
    this.showNextIfIdle();
  }

  private showNextIfIdle(): void {
    if (this.isShowingModal || this.notificationQueue.length === 0) return;

    // Wait if the global modal service is already displaying a modal
    if (this.modalService.modalState().isOpen) return;

    const next = this.notificationQueue.shift()!;
    this.isShowingModal = true;

    this.modalService.openWithCallback(
      next.type,
      next.title,
      next.message,
      () => {
        this.isShowingModal = false;
        this.showNextIfIdle();
      },
      next.redirectTo,
      next.actionLabel
    );
  }

  // ─── Type Mapping Helpers ────────────────────────────────────────────

  private categoryToModalType(category: BackendNotificationCategory): ModalType {
    const map: Record<BackendNotificationCategory, ModalType> = {
      EARNING: 'celebration',
      WALLET: 'info',
      PAYMENT: 'info',
      ORDER: 'info',
      WITHDRAWAL: 'info',
      MERCHANT: 'info',
      ACCOUNT: 'warning',
      SYSTEM: 'warning',
    };
    return map[category] ?? 'info';
  }

  private uiTypeToModalType(uiType: 'info' | 'success' | 'warning' | 'error'): ModalType {
    return uiType;
  }

  private isEarningsNotification(type: NotificationType): boolean {
    return NOTIFICATION_TYPE_TO_CATEGORY[type] === 'earnings';
  }

  private getEarningsAction(actionUrl?: string, actionLabel?: string) {
    return {
      redirectTo: actionUrl ?? '/commissions',
      actionLabel: actionLabel ?? 'View details',
    };
  }

  private getMetadataString(
    metadata: Record<string, unknown> | undefined,
    key: string
  ): string | undefined {
    if (!metadata) return undefined;
    const value = metadata[key];
    return typeof value === 'string' && value.trim().length > 0 ? value : undefined;
  }

  // ─── Cleanup ─────────────────────────────────────────────────────────

  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    this.connectionStatus.set('disconnected');
    this.notificationQueue = [];
    this.isShowingModal = false;
    this.initialized = false;
    if (this.pollingIntervalId) {
      clearInterval(this.pollingIntervalId);
      this.pollingIntervalId = undefined;
    }
  }
}
