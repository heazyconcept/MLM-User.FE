import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'app-caucus-empty-state',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-col items-center justify-center py-12 text-center">
      <div
        class="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 text-mlm-secondary"
        aria-hidden="true">
        <i class="pi pi-inbox text-xl"></i>
      </div>
      <p class="max-w-sm text-sm font-medium text-mlm-text">{{ message() }}</p>
      @if (hint()) {
        <p class="mt-2 max-w-sm text-xs text-mlm-secondary">{{ hint() }}</p>
      }
    </div>
  `,
})
export class CaucusEmptyStateComponent {
  message = input.required<string>();
  hint = input<string>();
}
