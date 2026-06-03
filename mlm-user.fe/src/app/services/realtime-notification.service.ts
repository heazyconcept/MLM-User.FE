import { Injectable, inject, signal, computed, OnDestroy, effect } from '@angular/core';
import { io, Socket } from 'socket.io-client';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';
import { ModalService, ModalType } from './modal.service';
import { NotificationService } from './notification.service';
import { MessageService } from 'primeng/api';
import { ApiService } from './api.service';
import { forkJoin } from 'rxjs';
import {
  NotificationWirePayload,
  NotificationListResponse,
  BackendNotificationCategory,
  ApiNotificationItem,
  NotificationType,
  notificationTypeToUiType,
  NOTIFICATION_TYPE_TO_CATEGORY,
} from '../core/models/notifications';
import { RankUpgradeInfo } from './modal.service';

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
    amount?: number;
    currency?: string;
    rankInfo?: RankUpgradeInfo;
    /** Server notification IDs to mark as read when this modal is dismissed. */
    notificationIds: string[];
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

    effect(() => {
      if (this.authService.isAuthenticated()) {
        this.initialize();
        return;
      }
      if (this.initialized) {
        this.disconnect();
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

    const token = this.authService.getAccessToken();
    if (!token) {
      console.warn('[RealTime] No auth token — skipping notification init');
      return;
    }
    this.initialized = true;

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
    // Combine two API queries:
    // 1. Fetch up to 50 unread notifications to guarantee we don't miss older unread notifications
    // 2. Fetch the latest 50 notifications (both read and unread) to catch recently read ones
    forkJoin({
      unread: this.api.get<NotificationListResponse | ApiNotificationItem[]>('notifications', {
        isRead: false,
        status: 'unread',
        limit: 50,
        offset: 0,
      }),
      recent: this.api.get<NotificationListResponse | ApiNotificationItem[]>('notifications', {
        limit: 50,
        offset: 0,
      }),
    }).subscribe({
      next: ({ unread, recent }) => {
        const unreadItems = this.getNotificationItems(unread);
        const recentItems = this.getNotificationItems(recent);

        // Merge lists avoiding duplicates
        const itemsMap = new Map<string, ApiNotificationItem>();
        unreadItems.forEach((item) => itemsMap.set(item.id, item));
        recentItems.forEach((item) => itemsMap.set(item.id, item));

        // Sort items by createdAt descending (newest first)
        const items = Array.from(itemsMap.values()).sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );

        if (items.length === 0) return;

        const suppressed = items.filter(
          (notif) =>
            !this.displayedNotificationIds.includes(notif.id) &&
            (this.shouldSuppressNotification(notif) || this.isNotificationDismissed(notif.id))
        );
        const unseen = items.filter(
          (notif) =>
            !this.displayedNotificationIds.includes(notif.id) &&
            !this.isNotificationDismissed(notif.id) &&
            !this.shouldSuppressNotification(notif)
        );
        if (suppressed.length > 0) {
          const suppressedIds = suppressed.map((notif) => notif.id);
          this.displayedNotificationIds.push(...suppressedIds);
          const unreadSuppressedIds = suppressed
            .filter((notif) => !notif.isRead)
            .map((notif) => notif.id);
          if (unreadSuppressedIds.length > 0) {
            this.markNotificationsAsRead(unreadSuppressedIds);
          }
        }
        if (unseen.length === 0) {
          this.notificationService.loadUnreadCount().subscribe();
          return;
        }

        // Show up to MAX_CATCHUP_MODALS as modal popups
        const toShow = unseen.slice(0, MAX_CATCHUP_MODALS);
        const silentIds = unseen.slice(MAX_CATCHUP_MODALS).map((n) => n.id);
        const ids = unseen.map((n) => n.id);
        this.displayedNotificationIds.push(...ids);

        console.log(`[RealTime] Enqueuing ${toShow.length} catch-up notification(s)`);
        toShow.forEach((notif) => {
          const uiType = this.getUiType(notif);
          const isEarnings = this.isEarningsNotification(notif);
          const isRankUpgrade = this.isRankUpgradeNotification(notif);
          const isCpvMilestone = this.isCpvMilestoneNotification(notif);
          const modalType: ModalType = isRankUpgrade
            ? 'rank-upgrade'
            : isCpvMilestone
              ? 'cpv-milestone'
              : isEarnings
                ? 'celebration'
                : this.uiTypeToModalType(uiType);
          const carriesAmount = (isEarnings && !isRankUpgrade) || isCpvMilestone;
          const title = notif.title ?? notif.type.replace(/_/g, ' ');
          const message = this.getNotificationMessage(notif);
          const action = isRankUpgrade
            ? this.getRankUpgradeAction(notif.actionUrl, notif.actionLabel)
            : isCpvMilestone
              ? this.getCpvMilestoneAction(notif.actionUrl, notif.actionLabel)
              : isEarnings
                ? this.getEarningsAction(notif.actionUrl, notif.actionLabel)
                : undefined;
          const amount = carriesAmount
            ? notif.amount ?? this.getMetadataNumber(notif.metadata, 'amount')
            : undefined;
          const currency = carriesAmount
            ? notif.currency ?? this.getMetadataString(notif.metadata, 'currency')
            : undefined;
          const rankInfo = isRankUpgrade ? this.extractRankInfo(notif.metadata) : undefined;
          this.enqueueNotification(modalType, title, message, [notif.id], action, amount, currency, rankInfo);
        });

        // Safety-net retry: if a blocking modal (e.g. login success) was still
        // closing when the queue was populated, the initial showNextIfIdle() call
        // would have bailed. Retry shortly after to pick up the queued items.
        if (this.notificationQueue.length > 0) {
          setTimeout(() => this.showNextIfIdle(), 1500);
        }

        // Mark only the ones exceeding MAX_CATCHUP_MODALS as read immediately if they are unread
        const unreadSilentIds = unseen
          .slice(MAX_CATCHUP_MODALS)
          .filter((notif) => !notif.isRead)
          .map((n) => n.id);
        if (unreadSilentIds.length > 0) {
          this.markNotificationsAsRead(unreadSilentIds);
        }

        // Refresh the unread count in the header badge
        this.notificationService.loadUnreadCount().subscribe();
      },
      error: (err) => {
        console.error('[RealTime] Failed to fetch catch-up notifications:', err);
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
        isRead: false,
        status: 'unread',
        limit: 50,
        offset: 0,
      })
      .subscribe({
        next: (raw) => {
          const items = this.getNotificationItems(raw);

          const suppressed = items.filter(
            (notif) =>
              !this.displayedNotificationIds.includes(notif.id) &&
              this.shouldSuppressNotification(notif)
          );
          const unseen = items.filter(
            (notif) =>
              !this.displayedNotificationIds.includes(notif.id) &&
              !this.shouldSuppressNotification(notif)
          );
          if (suppressed.length > 0) {
            const suppressedIds = suppressed.map((notif) => notif.id);
            this.displayedNotificationIds.push(...suppressedIds);
            this.markNotificationsAsRead(suppressedIds);
          }
          if (unseen.length === 0) {
            this.notificationService.loadUnreadCount().subscribe();
            return;
          }

          unseen.slice(0, MAX_CATCHUP_MODALS).forEach((notif) => {
            this.messageService.add({
              severity: this.getUiType(notif),
              summary: notif.title ?? notif.type.replace(/_/g, ' '),
              detail: this.getNotificationMessage(notif),
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
    ids.forEach((id) => {
      this.api.put(`notifications/${id}/read`, {}).subscribe({
        error: (err) => console.error('[RealTime] Failed to mark as read:', err),
      });
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
    if (this.shouldSuppressNotification(payload)) {
      this.markNotificationsAsRead([payload.id]);
      this.notificationService.loadUnreadCount().subscribe();
      return;
    }

    // Determine modal type from the notification category/type
    const isRankUpgrade = this.isRankUpgradeNotification(payload);
    const isCpvMilestone = this.isCpvMilestoneNotification(payload);
    const baseModalType = this.categoryToModalType(payload.category, payload);
    const modalType: ModalType = isRankUpgrade
      ? 'rank-upgrade'
      : isCpvMilestone
        ? 'cpv-milestone'
        : baseModalType;
    const isCelebration = modalType === 'celebration';
    const carriesAmount = isCelebration || isCpvMilestone;
    const action = isRankUpgrade
      ? this.getRankUpgradeAction(
          this.getMetadataString(payload.metadata, 'actionUrl'),
          this.getMetadataString(payload.metadata, 'actionLabel')
        )
      : isCpvMilestone
        ? this.getCpvMilestoneAction(
            this.getMetadataString(payload.metadata, 'actionUrl'),
            this.getMetadataString(payload.metadata, 'actionLabel')
          )
        : isCelebration
          ? this.getEarningsAction(
              this.getMetadataString(payload.metadata, 'actionUrl'),
              this.getMetadataString(payload.metadata, 'actionLabel')
            )
          : undefined;
    const amount = carriesAmount
      ? payload.amount ?? this.getMetadataNumber(payload.metadata, 'amount')
      : undefined;
    const currency = carriesAmount
      ? payload.currency ?? this.getMetadataString(payload.metadata, 'currency')
      : undefined;
    const rankInfo = isRankUpgrade ? this.extractRankInfo(payload.metadata) : undefined;

    this.enqueueNotification(
      modalType,
      payload.title,
      this.getNotificationMessage(payload),
      [payload.id],
      action,
      amount,
      currency,
      rankInfo
    );

    // Refresh unread count + list for the header badge / drawer
    this.notificationService.loadUnreadCount().subscribe();
  }

  // ─── Notification Queue (Modal) ──────────────────────────────────────

  private enqueueNotification(
    type: ModalType,
    title: string,
    message: string,
    notificationIds: string[],
    action?: { redirectTo?: string; actionLabel?: string },
    amount?: number,
    currency?: string,
    rankInfo?: RankUpgradeInfo
  ): void {
    this.notificationQueue.push({
      type,
      title,
      message,
      notificationIds,
      ...action,
      amount,
      currency,
      rankInfo,
    });
    this.showNextIfIdle();
  }

  private showNextIfIdle(): void {
    if (this.isShowingModal || this.notificationQueue.length === 0) {
      if (this.notificationQueue.length > 0) {
        console.log('[RealTime] showNextIfIdle: waiting (isShowingModal=true)');
      }
      return;
    }

    // Wait if the global modal service is already displaying a modal
    if (this.modalService.modalState().isOpen) {
      console.log('[RealTime] showNextIfIdle: blocked by open modal, will retry when it closes');
      return;
    }

    const next = this.notificationQueue.shift()!;
    this.isShowingModal = true;
    console.log(`[RealTime] Showing notification modal: "${next.title}" (queue remaining: ${this.notificationQueue.length})`);

    this.modalService.openWithCallback(
      next.type,
      next.title,
      next.message,
      () => {
        this.isShowingModal = false;
        if (next.notificationIds && next.notificationIds.length > 0) {
          console.log(`[RealTime] Modal dismissed, marking read for IDs:`, next.notificationIds);
          this.markNotificationsAsRead(next.notificationIds);
          next.notificationIds.forEach((id) => this.saveDismissedNotificationId(id));
        }
        this.showNextIfIdle();
      },
      next.redirectTo,
      next.actionLabel,
      undefined,
      next.amount,
      next.currency,
      next.rankInfo
    );
  }

  // ─── Type Mapping Helpers ────────────────────────────────────────────

  private getNotificationItems(
    raw: NotificationListResponse | ApiNotificationItem[] | { items?: ApiNotificationItem[]; notifications?: ApiNotificationItem[] } | null | undefined
  ): ApiNotificationItem[] {
    if (Array.isArray(raw)) return raw;
    const response = raw as
      | { notifications?: ApiNotificationItem[]; items?: ApiNotificationItem[] }
      | null
      | undefined;
    return response?.notifications ?? response?.items ?? [];
  }

  private categoryToModalType(
    category: BackendNotificationCategory | string | undefined,
    notification?: Pick<ApiNotificationItem, 'type' | 'title' | 'message' | 'body'>
  ): ModalType {
    if (notification && this.isEarningsNotification(notification)) return 'celebration';

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
    return map[category as BackendNotificationCategory] ?? 'info';
  }

  private uiTypeToModalType(uiType: 'info' | 'success' | 'warning' | 'error'): ModalType {
    return uiType;
  }

  private getUiType(
    notification: Pick<ApiNotificationItem, 'type' | 'title' | 'message' | 'body'>
  ): 'info' | 'success' | 'warning' | 'error' {
    const type = notification.type as NotificationType;
    if (this.isEarningsNotification(notification)) return 'success';
    return notificationTypeToUiType(type);
  }

  private isEarningsNotification(
    notification: Pick<ApiNotificationItem, 'type' | 'title' | 'message' | 'body'>
  ): boolean {
    const text = this.notificationSearchText(notification);
    const type = String(notification.type ?? '').toUpperCase();
    return (
      NOTIFICATION_TYPE_TO_CATEGORY[type as NotificationType] === 'earnings' ||
      text.includes('EARNING') ||
      text.includes('BONUS') ||
      text.includes('COMMISSION') ||
      text.includes('RANK UPGRADED') ||
      text.includes('RANK_UPGRADED') ||
      text.includes('CPV')
    );
  }

  private isRankUpgradeNotification(
    notification: Pick<ApiNotificationItem, 'type' | 'title' | 'message' | 'body'>
  ): boolean {
    const text = this.notificationSearchText(notification);
    return text.includes('RANK_UPGRADED') || text.includes('RANK UPGRADED');
  }

  private isCpvMilestoneNotification(
    notification: Pick<ApiNotificationItem, 'type' | 'title' | 'message' | 'body'>
  ): boolean {
    const text = this.notificationSearchText(notification);
    return text.includes('CPV_MILESTONE_REACHED') || text.includes('CPV MILESTONE');
  }

  private notificationSearchText(
    notification: Pick<ApiNotificationItem, 'type' | 'title' | 'message' | 'body'>
  ): string {
    return [
      notification.type,
      notification.title,
      notification.message,
      notification.body,
    ]
      .filter((value): value is string => typeof value === 'string')
      .join(' ')
      .replace(/_/g, ' ')
      .toUpperCase();
  }

  private shouldSuppressNotification(
    notification: Pick<ApiNotificationItem, 'type'>
  ): boolean {
    return notification.type === 'PAYMENT_INITIATED';
  }

  private getNotificationMessage(
    notification: Pick<ApiNotificationItem, 'type' | 'message' | 'body'>
  ): string {
    if (notification.type === 'REGISTRATION_ACTIVATED') {
      return 'Your account has been activated please proceed to your dashboard';
    }
    return notification.message ?? notification.body ?? '';
  }

  private getEarningsAction(actionUrl?: string, actionLabel?: string) {
    return {
      redirectTo: actionUrl ?? '/commissions',
      actionLabel: actionLabel ?? 'View details',
    };
  }

  private getRankUpgradeAction(actionUrl?: string, actionLabel?: string) {
    return {
      redirectTo: actionUrl ?? '/profile',
      actionLabel: actionLabel ?? 'View Rank Details',
    };
  }

  private getCpvMilestoneAction(actionUrl?: string, actionLabel?: string) {
    return {
      redirectTo: actionUrl ?? '/commissions',
      actionLabel: actionLabel ?? 'View Earnings',
    };
  }

  /** Pull rank-upgrade fields from notification metadata, accepting a few common key shapes. */
  private extractRankInfo(metadata: Record<string, unknown> | undefined): RankUpgradeInfo {
    return {
      previousRank:
        this.getMetadataString(metadata, 'previousRank') ??
        this.getMetadataString(metadata, 'oldRank') ??
        this.getMetadataString(metadata, 'fromRank'),
      previousRankSubtitle:
        this.getMetadataString(metadata, 'previousRankSubtitle') ??
        this.getMetadataString(metadata, 'oldRankSubtitle') ??
        this.getMetadataString(metadata, 'fromRankSubtitle'),
      newRank:
        this.getMetadataString(metadata, 'newRank') ??
        this.getMetadataString(metadata, 'currentRank') ??
        this.getMetadataString(metadata, 'toRank') ??
        this.getMetadataString(metadata, 'rank'),
      newRankSubtitle:
        this.getMetadataString(metadata, 'newRankSubtitle') ??
        this.getMetadataString(metadata, 'currentRankSubtitle') ??
        this.getMetadataString(metadata, 'toRankSubtitle') ??
        this.getMetadataString(metadata, 'rankSubtitle'),
      unlockedLabel:
        this.getMetadataString(metadata, 'unlockedLabel') ??
        this.getMetadataString(metadata, 'unlocked'),
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

  private getMetadataNumber(
    metadata: Record<string, unknown> | undefined,
    key: string
  ): number | undefined {
    if (!metadata) return undefined;
    const value = metadata[key];
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string' && value.trim().length > 0) {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : undefined;
    }
    return undefined;
  }

  private isNotificationDismissed(id: string): boolean {
    try {
      const stored = localStorage.getItem('dismissed_notification_modals');
      const dismissedIds: string[] = stored ? JSON.parse(stored) : [];
      return dismissedIds.includes(id);
    } catch {
      return false;
    }
  }

  private saveDismissedNotificationId(id: string): void {
    try {
      const stored = localStorage.getItem('dismissed_notification_modals');
      const dismissedIds: string[] = stored ? JSON.parse(stored) : [];
      if (!dismissedIds.includes(id)) {
        dismissedIds.push(id);
        if (dismissedIds.length > 200) {
          dismissedIds.shift();
        }
        localStorage.setItem('dismissed_notification_modals', JSON.stringify(dismissedIds));
      }
    } catch (e) {
      console.error('[RealTime] Failed to save dismissed notification ID:', e);
    }
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
