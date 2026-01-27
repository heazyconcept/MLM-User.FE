import { Component, Input, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-stat-card',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './stat-card.component.html',
  styles: [],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class StatCardComponent {
  @Input() label: string = '';
  @Input() value: string | number = '';
  @Input() subValue?: string | number;
  @Input() icon: string = 'pi-chart-line';
  @Input() bgClass: string = 'bg-mlm-primary';
  @Input() trend?: string;
  @Input() trendIcon: string = 'pi-chart-bar';
}
