import { Component, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { OrderService } from '../../../services/order.service';
import { LocationSelectorComponent, PickupLocation } from '../../../components/location-selector/location-selector.component';

const MOCK_PICKUP_LOCATIONS: PickupLocation[] = [
  { id: 'loc-1', name: 'Lagos Central Store', distance: '2.5 km' },
  { id: 'loc-2', name: 'Ikeja Store', distance: '5.1 km' },
  { id: 'loc-3', name: 'Victoria Island Hub', distance: '3.2 km' }
];

@Component({
  selector: 'app-order-preview',
  imports: [CommonModule, LocationSelectorComponent],
  templateUrl: './order-preview.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class OrderPreviewComponent {
  private orderService = inject(OrderService);
  private router = inject(Router);

  fulfilmentOption = this.orderService.fulfilmentOption;
  selectedPickupId = signal<string | null>(null);
  deliveryAddress = signal<string>('12 Marina Street, Lagos Island, Lagos');
  deliveryFee = 1500;

  pickupLocations = MOCK_PICKUP_LOCATIONS;

  setOption(option: 'pickup' | 'delivery'): void {
    this.orderService.setFulfilmentOption(option);
  }

  onLocationSelect(id: string): void {
    this.selectedPickupId.set(id);
  }

  onDeliveryAddressInput(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.deliveryAddress.set(value);
  }

  onConfirm(): void {
    this.router.navigate(['/orders']);
  }
}
