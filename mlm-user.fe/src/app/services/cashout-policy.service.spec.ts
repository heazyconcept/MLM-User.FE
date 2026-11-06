import { TestBed } from '@angular/core/testing';
import { firstValueFrom, of, throwError } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { ApiService } from './api.service';
import { CashoutPolicyService } from './cashout-policy.service';
import { DEFAULT_PAYOUT_NOTICE } from '../core/models/cashout-policy.model';

describe('CashoutPolicyService', () => {
  it('maps camelCase policy payload', async () => {
    const get = vi.fn().mockReturnValue(
      of({
        feeRate: 0.05,
        voucherLimitNgn: 10000,
        voucherBalanceNgn: 4500,
        canCashout: false,
        blockReason: 'Voucher too high',
        payoutNotice: 'Custom notice',
      }),
    );

    TestBed.configureTestingModule({
      providers: [CashoutPolicyService, { provide: ApiService, useValue: { get } }],
    });

    const service = TestBed.inject(CashoutPolicyService);
    const policy = await firstValueFrom(service.getPolicy());
    expect(policy.feeRate).toBe(0.05);
    expect(policy.voucherLimitNgn).toBe(10000);
    expect(policy.voucherBalanceNgn).toBe(4500);
    expect(policy.canCashout).toBe(false);
    expect(policy.blockReason).toBe('Voucher too high');
    expect(policy.payoutNotice).toBe('Custom notice');
  });

  it('maps snake_case and nested data envelope', async () => {
    const get = vi.fn().mockReturnValue(
      of({
        data: {
          fee_rate: 0.05,
          voucher_limit_ngn: 10000,
          voucher_balance_ngn: 0,
          can_cashout: true,
          block_reason: '',
          payout_notice: DEFAULT_PAYOUT_NOTICE,
        },
      }),
    );

    TestBed.configureTestingModule({
      providers: [CashoutPolicyService, { provide: ApiService, useValue: { get } }],
    });

    const service = TestBed.inject(CashoutPolicyService);
    const policy = await firstValueFrom(service.getPolicy());
    expect(policy.canCashout).toBe(true);
    expect(policy.blockReason).toBeNull();
    expect(policy.voucherBalanceNgn).toBe(0);
  });

  it('falls back to permissive defaults when API fails', async () => {
    const get = vi.fn().mockReturnValue(throwError(() => new Error('network')));

    TestBed.configureTestingModule({
      providers: [CashoutPolicyService, { provide: ApiService, useValue: { get } }],
    });

    const service = TestBed.inject(CashoutPolicyService);
    const policy = await firstValueFrom(service.getPolicy());
    expect(policy.feeRate).toBe(0.05);
    expect(policy.canCashout).toBe(true);
    expect(policy.blockReason).toBeNull();
    expect(policy.payoutNotice).toBe(DEFAULT_PAYOUT_NOTICE);
  });
});
