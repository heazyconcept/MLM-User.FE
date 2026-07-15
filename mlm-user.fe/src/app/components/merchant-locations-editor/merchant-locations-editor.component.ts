import {
  Component,
  ChangeDetectionStrategy,
  OnInit,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import type { MerchantType } from '../../services/merchant.service';
import { GeographyService, type GeographySubdivision } from '../../services/geography.service';
import {
  type MerchantLocationDraft,
  createEmptyLocationDraft,
  enforceTierOnDrafts,
} from '../../core/utils/merchant-locations.util';

@Component({
  selector: 'app-merchant-locations-editor',
  imports: [CommonModule, FormsModule],
  templateUrl: './merchant-locations-editor.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MerchantLocationsEditorComponent implements OnInit {
  private geographyService = inject(GeographyService);

  merchantType = input.required<MerchantType>();
  homeCountryCode = input.required<string>();
  locations = input.required<MerchantLocationDraft[]>();
  contactPhone = input<string>('');

  homeCountryCodeChange = output<string>();
  locationsChange = output<MerchantLocationDraft[]>();

  readonly countries = this.geographyService.countries;
  readonly geographyLoading = this.geographyService.loading;
  readonly geographyError = this.geographyService.error;
  readonly subdivisionsByCountry = signal<Record<string, GeographySubdivision[]>>({});
  stateSearchQuery = signal('');
  openStatePickerIndex = signal<number | null>(null);

  constructor() {
    effect(() => {
      const codes = new Set([
        this.homeCountryCode(),
        ...this.locations().map((location) => location.countryCode),
      ]);
      for (const code of codes) {
        if (code) this.loadSubdivisions(code);
      }
    });
  }

  ngOnInit(): void {
    this.geographyService.fetchCountries().subscribe(() => {
      const code = this.homeCountryCode();
      if (code) this.syncHomeCountry(code);
    });
  }

  onHomeCountryChange(countryCode: string): void {
    this.homeCountryCodeChange.emit(countryCode);
    this.syncHomeCountry(countryCode);
    this.loadSubdivisions(countryCode);
  }

  onCountryChange(index: number, countryCode: string): void {
    this.openStatePickerIndex.set(null);
    const country = this.countryName(countryCode);
    const next = this.locations().map((loc, i) => {
      if (i !== index) return loc;
      const countryChanged = loc.countryCode !== countryCode;
      return {
        ...loc,
        countryCode,
        country,
        subdivisionCode: countryChanged ? '' : loc.subdivisionCode,
        state: countryChanged ? '' : loc.state,
      };
    });
    this.emit(
      enforceTierOnDrafts(
        this.merchantType(),
        next,
        this.homeCountryCode(),
        this.countryName(this.homeCountryCode()),
      ),
    );
    this.loadSubdivisions(countryCode);
  }

  onSubdivisionChange(index: number, subdivisionCode: string): void {
    if (subdivisionCode === '*') return;
    const subdivision = this.subdivisionsFor(index).find(
      (option) => option.code === subdivisionCode,
    );
    if (!subdivision) return;
    const next = this.locations().map((loc, i) =>
      i === index ? { ...loc, subdivisionCode: subdivision.code, state: subdivision.name } : loc,
    );
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
    this.emit(
      enforceTierOnDrafts(
        this.merchantType(),
        next,
        this.homeCountryCode(),
        this.countryName(this.homeCountryCode()),
      ),
    );
  }

  addLocation(): void {
    if (this.merchantType() === 'REGIONAL') return;
    const code = this.merchantType() === 'NATIONAL' ? this.homeCountryCode() : '';
    const next = [
      ...this.locations(),
      createEmptyLocationDraft(false, code, this.countryName(code)),
    ];
    this.emit(
      enforceTierOnDrafts(
        this.merchantType(),
        next,
        this.homeCountryCode(),
        this.countryName(this.homeCountryCode()),
      ),
    );
  }

  removeLocation(index: number): void {
    if (this.locations().length <= 1) return;
    const next = this.locations().filter((_, i) => i !== index);
    this.emit(
      enforceTierOnDrafts(
        this.merchantType(),
        next,
        this.homeCountryCode(),
        this.countryName(this.homeCountryCode()),
      ),
    );
  }

  toggleStatePicker(index: number): void {
    this.stateSearchQuery.set('');
    this.openStatePickerIndex.set(this.openStatePickerIndex() === index ? null : index);
  }

  selectSubdivision(index: number, subdivision: GeographySubdivision): void {
    this.onSubdivisionChange(index, subdivision.code);
    this.openStatePickerIndex.set(null);
    this.stateSearchQuery.set('');
  }

  subdivisionsFor(index: number): GeographySubdivision[] {
    const code = this.locations()[index]?.countryCode;
    const options = this.subdivisionsByCountry()[code] ?? [];
    const query =
      this.openStatePickerIndex() === index ? this.stateSearchQuery().trim().toLowerCase() : '';
    return query ? options.filter((option) => option.name.toLowerCase().includes(query)) : options;
  }

  countryName(code: string): string {
    return this.countries().find((country) => country.code === code)?.name ?? '';
  }

  countryLocked(location: MerchantLocationDraft): boolean {
    return this.merchantType() !== 'GLOBAL' || location.isPrimary;
  }

  private syncHomeCountry(countryCode: string): void {
    this.emit(
      enforceTierOnDrafts(
        this.merchantType(),
        this.locations(),
        countryCode,
        this.countryName(countryCode),
      ),
    );
  }

  private loadSubdivisions(countryCode: string): void {
    const code = countryCode.trim().toUpperCase();
    if (!code || this.subdivisionsByCountry()[code]) return;
    this.geographyService.fetchSubdivisions(code).subscribe((subdivisions) => {
      this.subdivisionsByCountry.update((current) => ({ ...current, [code]: subdivisions }));
      this.resolveLegacySubdivisions(code, subdivisions);
    });
  }

  private resolveLegacySubdivisions(
    countryCode: string,
    subdivisions: GeographySubdivision[],
  ): void {
    let changed = false;
    const next = this.locations().map((location) => {
      if (location.countryCode !== countryCode || location.subdivisionCode || !location.state) {
        return location;
      }
      const matches = subdivisions.filter(
        (option) => option.name.toLowerCase() === location.state.trim().toLowerCase(),
      );
      if (matches.length !== 1) return location;
      changed = true;
      return { ...location, subdivisionCode: matches[0].code, state: matches[0].name };
    });
    if (changed) this.emit(next);
  }

  private emit(next: MerchantLocationDraft[]): void {
    this.locationsChange.emit(next);
  }
}
