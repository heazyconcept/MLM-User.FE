/**
 * Notification API types and mapping for UI.
 * NotificationType and channel enums match the Segulah API (API.md / OpenAPI).
 */

export type NotificationChannel = 'IN_APP' | 'EMAIL' | 'SMS' | 'PUSH';

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

/** API response shape for a single notification (OpenAPI does not define schema; adjust if backend differs). */
export interface ApiNotificationItem {
  id: string;
  type: NotificationType;
  title?: string;
  message?: string;
  body?: string;
  isRead: boolean;
  createdAt: string;
  actionUrl?: string;
  actionLabel?: string;
}

/** GET /notifications/unread-count response (number or { count: number }). */
export type UnreadCountResponse = number | { count: number };

export type NotificationCategory = 'earnings' | 'wallet' | 'orders' | 'network' | 'system';

/** Map API NotificationType to UI category for filtering. */
export const NOTIFICATION_TYPE_TO_CATEGORY: Record<NotificationType, NotificationCategory> = {
  USER_REGISTERED: 'network',
  REGISTRATION_ACTIVATED: 'wallet',
  PASSWORD_CHANGED: 'system',
  ACCOUNT_DISABLED: 'system',
  PAYMENT_INITIATED: 'wallet',
  PAYMENT_VERIFIED: 'wallet',
  WALLET_CREDITED: 'wallet',
  WALLET_LOCKED: 'wallet',
  WALLET_UNLOCKED: 'wallet',
  EARNING_CREDITED: 'earnings',
  CPV_MILESTONE_REACHED: 'earnings',
  RANK_UPGRADED: 'earnings',
  STAGE_COMPLETED: 'earnings',
  WITHDRAWAL_REQUESTED: 'wallet',
  WITHDRAWAL_APPROVED: 'wallet',
  WITHDRAWAL_REJECTED: 'wallet',
  WITHDRAWAL_PAID: 'wallet',
  ORDER_CREATED: 'orders',
  ORDER_PAID: 'orders',
  ORDER_COMPLETED: 'orders',
  ORDER_CANCELLED: 'orders',
  ORDER_FAILED: 'orders',
  ORDER_FULFILLED: 'orders',
  ORDER_READY_FOR_PICKUP: 'orders',
  ORDER_DELIVERY_REQUESTED: 'orders',
  MERCHANT_APPLICATION_SUBMITTED: 'network',
  MERCHANT_APPROVED: 'network',
  MERCHANT_REJECTED: 'network',
  MERCHANT_SUSPENDED: 'network',
  ORDER_ASSIGNED_TO_MERCHANT: 'orders',
  MERCHANT_BONUS_CREDITED: 'earnings',
  ADMIN_ACTION_TAKEN: 'system',
  SYSTEM_ANNOUNCEMENT: 'system',
};

/** NotificationTypes grouped by UI category for preferences mapping (Option B). */
export const NOTIFICATION_TYPES_BY_CATEGORY: Record<NotificationCategory, NotificationType[]> = {
  earnings: [
    'EARNING_CREDITED',
    'CPV_MILESTONE_REACHED',
    'RANK_UPGRADED',
    'STAGE_COMPLETED',
    'MERCHANT_BONUS_CREDITED',
  ],
  wallet: [
    'REGISTRATION_ACTIVATED',
    'PAYMENT_INITIATED',
    'PAYMENT_VERIFIED',
    'WALLET_CREDITED',
    'WALLET_LOCKED',
    'WALLET_UNLOCKED',
    'WITHDRAWAL_REQUESTED',
    'WITHDRAWAL_APPROVED',
    'WITHDRAWAL_REJECTED',
    'WITHDRAWAL_PAID',
  ],
  orders: [
    'ORDER_CREATED',
    'ORDER_PAID',
    'ORDER_COMPLETED',
    'ORDER_CANCELLED',
    'ORDER_FAILED',
    'ORDER_FULFILLED',
    'ORDER_READY_FOR_PICKUP',
    'ORDER_DELIVERY_REQUESTED',
    'ORDER_ASSIGNED_TO_MERCHANT',
  ],
  network: [
    'USER_REGISTERED',
    'MERCHANT_APPLICATION_SUBMITTED',
    'MERCHANT_APPROVED',
    'MERCHANT_REJECTED',
    'MERCHANT_SUSPENDED',
  ],
  system: [
    'PASSWORD_CHANGED',
    'ACCOUNT_DISABLED',
    'ADMIN_ACTION_TAKEN',
    'SYSTEM_ANNOUNCEMENT',
  ],
};

/** Map API type to UI badge type for display. */
export function notificationTypeToUiType(
  type: NotificationType
): 'info' | 'success' | 'warning' | 'error' {
  const success: NotificationType[] = [
    'REGISTRATION_ACTIVATED',
    'PAYMENT_VERIFIED',
    'WALLET_CREDITED',
    'WALLET_UNLOCKED',
    'EARNING_CREDITED',
    'WITHDRAWAL_APPROVED',
    'WITHDRAWAL_PAID',
    'ORDER_PAID',
    'ORDER_COMPLETED',
    'ORDER_FULFILLED',
    'ORDER_READY_FOR_PICKUP',
    'ORDER_DELIVERY_REQUESTED',
    'MERCHANT_APPROVED',
    'MERCHANT_BONUS_CREDITED',
    'CPV_MILESTONE_REACHED',
    'RANK_UPGRADED',
    'STAGE_COMPLETED',
  ];
  const warning: NotificationType[] = [
    'PAYMENT_INITIATED',
    'WITHDRAWAL_REQUESTED',
    'ORDER_CREATED',
    'ORDER_ASSIGNED_TO_MERCHANT',
    'MERCHANT_APPLICATION_SUBMITTED',
  ];
  const error: NotificationType[] = [
    'ACCOUNT_DISABLED',
    'WALLET_LOCKED',
    'WITHDRAWAL_REJECTED',
    'ORDER_CANCELLED',
    'ORDER_FAILED',
    'MERCHANT_REJECTED',
    'MERCHANT_SUSPENDED',
    'ADMIN_ACTION_TAKEN',
  ];
  if (success.includes(type)) return 'success';
  if (warning.includes(type)) return 'warning';
  if (error.includes(type)) return 'error';
  return 'info';
}
