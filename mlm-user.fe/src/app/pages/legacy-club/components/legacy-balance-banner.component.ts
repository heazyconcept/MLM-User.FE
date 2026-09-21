import { Component, ChangeDetectionStrategy, input } from '@angular/core';

@Component({
  selector: 'app-legacy-balance-banner',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="rounded-xl border border-green-100 bg-green-50 p-5 sm:p-6">
      <p class="text-xs font-semibold uppercase tracking-wide text-green-800">{{ label() }}</p>
      <p class="mt-2 text-2xl font-black text-green-700 sm:text-3xl">{{ amount() }}</p>
      @if (hint()) {
        <p class="mt-2 text-xs font-medium leading-relaxed text-green-700/80">{{ hint() }}</p>
      }
    </div>
  `,
})
export class LegacyBalanceBannerComponent {
  label = input.required<string>();
  amount = input.required<string>();
  hint = input<string>();
}
