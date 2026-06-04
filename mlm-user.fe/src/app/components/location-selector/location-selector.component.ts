import { Component, input, output, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';

export interface PickupLocation {
  id: string;
  name: string;
  address?: string;
  phoneNumber?: string;
  pickupAvailable: boolean;
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
    const loc = this.locations().find((l) => l.id === id);
    if (loc?.pickupAvailable) {
      this.locationSelect.emit(id);
    }
  }
}
