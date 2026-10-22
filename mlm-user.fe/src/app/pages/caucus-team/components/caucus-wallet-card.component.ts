import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { formatCaucusNgn } from '../../../core/utils/caucus-format.util';

@Component({
  selector: 'app-caucus-wallet-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, ButtonModule],
  template: `
    <div class="rounded-xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white p-5">
      <p class="text-xs font-semibold uppercase tracking-wide text-mlm-secondary">Caucus wallet</p>
      <p class="text-3xl font-bold text-mlm-text tabular-nums mt-2">{{ formatMoney(balance()) }}</p>
      @if (pvTotal() > 0) {
        <p class="text-sm text-mlm-secondary mt-2">Caucus PV: {{ pvTotal() }}</p>
      }
      @if (showCashOut()) {
        <a routerLink="/caucus/cashout" class="inline-block mt-4">
          <button type="button" pButton label="Cash out"></button>
        </a>
      }
    </div>
  `,
})
export class CaucusWalletCardComponent {
  balance = input(0);
  pvTotal = input(0);
  showCashOut = input(false);
  cashOut = output<void>();

  formatMoney = formatCaucusNgn;
}
