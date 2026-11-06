import {
  computeCashoutCharge,
  formatCashoutConfirmMessage,
  roundMoneyHalfUp,
} from './cashout-charge.util';

describe('cashout-charge.util', () => {
  it('computes 5% on 100000 NGN', () => {
    const r = computeCashoutCharge(100_000, 0.05);
    expect(r.feeAmount).toBe(5000);
    expect(r.netAmount).toBe(95_000);
  });

  it('half-rounds fee to 2 decimals', () => {
    const r = computeCashoutCharge(10.005, 0.05);
    expect(r.feeAmount).toBe(roundMoneyHalfUp(10.005 * 0.05));
    expect(r.netAmount).toBe(roundMoneyHalfUp(10.005 - r.feeAmount));
  });

  it('handles zero amount', () => {
    const r = computeCashoutCharge(0, 0.05);
    expect(r.feeAmount).toBe(0);
    expect(r.netAmount).toBe(0);
  });

  it('formats confirm dialog copy', () => {
    const message = formatCashoutConfirmMessage(20_000, 0.05, 'NGN');
    expect(message).toContain('You are requesting: ₦20,000.00');
    expect(message).toContain('Admin charge (5%): ₦1,000.00');
    expect(message).toContain('Amount that will hit the bank: ₦19,000.00');
  });
});
