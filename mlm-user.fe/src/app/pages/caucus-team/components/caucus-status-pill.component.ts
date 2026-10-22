import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'app-caucus-status-pill',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span
      class="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold"
      [class.bg-emerald-100]="tone() === 'active'"
      [class.text-emerald-800]="tone() === 'active'"
      [class.bg-amber-100]="tone() === 'deactivated'"
      [class.text-amber-900]="tone() === 'deactivated'">
      {{ label() }}
    </span>
  `,
})
export class CaucusStatusPillComponent {
  label = input.required<string>();
  tone = input<'active' | 'deactivated'>('active');
}
