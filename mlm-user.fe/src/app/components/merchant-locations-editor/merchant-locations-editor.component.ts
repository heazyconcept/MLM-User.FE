import {
  Component,
  ChangeDetectionStrategy,
  input,
  output,
  computed,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { countries } from 'countries-list';
import type { MerchantType } from '../../services/merchant.service';
import {
  type MerchantLocationDraft,
  createEmptyLocationDraft,
  enforceTierOnDrafts,
  isNigeriaCountry,
  nigerianStateOptions,
} from '../../core/utils/merchant-locations.util';

@Component({
  selector: 'app-merchant-locations-editor',
  imports: [CommonModule, FormsModule],
  templateUrl: './merchant-locations-editor.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MerchantLocationsEditorComponent {
  merchantType = input.required<MerchantType>();
  locations = input.required<MerchantLocationDraft[]>();
  contactPhone = input<string>('');

  locationsChange = output<MerchantLocationDraft[]>();

  readonly nigerianStates = nigerianStateOptions();
  readonly countriesList = Object.values(countries)
    .map((country) => ({ label: country.name, value: country.name }))
    .sort((a, b) => a.label.localeCompare(b.label));

  stateSearchQuery = signal('');
  openStatePickerIndex = signal<number | null>(null);

  canAddLocation = computed(() => this.merchantType() !== 'REGIONAL');
  phoneRequiredPerLocation = computed(() => this.merchantType() === 'GLOBAL');

  filteredStates = computed(() => {
    const query = this.stateSearchQuery().toLowerCase().trim();
    if (!query) return this.nigerianStates;
    return this.nigerianStates.filter((state) => state.toLowerCase().includes(query));
  });

  onCountryChange(index: number, country: string): void {
    this.openStatePickerIndex.set(null);
    const next = this.locations().map((loc, i) => {
      if (i !== index) return loc;
      const countryChanged = loc.country.trim().toLowerCase() !== country.trim().toLowerCase();
      return {
        ...loc,
        country,
        // Clear state when switching country so Nigeria picker values don't stick.
        state: countryChanged ? '' : loc.state,
      };
    });
    this.emit(enforceTierOnDrafts(this.merchantType(), next));
  }

  onStateChange(index: number, state: string): void {
    if (state.trim() === '*') return;
    const next = this.locations().map((loc, i) => (i === index ? { ...loc, state } : loc));
    this.emit(next);
  }

  onAddressChange(index: number, address: string): void {
    const next = this.locations().map((loc, i) => (i === index ? { ...loc, address } : loc));
    this.emit(next);
  }

  onPhoneChange(index: number, phoneNumber: string): void {
    const next = this.locations().map((loc, i) => (i === index ? { ...loc, phoneNumber } : loc));
    this.emit(next);
  }

  setPrimary(index: number): void {
    const next = this.locations().map((loc, i) => ({ ...loc, isPrimary: i === index }));
    this.emit(enforceTierOnDrafts(this.merchantType(), next));
  }

  addLocation(): void {
    if (!this.canAddLocation()) return;
    const primary =
      this.locations().find((loc) => loc.isPrimary) ?? this.locations()[0];
    // National service areas inherit the primary country; Global picks per row.
    const inheritCountry =
      this.merchantType() === 'NATIONAL' ? (primary?.country ?? '') : '';
    const next = [...this.locations(), createEmptyLocationDraft(false, inheritCountry)];
    this.emit(enforceTierOnDrafts(this.merchantType(), next));
  }

  removeLocation(index: number): void {
    if (this.locations().length <= 1) return;
    const next = this.locations().filter((_, i) => i !== index);
    this.emit(enforceTierOnDrafts(this.merchantType(), next));
  }

  toggleStatePicker(index: number): void {
    this.stateSearchQuery.set('');
    this.openStatePickerIndex.set(this.openStatePickerIndex() === index ? null : index);
  }

  selectNigerianState(index: number, state: string): void {
    this.onStateChange(index, state);
    this.openStatePickerIndex.set(null);
    this.stateSearchQuery.set('');
  }

  usesNigerianStatePicker(loc: MerchantLocationDraft): boolean {
    return isNigeriaCountry(loc.country);
  }

  private emit(next: MerchantLocationDraft[]): void {
    this.locationsChange.emit(next);
  }
}
