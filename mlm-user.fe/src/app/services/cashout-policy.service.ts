import { Injectable, inject } from '@angular/core';
import { Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { ApiService } from './api.service';
import {
  DEFAULT_PAYOUT_NOTICE,
  type CashoutPolicy,
} from '../core/models/cashout-policy.model';

@Injectable({ providedIn: 'root' })
export class CashoutPolicyService {
  private api = inject(ApiService);

  getPolicy(): Observable<CashoutPolicy> {
    return this.api.get<Record<string, unknown>>('withdrawals/cashout-policy').pipe(
      map((raw) => this.mapPolicy(raw)),
      catchError(() =>
        of({
          feeRate: 0.05,
          voucherLimitNgn: 10000,
          voucherBalanceNgn: 0,
          canCashout: true,
          blockReason: null,
          payoutNotice: DEFAULT_PAYOUT_NOTICE,
        }),
      ),
    );
  }

  private mapPolicy(raw: Record<string, unknown>): CashoutPolicy {
    const data = (raw['data'] as Record<string, unknown> | undefined) ?? raw;
    const blockRaw = data['blockReason'] ?? data['block_reason'];
    return {
      feeRate: this.readNumber(data['feeRate'] ?? data['fee_rate'], 0.05),
      voucherLimitNgn: this.readNumber(
        data['voucherLimitNgn'] ?? data['voucher_limit_ngn'],
        10000,
      ),
      voucherBalanceNgn: this.readNumber(
        data['voucherBalanceNgn'] ?? data['voucher_balance_ngn'],
        0,
      ),
      canCashout: this.readBoolean(data['canCashout'] ?? data['can_cashout'], true),
      blockReason:
        blockRaw == null || String(blockRaw).trim() === '' ? null : String(blockRaw),
      payoutNotice: String(data['payoutNotice'] ?? data['payout_notice'] ?? DEFAULT_PAYOUT_NOTICE),
    };
  }

  private readNumber(value: unknown, fallback: number): number {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  }

  private readBoolean(value: unknown, fallback: boolean): boolean {
    if (typeof value === 'boolean') return value;
    if (value === 'true') return true;
    if (value === 'false') return false;
    return fallback;
  }
}
