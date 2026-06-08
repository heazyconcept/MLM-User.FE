# Frontend Integration: Real-Time Notifications

Date: May 4, 2026
Source: docs/Febugs/REALTIME_NOTIFICATIONS_PLAN.md

## Overview

This document describes how the frontend should integrate a real-time notification system using a hybrid approach:
1. **REST Catch-Up**: Fetch unread notifications on app startup to recover missed alerts.
2. **WebSocket Live Feed**: Receive new events instantly via WebSocket as they occur.

Users get both reliability (no missed notifications) and responsiveness (instant toasts).

---

## Architecture Overview

### Phase A: Catch-Up on App Load (REST)
```
Frontend Loads
    ↓
1. Call GET /notifications?status=unread
    ↓
2. Receive array of missed notifications
    ↓
3. Display each as Toast
    ↓
4. Call PUT /notifications/mark-read with notification IDs
    ↓
5. Proceed to establish WebSocket connection
```

### Phase B: Live Feed (WebSocket)
```
WebSocket Connected
    ↓
Listen for ReceiveNotification event
    ↓
On each event, display Toast immediately
```

---

## Backend API Contracts

### REST Endpoint 1: Fetch Unread Notifications

**Request**
```http
GET /notifications?status=unread&limit=50&offset=0
Authorization: Bearer <token>
```

Query parameters:
- `status`: 'unread' or 'read' (convenience alias for `isRead` filter)
- `type`: (optional) NotificationType enum value
- `limit`: (optional, default none) max records per page
- `offset`: (optional, default 0) pagination offset

**Response** (200 OK)
```json
{
  "notifications": [
    {
      "id": "123e4567-e89b-12d3-a456-426614174000",
      "userId": "user-uuid",
      "channel": "IN_APP",
      "type": "EARNING_CREDITED",
      "category": "EARNING",
      "title": "New Earning!",
      "message": "You just earned $50.00 from your direct successline.",
      "amount": 50.00,
      "currency": "NGN",
      "metadata": { "sourceId": "ledger-123", "sourceType": "EARNINGS" },
      "isRead": false,
      "createdAt": "2026-05-04T09:30:00Z"
    },
    {
      "id": "223e4567-e89b-12d3-a456-426614174111",
      "userId": "user-uuid",
      "channel": "IN_APP",
      "type": "SYSTEM_ANNOUNCEMENT",
      "category": "SYSTEM",
      "title": "Profile Updated",
      "message": "Your profile has been successfully updated.",
      "isRead": false,
      "createdAt": "2026-05-04T09:15:00Z"
    }
  ],
  "total": 42,
  "unreadCount": 2,
  "limit": 50,
  "offset": 0
}
```

---

### REST Endpoint 2: Mark Notifications as Read

**Batch mark as read:**
```http
PUT /notifications/mark-read
Authorization: Bearer <token>
Content-Type: application/json

{
  "notificationIds": ["123e4567-e89b-12d3-a456-426614174000", "223e4567-e89b-12d3-a456-426614174111"]
}
```

**Response** (200 OK)
```json
{
  "count": 2
}
```

**Alternative: Mark single notification as read:**
```http
PUT /notifications/:id/read
Authorization: Bearer <token>
```

**Response**
```json
{
  "id": "123e4567-e89b-12d3-a456-426614174000",
  "userId": "user-uuid",
  "channel": "IN_APP",
  "type": "EARNING_CREDITED",
  "category": "EARNING",
  "title": "New Earning!",
  "message": "You just earned $50.00 from your direct successline.",
  "amount": 50.00,
  "currency": "NGN",
  "metadata": {...},
  "isRead": true,
  "createdAt": "2026-05-04T09:30:00Z"
}
```

**Additional endpoints:**
- `PUT /notifications/read-all` - Mark all user notifications as read. Returns `{ count: number }`
- `DELETE /notifications/:id` - Delete a single notification (204 No Content)

---

### WebSocket Protocol

**Technology:** Socket.io (NestJS WebSocketGateway)

**Namespace:** `/notifications`

**Connection Setup**

Frontend initiates WebSocket connection at app startup (after REST catch-up):

```ts
// Socket.io (actual implementation)
const socket = io('http://localhost:3000/notifications', {
  auth: {
    token: getToken(), // JWT bearer token
  },
  reconnection: true,
  reconnectionDelay: 3000,
  reconnectionAttempts: 5,
});
```

**Auth mechanism:**
- Backend validates JWT during Socket.io handshake via `auth.token` (preferred)
- Alternative: pass via query param `?access_token=<token>`
- Gateway extracts user ID from JWT payload (`sub` field)
- Each connection is scoped to a Socket.io room: `user:{userId}` (server-side, automatic)
- Invalid tokens result in immediate disconnection

**Event Name:** `ReceiveNotification`

**Event Payload** (matches NotificationWirePayload from backend)
```json
{
  "id": "123e4567-e89b-12d3-a456-426614174000",
  "type": "EARNING_CREDITED",
  "category": "EARNING",
  "title": "New Earning!",
  "message": "You just earned $50.00 from your direct successline.",
  "amount": 50.00,
  "currency": "NGN",
  "metadata": { "sourceId": "ledger-123" },
  "isRead": false,
  "createdAt": "2026-05-04T09:30:00Z"
}
```

**Event Listener** (pseudo-code)
```ts
socket.on('ReceiveNotification', (notification: NotificationWirePayload) => {
  this.messageService.add({
    severity: this.getSeverityFromCategory(notification.category),
    summary: notification.title,
    detail: notification.message,
    life: 5000, // auto-dismiss after 5s
  });
});
```

---

## Frontend Implementation Guide

### Step 1: Create a RealTimeConnectionService

```ts
import { Injectable } from '@angular/core';
import { MessageService } from 'primeng/api';
import { io, Socket } from 'socket.io-client';

export interface Notification {
  id: string;
  type: 'EARNING' | 'LIKE' | 'SYSTEM';
  title: string;
  message: string;
  amount?: number;
  currency?: string;
  isRead: boolean;
  createdAt: string;
}

@Injectable({ providedIn: 'root' })
export class RealTimeConnectionService {
  private socket: Socket | null = null;
  private reconnectAttempts = 0;
  private readonly maxReconnectAttempts = 5;
  private readonly reconnectDelay = 3000; // 3 seconds

  constructor(private messageService: MessageService) {}

  connect(token: string, baseUrl: string = 'http://localhost:3000'): void {
    if (this.socket?.connected) {
      console.warn('WebSocket already connected');
      return;
    }

    this.socket = io(`${baseUrl}/notifications`, {
      auth: { token },
      reconnection: true,
      reconnectionDelay: this.reconnectDelay,
      reconnectionAttempts: this.maxReconnectAttempts,
    });

    this.setupListeners();
  }

  private setupListeners(): void {
    if (!this.socket) return;

    this.socket.on('connect', () => {
      console.log('WebSocket connected to /notifications');
      this.reconnectAttempts = 0;
    });

    this.socket.on('ReceiveNotification', (payload: NotificationWirePayload) => {
      console.log('Received notification:', payload);
      this.displayToast(payload);
    });

    this.socket.on('disconnect', (reason: string) => {
      console.warn('WebSocket disconnected:', reason);
    });

    this.socket.on('error', (error: any) => {
      console.error('WebSocket error:', error);
      this.messageService.add({
        severity: 'error',
        summary: 'Connection Error',
        detail: 'Failed to connect to notifications service',
        life: 5000,
      });
    });
  }

  private displayToast(notification: NotificationWirePayload | NotificationResponseDto): void {
    const severity = this.getSeverityFromCategory(notification.category || this.getCategoryFromType(notification.type));
    this.messageService.add({
      severity,
      summary: notification.title,
      detail: notification.message,
      life: 5000,
    });
  }

  private getSeverityFromCategory(category: string): 'success' | 'info' | 'warn' | 'error' {
    const severityMap: Record<string, 'success' | 'info' | 'warn' | 'error'> = {
      EARNING: 'success',
      WALLET: 'info',
      PAYMENT: 'info',
      WITHDRAWAL: 'info',
      ORDER: 'info',
      MERCHANT: 'info',
      ACCOUNT: 'warn',
      SYSTEM: 'warn',
    };
    return severityMap[category] || 'info';
  }

  private getCategoryFromType(type: string): string {
    // Server provides category; fallback mapping if needed
    if (type.startsWith('EARNING') || type.startsWith('CPV') || type.startsWith('RANK') || type.startsWith('STAGE')) return 'EARNING';
    if (type.startsWith('WALLET')) return 'WALLET';
    if (type.startsWith('WITHDRAWAL')) return 'WITHDRAWAL';
    if (type.startsWith('PAYMENT')) return 'PAYMENT';
    if (type.startsWith('ORDER')) return 'ORDER';
    if (type.startsWith('MERCHANT')) return 'MERCHANT';
    if (type.startsWith('USER') || type.startsWith('REGISTRATION') || type.startsWith('PASSWORD') || type.startsWith('ACCOUNT')) return 'ACCOUNT';
    return 'SYSTEM';
  }

  disconnect(): void {
    if (this.socket?.connected) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  isConnected(): boolean {
    return this.socket?.connected || false;
  }
}
```

### Step 2: Create a NotificationService

```ts
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface NotificationResponse {
  status: string;
  data: Notification[];
}

@Injectable({ providedIn: 'root' })
export class NotificationService {
  private readonly apiUrl = '/notifications';

  constructor(private http: HttpClient) {}

  /**
   * Fetch unread notifications for the authenticated user
   */
  fetchUnreadNotifications(limit?: number): Observable<NotificationListResponse> {
    const params = new URLSearchParams({ status: 'unread' });
    if (limit) params.set('limit', String(limit));
    return this.http.get<NotificationListResponse>(`${this.apiUrl}?${params.toString()}`);
  }

  /**
   * Batch mark notifications as read
   */
  markAsRead(notificationIds: string[]): Observable<{ count: number }> {
    return this.http.put<any>(`${this.apiUrl}/mark-read`, { notificationIds });
  }

  /**
   * Mark all user notifications as read
   */
  markAllAsRead(): Observable<{ count: number }> {
    return this.http.put<any>(`${this.apiUrl}/read-all`, {});
  }

  /**
   * Get unread notification count
   */
  getUnreadCount(): Observable<{ count: number }> {
    return this.http.get<{ count: number }>(`${this.apiUrl}/unread-count`);
  }
}
```

### Step 3: Bootstrap in Dashboard/App Layout

```ts
import { Component, OnInit, OnDestroy } from '@angular/core';
import { AuthService } from '../auth/auth.service';
import { NotificationService, Notification } from '../notifications/notification.service';
import { RealTimeConnectionService } from '../notifications/real-time-connection.service';

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.component.html',
})
export class DashboardComponent implements OnInit, OnDestroy {
  constructor(
    private authService: AuthService,
    private notificationService: NotificationService,
    private realtimeService: RealTimeConnectionService,
  ) {}

  ngOnInit(): void {
    this.initializeNotifications();
  }

  private initializeNotifications(): void {
    const token = this.authService.getToken();
    if (!token) return;

    // Phase A: Catch-Up (limit to 50 recent missed notifications)
    this.notificationService.fetchUnreadNotifications(50).subscribe({
      next: (response) => {
        if (response.notifications && response.notifications.length > 0) {
          // Display all missed notifications
          response.notifications.forEach((notif) => {
            this.realtimeService['displayToast'](notif);
          });

          // Mark them as read in batch
          const ids = response.notifications.map((n) => n.id);
          this.notificationService.markAsRead(ids).subscribe({
            next: (result) => console.log(`Marked ${result.count} notifications as read`),
            error: (err) => console.error('Failed to mark notifications as read:', err),
          });
        }
      },
      error: (err) => console.error('Failed to fetch unread notifications:', err),
    });

    // Phase B: Live Feed (establish WebSocket)
    this.realtimeService.connect(token, window.location.origin);
  }

  ngOnDestroy(): void {
    this.realtimeService.disconnect();
  }
}
```

---

## TypeScript Types

```ts
/**
 * Notification channel
 */
export type NotificationChannel = 'IN_APP' | 'EMAIL' | 'SMS' | 'PUSH';

/**
 * All possible notification types from backend
 */
export type NotificationType =
  | 'USER_REGISTERED'
  | 'REGISTRATION_ACTIVATED'
  | 'PASSWORD_CHANGED'
  | 'ACCOUNT_DISABLED'
  | 'PAYMENT_INITIATED'
  | 'PAYMENT_VERIFIED'
  | 'WALLET_CREDITED'
  | 'WALLET_LOCKED'
  | 'WALLET_UNLOCKED'
  | 'EARNING_CREDITED'
  | 'CPV_MILESTONE_REACHED'
  | 'RANK_UPGRADED'
  | 'STAGE_COMPLETED'
  | 'WITHDRAWAL_REQUESTED'
  | 'WITHDRAWAL_APPROVED'
  | 'WITHDRAWAL_REJECTED'
  | 'WITHDRAWAL_PAID'
  | 'ORDER_CREATED'
  | 'ORDER_PAID'
  | 'ORDER_COMPLETED'
  | 'ORDER_CANCELLED'
  | 'ORDER_FAILED'
  | 'ORDER_FULFILLED'
  | 'ORDER_READY_FOR_PICKUP'
  | 'ORDER_DELIVERY_REQUESTED'
  | 'MERCHANT_APPLICATION_SUBMITTED'
  | 'MERCHANT_APPROVED'
  | 'MERCHANT_REJECTED'
  | 'MERCHANT_SUSPENDED'
  | 'ORDER_ASSIGNED_TO_MERCHANT'
  | 'MERCHANT_BONUS_CREDITED'
  | 'ADMIN_ACTION_TAKEN'
  | 'SYSTEM_ANNOUNCEMENT';

/**
 * Coarse-grained notification category (derived from type) for UI purposes
 */
export type NotificationCategory = 'EARNING' | 'WALLET' | 'WITHDRAWAL' | 'PAYMENT' | 'ORDER' | 'MERCHANT' | 'ACCOUNT' | 'SYSTEM';

/**
 * Single notification response DTO
 */
export interface NotificationResponseDto {
  id: string;
  userId: string;
  channel: NotificationChannel;
  type: NotificationType;
  category?: NotificationCategory;
  title: string;
  message: string;
  amount?: number;
  currency?: string;
  metadata?: Record<string, any>;
  isRead: boolean;
  createdAt: Date;
}

/**
 * REST API response for fetching notifications (list)
 */
export interface NotificationListResponse {
  notifications: NotificationResponseDto[];
  total: number;
  unreadCount: number;
  limit: number;
  offset: number;
}

/**
 * Socket.io event payload (NotificationWirePayload)
 */
export interface NotificationWirePayload {
  id: string;
  type: NotificationType;
  category: NotificationCategory;
  title: string;
  message: string;
  amount?: number;
  currency?: string;
  metadata?: Record<string, unknown>;
  isRead: boolean;
  createdAt: string; // ISO 8601 string from server
}
```

---

## Fallback Strategy (No WebSocket)

If backend cannot provide WebSocket initially:

1. Use REST Catch-Up on app load (Phase A only)
2. Poll `GET /notifications?status=unread` every 10-30 seconds
3. Mark as read after display

**Polling implementation:**
```ts
startPolling(intervalMs: number = 20000): void {
  setInterval(() => {
    this.notificationService.fetchUnreadNotifications().subscribe({
      next: (response) => {
        if (response.data.length > 0) {
          // Display and mark read
          const ids = response.data.map((n) => n.id);
          this.realtimeService['displayToast'](response.data[0]);
          this.notificationService.markAsRead(ids).subscribe();
        }
      },
    });
  }, intervalMs);
}
```

**Caveat:** Polling has higher latency (~10-30s delay) and higher server load. Use only as temporary fallback.

---

## Frontend UI Checklist

- [ ] Toast notification appears on app load for unread alerts
- [ ] Toast auto-dismisses after 5 seconds
- [ ] Live notifications appear instantly via WebSocket
- [ ] Multiple notifications show without overlapping
- [ ] Toast severity (color) matches notification type
- [ ] Connection status displayed (optional: connection indicator in top bar)
- [ ] Graceful disconnect/reconnect handling
- [ ] No duplicate toasts on reconnect

---

## QA Scenarios

1. **User logs in after 1 hour offline:**
   - [ ] All 5+ missed notifications display as toasts
   - [ ] Each marked as read automatically
   - [ ] Next refresh does not re-show them

2. **Live notification while user is active:**
   - [ ] Toast appears within <500ms of event
   - [ ] No duplicate toasts if reconnect occurs

3. **Network loss during session:**
   - [ ] WebSocket auto-reconnects within 10 seconds
   - [ ] No error toasts shown to user (silent reconnect)
   - [ ] Any missed events caught on reconnect

4. **Multiple tabs:**
   - [ ] Each tab establishes independent WebSocket
   - [ ] Duplicate toasts in each tab (acceptable for now; dedup later with shared worker)

---

## Backend Implementation Status

✅ **Already Implemented:**
- `GET /notifications?status=unread&limit=...&offset=...` endpoint
- `PUT /notifications/mark-read` batch endpoint
- `PUT /notifications/read-all` mark-all endpoint
- `GET /notifications/unread-count` endpoint
- `DELETE /notifications/:id` delete endpoint
- WebSocket gateway (Socket.io) on namespace `/notifications`
- JWT validation on WebSocket handshake (via `auth.token` or query param)
- `ReceiveNotification` event emission with NotificationWirePayload
- Notification table in database with `isRead`, `type`, `channel`, `metadata`, `createdAt`
- User scoping via Socket.io rooms `user:{userId}`
- Database indexes on `userId`, `isRead`, `createdAt`
- Notification preferences endpoints (`GET /notifications/preferences`, `PUT /notifications/preferences`)

**Location:** `src/modules/notifications/`

---

## Related Documents

- Original plan: docs/Febugs/REALTIME_NOTIFICATIONS_PLAN.md
- Backend implementation: `src/modules/notifications/`
- Gateway (WebSocket): `src/modules/notifications/notifications.gateway.ts`
- Controller (REST): `src/modules/notifications/notifications.controller.ts`
- DTOs: `src/modules/notifications/dto/`
- Wire payload types: `src/modules/notifications/utils/notification-wire-payload.ts`

---

## Optional Future Enhancements

1. **Notification Center Sidebar**: Click bell icon to see last 20 notifications (with infinite scroll).
2. **Notification Preferences**: User can choose to receive only certain types.
3. **Shared Worker**: Deduplicate toasts across browser tabs.
4. **Cursor-based Pagination**: For notification history view.
5. **Push Notifications**: Send to device even when app is closed (via Service Worker + FCM/APNs).
