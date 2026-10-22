import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { ButtonModule } from 'primeng/button';

@Component({
  selector: 'app-caucus-pager',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ButtonModule],
  template: `
    <div class="flex items-center justify-between gap-2 pt-3">
      <button
        type="button"
        pButton
        label="Previous"
        class="p-button-outlined p-button-sm"
        [disabled]="page() <= 1"
        (click)="pageChange.emit(page() - 1)"></button>
      <span class="text-xs text-mlm-secondary">Page {{ page() }}</span>
      <button
        type="button"
        pButton
        label="Next"
        class="p-button-outlined p-button-sm"
        [disabled]="!hasNext()"
        (click)="pageChange.emit(page() + 1)"></button>
    </div>
  `,
})
export class CaucusPagerComponent {
  page = input(1);
  hasNext = input(false);
  pageChange = output<number>();
}
