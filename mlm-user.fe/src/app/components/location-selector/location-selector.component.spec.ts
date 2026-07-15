import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';

import { LocationSelectorComponent, PickupLocation } from './location-selector.component';

describe('LocationSelectorComponent', () => {
  let fixture: ComponentFixture<LocationSelectorComponent>;
  let component: LocationSelectorComponent;

  const location = (overrides: Partial<PickupLocation> = {}): PickupLocation => ({
    id: 'merchant-1',
    name: 'Lagos Hub',
    address: '12 Pickup Road',
    phoneNumber: '+2348012345678',
    pickupAvailable: true,
    stockState: 'full',
    usingPrimaryAddressFallback: false,
    ...overrides,
  });

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [LocationSelectorComponent] }).compileComponents();
    fixture = TestBed.createComponent(LocationSelectorComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('locations', []);
  });

  it.each(['full', 'partial'] as const)('emits selection for %s stock', (stockState) => {
    const emitted = vi.fn();
    component.locationSelect.subscribe(emitted);
    fixture.componentRef.setInput('locations', [location({ stockState })]);
    fixture.detectChanges();

    fixture.debugElement.query(By.css('button')).nativeElement.click();

    expect(emitted).toHaveBeenCalledWith('merchant-1');
  });

  it('does not emit for zero stock or incomplete pickup contact', () => {
    const emitted = vi.fn();
    component.locationSelect.subscribe(emitted);

    expect(component.isSelectable(location({ stockState: 'none' }))).toBe(false);
    expect(component.isSelectable(location({ pickupAvailable: false }))).toBe(false);
    component.onSelect('merchant-1');

    expect(emitted).not.toHaveBeenCalled();
  });

  it('renders the partial-stock and fallback-address warnings', () => {
    fixture.componentRef.setInput('locations', [
      location({ stockState: 'partial', usingPrimaryAddressFallback: true }),
    ]);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Partial stock');
    expect(fixture.nativeElement.textContent).toContain('Confirm address with merchant');
  });
});
