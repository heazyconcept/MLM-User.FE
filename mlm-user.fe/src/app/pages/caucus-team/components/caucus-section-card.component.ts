import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'app-caucus-section-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      @if (title()) {
        <h2 class="text-base font-semibold text-mlm-text mb-1">{{ title() }}</h2>
      }
      @if (description()) {
        <p class="text-sm text-mlm-secondary mb-4">{{ description() }}</p>
      }
      <ng-content />
    </section>
  `,
})
export class CaucusSectionCardComponent {
  title = input<string>('');
  description = input<string>('');
}
