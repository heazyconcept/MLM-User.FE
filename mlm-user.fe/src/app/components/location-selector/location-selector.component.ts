import { Component, input, output, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';

export interface PickupLocation {
  id: string;
  name: string;
  address?: string;
  phoneNumber?: string;
  pickupAvailable: boolean;
  /** When false, merchant is shown greyed out and cannot be selected. */
  stockInStock?: boolean;
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
    if (this.isSelectable(loc)) {
      this.locationSelect.emit(id);
    }
  }

  isSelectable(loc: PickupLocation | undefined): boolean {
    return !!loc?.pickupAvailable && loc.stockInStock === true;
  }
}
