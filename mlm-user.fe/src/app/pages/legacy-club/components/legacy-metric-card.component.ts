import { Component, ChangeDetectionStrategy, input } from '@angular/core';

@Component({
  selector: 'app-legacy-metric-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <article class="flex h-full flex-col rounded-xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
      <p class="text-xs font-semibold uppercase tracking-wide text-mlm-secondary">{{ label() }}</p>
      <p class="mt-2 text-2xl font-black text-mlm-text">{{ value() }}</p>
      @if (description()) {
        <p class="mt-2 flex-1 text-sm leading-relaxed text-mlm-secondary">{{ description() }}</p>
      } @else {
        <div class="flex-1"></div>
      }
      <div class="mt-5 space-y-2">
        <ng-content select="[footer]" />
      </div>
    </article>
  `,
})
export class LegacyMetricCardComponent {
  label = input.required<string>();
  value = input.required<string>();
  description = input<string>();
}
