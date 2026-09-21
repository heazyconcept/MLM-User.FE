import { Component, ChangeDetectionStrategy, input } from '@angular/core';

@Component({
  selector: 'app-legacy-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section
      class="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm"
      [class]="paddingClass()"
    >
      @if (title()) {
        <div
          class="border-b border-gray-100 px-5 py-4 sm:px-6"
          [class.border-b-0]="!hasBodyPadding()"
        >
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
export class LegacyPanelComponent {
  title = input<string>();
  description = input<string>();
  /** When true, content area gets standard padding (default). */
  padded = input(true);

  paddingClass(): string {
    return this.title() ? '' : this.padded() ? 'p-5 sm:p-6' : '';
  }

  hasBodyPadding(): boolean {
    return this.padded();
  }

  bodyClass(): string {
    if (this.title() && this.padded()) {
      return 'space-y-5 p-5 sm:p-6';
    }
    if (this.title() && !this.padded()) {
      return '';
    }
    return this.padded() ? 'space-y-5' : '';
  }
}
