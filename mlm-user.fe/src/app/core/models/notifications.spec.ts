import {
  NOTIFICATION_TYPE_TO_CATEGORY,
  notificationTypeToUiType,
} from './notifications';

describe('order notification mappings', () => {
  it.each([
    'ORDER_PICKED_UP',
    'ORDER_RECEIVED_CONFIRMED',
    'ORDER_DISPUTE_OPENED',
    'ORDER_DISPUTE_RESOLVED',
  ] as const)('categorizes %s as an order notification', (type) => {
    expect(NOTIFICATION_TYPE_TO_CATEGORY[type]).toBe('orders');
  });

  it('uses appropriate pickup and dispute severities', () => {
    expect(notificationTypeToUiType('ORDER_PICKED_UP')).toBe('success');
    expect(notificationTypeToUiType('ORDER_RECEIVED_CONFIRMED')).toBe('success');
    expect(notificationTypeToUiType('ORDER_DISPUTE_OPENED')).toBe('warning');
    expect(notificationTypeToUiType('ORDER_DISPUTE_RESOLVED')).toBe('success');
  });
});
