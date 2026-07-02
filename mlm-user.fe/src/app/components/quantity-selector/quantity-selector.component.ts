import { Component, Input, Output, EventEmitter, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-quantity-selector',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './quantity-selector.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class QuantitySelectorComponent {
  @Input() min = 1;
  @Input() max?: number;
  @Input() value = 1;
  @Input() disabled = false;

  @Output() valueChange = new EventEmitter<number>();

  increment(): void {
    if (this.disabled) return;
    if (this.max != null && this.value >= this.max) return;
    this.valueChange.emit(this.value + 1);
  }

  decrement(): void {
    if (this.value > this.min && !this.disabled) {
      const next = this.value - 1;
      this.valueChange.emit(next);
    }
  }
}
