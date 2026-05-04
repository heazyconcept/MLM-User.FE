import { Injectable, inject, signal, computed, OnDestroy } from '@angular/core';
import { io, Socket } from 'socket.io-client';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';
import { ModalService, ModalType } from './modal.service';
import { NotificationService } from './notification.service';
import { ApiService } from './api.service';
import {
  NotificationWirePayload,
  NotificationListResponse,
  BackendNotificationCategory,
  ApiNotificationItem,
  notificationTypeToUiType,
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
  private api = inject(ApiService);

  private socket: Socket | null = null;
  private notificationQueue: Array<{ type: ModalType; title: string; message: string }> = [];
  private isShowingModal = false;
  private initialized = false;

  /** Tracks IDs of notifications displayed as modals so we can mark them read. */
  private displayedNotificationIds: string[] = [];

  readonly connectionStatus = signal<ConnectionStatus>('disconnected');
  readonly isConnected = computed(() => this.connectionStatus() === 'connected');

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
    this.fetchAndDisplayCatchUp(token);

    // Phase B: WebSocket live feed
    this.connectWebSocket(token);
  }

  // ─── Phase A: REST Catch-Up ──────────────────────────────────────────

  private fetchAndDisplayCatchUp(_token: string): void {
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

          // Show up to MAX_CATCHUP_MODALS as modal popups
          const toShow = items.slice(0, MAX_CATCHUP_MODALS);
          const ids = items.map((n) => n.id);
          this.displayedNotificationIds.push(...ids);

          toShow.forEach((notif) => {
            const uiType = notificationTypeToUiType(notif.type);
            const modalType = this.uiTypeToModalType(uiType);
            const title = notif.title ?? notif.type.replace(/_/g, ' ');
            const message = notif.message ?? notif.body ?? '';
            this.enqueueNotification(modalType, title, message);
          });

          // Mark all as read
          this.markNotificationsAsRead(ids);

          // Refresh the unread count in the header badge
          this.notificationService.loadUnreadCount().subscribe();
        },
        error: (err) => {
          console.error('[RealTime] Failed to fetch catch-up notifications:', err);
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

    this.enqueueNotification(modalType, payload.title, payload.message);

    // Mark as read immediately (single notification)
    this.markNotificationsAsRead([payload.id]);

    // Refresh unread count + list for the header badge / drawer
    this.notificationService.loadUnreadCount().subscribe();
  }

  // ─── Notification Queue (Modal) ──────────────────────────────────────

  private enqueueNotification(type: ModalType, title: string, message: string): void {
    this.notificationQueue.push({ type, title, message });
    this.showNextIfIdle();
  }

  private showNextIfIdle(): void {
    if (this.isShowingModal || this.notificationQueue.length === 0) return;

    const next = this.notificationQueue.shift()!;
    this.isShowingModal = true;

    this.modalService.openWithCallback(next.type, next.title, next.message, () => {
      this.isShowingModal = false;
      this.showNextIfIdle();
    });
  }

  // ─── Type Mapping Helpers ────────────────────────────────────────────

  private categoryToModalType(category: BackendNotificationCategory): ModalType {
    const map: Record<BackendNotificationCategory, ModalType> = {
      EARNING: 'success',
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
  }
}
