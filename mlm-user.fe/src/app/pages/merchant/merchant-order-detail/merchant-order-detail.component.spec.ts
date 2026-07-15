import { MerchantOrder } from '../../../services/merchant.service';
import { canMarkMerchantOrderPickedUp } from './merchant-order-detail.component';

describe('merchant pickup transition', () => {
  it.each(['ASSIGNED_TO_MERCHANT', 'READY_FOR_PICKUP'] as const)(
    'allows marking pickup directly from %s',
    (status) => {
      expect(
        canMarkMerchantOrderPickedUp({
          fulfilmentMode: 'PICKUP',
          status,
        } as MerchantOrder),
      ).toBe(true);
    },
  );

  it('does not allow the transition for delivery orders', () => {
    expect(
      canMarkMerchantOrderPickedUp({
        fulfilmentMode: 'OFFLINE_DELIVERY',
        status: 'ASSIGNED_TO_MERCHANT',
      } as MerchantOrder),
    ).toBe(false);
  });
});
