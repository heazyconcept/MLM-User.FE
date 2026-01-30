import { Component, input, output, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';

export interface PickupLocation {
  id: string;
  name: string;
  distance?: string;
}

@Component({
  selector: 'app-location-selector',
  imports: [CommonModule],
  templateUrl: './location-selector.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class LocationSelectorComponent {
  locations = input.required<PickupLocation[]>();
  selectedId = input<string | null>(null);

  locationSelect = output<string>();

  onSelect(id: string): void {
    this.locationSelect.emit(id);
  }
}
