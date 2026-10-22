/** @deprecated Use app-caucus-panel instead. Kept for backward compatibility. */
import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { CaucusPanelComponent } from './caucus-panel.component';

@Component({
  selector: 'app-caucus-section-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CaucusPanelComponent],
  template: `
    <app-caucus-panel [title]="title()" [description]="description()">
      <ng-content />
    </app-caucus-panel>
  `,
})
export class CaucusSectionCardComponent {
  title = input<string>('');
  description = input<string>('');
}
