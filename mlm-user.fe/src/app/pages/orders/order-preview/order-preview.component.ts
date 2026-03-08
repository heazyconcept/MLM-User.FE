import {
  Component,
  inject,
  signal,
  input,
  output,
  effect,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { OrderService } from '../../../services/order.service';
import { MerchantService } from '../../../services/merchant.service';
import {
  LocationSelectorComponent,
  PickupLocation,
} from '../../../components/location-selector/location-selector.component';

@Component({
  selector: 'app-order-preview',
  imports: [CommonModule, LocationSelectorComponent],
  templateUrl: './order-preview.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OrderPreviewComponent {
  private orderService = inject(OrderService);
  private merchantService = inject(MerchantService);

  pendingOrderData = input<any>(null);
  submitting = input<boolean>(false);
  orderConfirmed = output<any>();

  fulfilmentOption = this.orderService.fulfilmentOption;
  selectedPickupId = signal<string | null>(null);
  deliveryAddress = signal<string>('12 Marina Street, Lagos Island, Lagos');
  deliveryFee = 1500;

  pickupLocations = signal<PickupLocation[]>([]);
  pickupLocationsLoading = signal(false);
  pickupLocationsError = signal<string | null>(null);

  constructor() {
    effect(() => {
      const data = this.pendingOrderData();
      if (data) {
        this.loadPickupLocations();
      } else {
        this.pickupLocations.set([]);
        this.selectedPickupId.set(null);
      }
    });
  }

  private loadPickupLocations(): void {
    this.pickupLocationsLoading.set(true);
    this.pickupLocationsError.set(null);
    this.merchantService.fetchAvailableMerchants().subscribe({
      next: (merchants) => {
        const list: PickupLocation[] = merchants
          .filter((m) => m.pickupAvailable)
          .map((m) => ({
            id: m.id,
            name: m.name,
            distance: m.serviceAreas?.length ? m.serviceAreas.join(', ') : undefined,
          }));
        this.pickupLocations.set(list);
        this.pickupLocationsLoading.set(false);
        this.selectedPickupId.set(null);
      },
      error: () => {
        this.pickupLocationsError.set('Could not load pickup locations. Try again or choose delivery.');
        this.pickupLocations.set([]);
        this.pickupLocationsLoading.set(false);
      },
    });
  }

  setOption(option: 'pickup' | 'delivery'): void {
    this.orderService.setFulfilmentOption(option);
    if (option === 'delivery') {
      this.selectedPickupId.set(null);
    } else if (
      option === 'pickup' &&
      this.pickupLocations().length === 0 &&
      !this.pickupLocationsLoading() &&
      this.pendingOrderData()
    ) {
      this.loadPickupLocations();
    }
  }

  onLocationSelect(id: string): void {
    this.selectedPickupId.set(id);
  }

  onDeliveryAddressInput(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.deliveryAddress.set(value);
  }

  canConfirm(): boolean {
    if (this.submitting()) return false;
    if (this.fulfilmentOption() === 'pickup') {
      return !!this.selectedPickupId();
    }
    return true;
  }

  onConfirm(): void {
    if (!this.canConfirm()) return;
    this.orderConfirmed.emit({
      fulfilmentOption: this.fulfilmentOption(),
      selectedPickupId: this.selectedPickupId(),
      deliveryAddress: this.deliveryAddress(),
    });
  }
}
