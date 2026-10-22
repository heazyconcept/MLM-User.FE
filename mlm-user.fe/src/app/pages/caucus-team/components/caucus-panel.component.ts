import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'app-caucus-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
      @if (title()) {
        <div class="border-b border-gray-100 px-5 py-4 sm:px-6">
          <h2 class="text-sm font-semibold text-mlm-text">{{ title() }}</h2>
          @if (description()) {
            <p class="mt-1 text-sm text-mlm-secondary">{{ description() }}</p>
          }
        </div>
      }
      <div [class]="bodyClass()">
        <ng-content />
      </div>
    </section>
  `,
})
export class CaucusPanelComponent {
  title = input<string>();
  description = input<string>();
  padded = input(true);

  bodyClass(): string {
    if (this.title() && this.padded()) {
      return 'space-y-5 p-5 sm:p-6';
    }
    if (this.title() && !this.padded()) {
      return '';
    }
    return this.padded() ? 'space-y-5 p-5 sm:p-6' : '';
  }
}
