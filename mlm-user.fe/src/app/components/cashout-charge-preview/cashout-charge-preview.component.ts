import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import {
  computeCashoutCharge,
  formatCashoutPercent,
} from '../../core/utils/cashout-charge.util';

@Component({
  selector: 'app-cashout-charge-preview',
  standalone: true,
  imports: [CommonModule, DecimalPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (amount() != null && amount()! > 0) {
      <div
        class="rounded-xl border border-gray-100 bg-gray-50/80 p-4 text-sm space-y-2"
        data-testid="cashout-charge-preview"
      >
        <div class="flex justify-between gap-4">
          <span class="text-mlm-secondary">Requested (wallet)</span>
          <span class="font-semibold tabular-nums text-mlm-text">{{ symbol() }}{{ breakdown().amount | number: '1.2-2' }}</span>
        </div>
        <div class="flex justify-between gap-4">
          <span class="text-mlm-secondary">{{ feeLabel() }}</span>
          <span class="font-semibold tabular-nums text-mlm-text">−{{ symbol() }}{{ breakdown().feeAmount | number: '1.2-2' }}</span>
        </div>
        <div class="flex justify-between gap-4 border-t border-gray-200 pt-2">
          <span class="font-medium text-mlm-text">Expected in bank</span>
          <span class="font-bold tabular-nums text-mlm-primary">{{ symbol() }}{{ breakdown().netAmount | number: '1.2-2' }}</span>
        </div>
      </div>
    }
  `,
})
export class CashoutChargePreviewComponent {
  amount = input<number | null>(null);
  feeRate = input(0.05);
  currency = input<'NGN' | 'USD'>('NGN');

  breakdown = computed(() => computeCashoutCharge(this.amount() ?? 0, this.feeRate()));

  symbol = computed(() => (this.currency() === 'USD' ? '$' : '₦'));

  feeLabel = computed(() => `${formatCashoutPercent(this.feeRate())} charge`);
}
