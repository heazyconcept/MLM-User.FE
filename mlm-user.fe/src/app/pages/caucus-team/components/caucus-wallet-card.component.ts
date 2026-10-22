import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { formatCaucusNgn } from '../../../core/utils/caucus-format.util';

@Component({
  selector: 'app-caucus-wallet-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  template: `
    <article
      class="relative flex h-full flex-col overflow-hidden rounded-xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
      <div class="absolute inset-y-0 left-0 w-1 bg-mlm-primary" aria-hidden="true"></div>
      <div class="pl-3">
        <p class="text-xs font-semibold uppercase tracking-wide text-mlm-secondary">Caucus wallet</p>
        <p class="mt-2 text-2xl font-black tabular-nums text-mlm-text">{{ formatMoney(balance()) }}</p>
        @if (pvTotal() > 0) {
          <p class="mt-2 text-sm text-mlm-secondary">Caucus PV: {{ pvTotal() }}</p>
        }
        @if (showCashOut()) {
          <a
            routerLink="/caucus/cashout"
            class="mt-5 inline-flex min-h-11 items-center justify-center rounded-xl bg-mlm-primary px-5 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90">
            Cash out
          </a>
        }
      </div>
    </article>
  `,
})
export class CaucusWalletCardComponent {
  balance = input(0);
  pvTotal = input(0);
  showCashOut = input(false);

  formatMoney = formatCaucusNgn;
}
