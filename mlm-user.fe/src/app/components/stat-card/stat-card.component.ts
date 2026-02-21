import { Component, input, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-stat-card',
  imports: [CommonModule],
  templateUrl: './stat-card.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class StatCardComponent {
  label = input.required<string>();
  value = input.required<string | number>();
  subValue = input<string>();
  icon = input<string>();
  bgClass = input<string>('bg-mlm-primary');
}
