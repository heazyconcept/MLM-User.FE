import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'app-caucus-empty-state',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p class="text-sm text-mlm-secondary py-6 text-center">{{ message() }}</p>
  `,
})
export class CaucusEmptyStateComponent {
  message = input.required<string>();
}
