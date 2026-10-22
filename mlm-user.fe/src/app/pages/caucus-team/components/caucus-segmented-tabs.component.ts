import { ChangeDetectionStrategy, Component, input, model } from '@angular/core';

export type CaucusSegmentTab = 'people' | 'months' | 'team';

@Component({
  selector: 'app-caucus-segmented-tabs',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="inline-flex w-full rounded-xl border border-gray-200 bg-gray-50/80 p-1 sm:w-auto"
      role="tablist"
      aria-label="Caucus sections">
      @for (tab of tabs; track tab.id) {
        <button
          type="button"
          role="tab"
          class="flex-1 rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-mlm-primary focus-visible:ring-offset-2 sm:flex-none"
          [class.bg-white]="active() === tab.id"
          [class.text-mlm-text]="active() === tab.id"
          [class.shadow-sm]="active() === tab.id"
          [class.text-mlm-secondary]="active() !== tab.id"
          [attr.aria-selected]="active() === tab.id"
          [attr.tabindex]="active() === tab.id ? 0 : -1"
          (click)="select(tab.id)">
          {{ tab.label }}
        </button>
      }
    </div>
  `,
})
export class CaucusSegmentedTabsComponent {
  active = model<CaucusSegmentTab>('people');
  disabled = input(false);

  readonly tabs: { id: CaucusSegmentTab; label: string }[] = [
    { id: 'people', label: 'People' },
    { id: 'months', label: 'Months' },
    { id: 'team', label: 'Team' },
  ];

  select(id: CaucusSegmentTab): void {
    if (this.disabled()) {
      return;
    }
    this.active.set(id);
  }
}
