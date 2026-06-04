import {
  Component,
  inject,
  signal,
  computed,
  input,
  output,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { OrderService } from '../../../services/order.service';
import { MerchantService } from '../../../services/merchant.service';
import {
  LocationSelectorComponent,
  PickupLocation,
} from '../../../components/location-selector/location-selector.component';
import { NIGERIAN_STATES } from '../../../core/constants/states.constants';

@Component({
  selector: 'app-order-preview',
  imports: [CommonModule, FormsModule, LocationSelectorComponent],
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
  selectedState = signal<string>('');
  deliveryAddress = signal<string>('');

  readonly nigerianStates = NIGERIAN_STATES;

  pickupLocations = signal<PickupLocation[]>([]);
  pickupLocationsLoading = signal(false);
  pickupLocationsError = signal<string | null>(null);
  lastLoadHadProductId = signal(false);

  hasSelectablePickup = computed(() =>
    this.pickupLocations().some((l) => l.pickupAvailable),
  );

  emptyPickupMessage = computed(() => {
    if (!this.selectedState() || this.pickupLocations().length > 0) return null;
    const state = this.selectedState();
    if (this.lastLoadHadProductId()) {
      return `No merchants in ${state} with enough stock for this product.`;
    }
    return `No active merchants in ${state}.`;
  });

  showNoSelectableBanner = computed(
    () => this.pickupLocations().length > 0 && !this.hasSelectablePickup(),
  );

  setOption(option: 'pickup' | 'delivery'): void {
    this.orderService.setFulfilmentOption(option);
    if (option === 'delivery') {
      this.selectedPickupId.set(null);
      this.selectedState.set('');
      this.pickupLocations.set([]);
    }
  }

  onStateChange(state: string): void {
    this.selectedState.set(state);
    this.selectedPickupId.set(null);
    if (!state) {
      this.pickupLocations.set([]);
      this.pickupLocationsError.set(null);
      return;
    }
    this.loadMerchantsForState(state);
  }

  private loadMerchantsForState(state: string): void {
    const orderData = this.pendingOrderData();
    const productId = orderData?.product?.id as string | undefined;
    const quantity = Number(orderData?.quantity ?? 1);

    this.pickupLocationsLoading.set(true);
    this.pickupLocationsError.set(null);
    this.lastLoadHadProductId.set(!!productId);

    this.merchantService
      .fetchAvailableMerchantsForPickup({
        state,
        productId,
        quantity: quantity > 0 ? quantity : 1,
      })
      .subscribe({
        next: (merchants) => {
          const list: PickupLocation[] = merchants.map((m) => ({
            id: m.id,
            name: m.businessName || m.name,
            address: m.address || undefined,
            phoneNumber: m.phoneNumber || undefined,
            pickupAvailable: m.pickupAvailable,
          }));
          this.pickupLocations.set(list);
          this.pickupLocationsLoading.set(false);
        },
        error: (err) => {
          this.pickupLocationsError.set(
            MerchantService.extractApiErrorMessage(
              err,
              'Could not load pickup merchants for this state. Try again or choose delivery.',
            ),
          );
          this.pickupLocations.set([]);
          this.pickupLocationsLoading.set(false);
        },
      });
  }

  onLocationSelect(id: string): void {
    const loc = this.pickupLocations().find((l) => l.id === id);
    if (loc?.pickupAvailable) {
      this.selectedPickupId.set(id);
    }
  }

  private selectedPickupLocation(): PickupLocation | undefined {
    const id = this.selectedPickupId();
    return id ? this.pickupLocations().find((l) => l.id === id) : undefined;
  }

  onDeliveryAddressInput(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.deliveryAddress.set(value);
  }

  canConfirm(): boolean {
    if (this.submitting()) return false;
    if (this.fulfilmentOption() === 'pickup') {
      return !!this.selectedState() && !!this.selectedPickupLocation()?.pickupAvailable;
    }
    return this.deliveryAddress().trim().length > 0;
  }

  confirmButtonLabel(): string {
    if (this.submitting()) return 'Creating order…';
    if (this.fulfilmentOption() === 'pickup') {
      if (!this.selectedState()) return 'Select a state';
      if (this.pickupLocationsLoading()) return 'Loading merchants…';
      if (this.showNoSelectableBanner()) {
        return 'No merchant with pickup details';
      }
      if (!this.selectedPickupId()) return 'Select a pickup merchant';
      return 'Confirm Order';
    }
    if (!this.deliveryAddress().trim()) return 'Enter delivery address';
    return 'Confirm Order';
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
