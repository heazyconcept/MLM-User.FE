import { Component, input, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-merchant-stat-card',
  imports: [CommonModule],
  templateUrl: './merchant-stat-card.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MerchantStatCardComponent {
  title = input.required<string>();
  value = input.required<string | number>();
  subtitle = input<string>();
  icon = input<string>();
  /** Tailwind background class e.g. bg-mlm-primary, bg-mlm-blue-500 */
  variant = input<string>('bg-mlm-primary');
}
