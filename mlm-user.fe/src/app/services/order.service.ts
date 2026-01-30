import { Injectable, signal, computed } from '@angular/core';

export type OrderFulfilmentMethod = 'pickup' | 'delivery';

export type OrderStatus =
  | 'Pending'
  | 'Processing'
  | 'Ready for Pickup'
  | 'Out for Delivery'
  | 'Delivered'
  | 'Cancelled';

export interface OrderItem {
  name: string;
  quantity: number;
  price: number;
}

export interface Order {
  id: string;
  date: string;
  items: OrderItem[];
  total: number;
  currency: 'NGN' | 'USD';
  fulfilmentMethod: OrderFulfilmentMethod;
  status: OrderStatus;
  paymentMethod?: string;
  deliveryAddress?: string;
  deliveryFee?: number;
  pickupLocationName?: string;
  pickupLocationDistance?: string;
}

const ORDER_STATUSES: OrderStatus[] = [
  'Pending',
  'Processing',
  'Ready for Pickup',
  'Out for Delivery',
  'Delivered',
  'Cancelled'
];

const MOCK_ORDERS: Order[] = [
  {
    id: 'ORD-001',
    date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    items: [
      { name: 'Premium Multivitamin Complex', quantity: 2, price: 15000 },
      { name: 'Omega-3 Fish Oil Capsules', quantity: 1, price: 12000 }
    ],
    total: 45000,
    currency: 'NGN',
    fulfilmentMethod: 'delivery',
    status: 'Delivered',
    paymentMethod: 'Cash',
    deliveryAddress: '12 Marina Street, Lagos Island, Lagos',
    deliveryFee: 1500
  },
  {
    id: 'ORD-002',
    date: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    items: [
      { name: 'Luxury Skincare Set', quantity: 1, price: 45000 }
    ],
    total: 45000,
    currency: 'NGN',
    fulfilmentMethod: 'pickup',
    status: 'Ready for Pickup',
    paymentMethod: 'Voucher',
    pickupLocationName: 'Lagos Central Store',
    pickupLocationDistance: '2.5 km'
  },
  {
    id: 'ORD-003',
    date: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
    items: [
      { name: 'Smart Fitness Tracker', quantity: 1, price: 35000 },
      { name: 'Organic Protein Powder', quantity: 1, price: 22500 }
    ],
    total: 59000,
    currency: 'NGN',
    fulfilmentMethod: 'delivery',
    status: 'Out for Delivery',
    paymentMethod: 'Cash',
    deliveryAddress: '45 Adeola Odeku, Victoria Island, Lagos',
    deliveryFee: 2000
  },
  {
    id: 'ORD-004',
    date: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(),
    items: [
      { name: 'Monthly Wellness Subscription', quantity: 1, price: 25000 }
    ],
    total: 25000,
    currency: 'NGN',
    fulfilmentMethod: 'delivery',
    status: 'Processing',
    paymentMethod: 'Autoship',
    deliveryAddress: '8 Bourdillon Road, Ikoyi, Lagos',
    deliveryFee: 1000
  },
  {
    id: 'ORD-005',
    date: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    items: [
      { name: 'Essential Oil Diffuser Set', quantity: 1, price: 18500 }
    ],
    total: 18500,
    currency: 'NGN',
    fulfilmentMethod: 'pickup',
    status: 'Cancelled',
    paymentMethod: 'Cash',
    pickupLocationName: 'Ikeja Store',
    pickupLocationDistance: '5.1 km'
  },
  {
    id: 'ORD-006',
    date: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
    items: [
      { name: 'Collagen Beauty Powder', quantity: 2, price: 19500 }
    ],
    total: 39000,
    currency: 'NGN',
    fulfilmentMethod: 'delivery',
    status: 'Pending',
    paymentMethod: 'Voucher',
    deliveryAddress: '22 Ajose Adeogun, Victoria Island, Lagos',
    deliveryFee: 1500
  }
];

@Injectable({
  providedIn: 'root'
})
export class OrderService {
  private listState = signal<Order[]>([]);
  private selectedOrderState = signal<Order | null>(null);
  private fulfilmentOptionState = signal<'pickup' | 'delivery'>('delivery');
  private searchQueryState = signal<string>('');
  private statusFilterState = signal<string>('');

  readonly list = this.listState.asReadonly();
  readonly selectedOrder = this.selectedOrderState.asReadonly();
  readonly fulfilmentOption = this.fulfilmentOptionState.asReadonly();
  readonly searchQuery = this.searchQueryState.asReadonly();
  readonly statusFilter = this.statusFilterState.asReadonly();

  readonly filteredOrders = computed(() => {
    let result = this.listState();
    const query = this.searchQueryState().toLowerCase().trim();
    const statusFilter = this.statusFilterState();
    if (query) {
      result = result.filter(
        (o) =>
          o.id.toLowerCase().includes(query) ||
          o.items.some((i) => i.name.toLowerCase().includes(query))
      );
    }
    if (statusFilter) {
      result = result.filter((o) => o.status === statusFilter);
    }
    return result;
  });

  readonly orderStatuses = ORDER_STATUSES;

  setSearchQuery(query: string): void {
    this.searchQueryState.set(query);
  }

  setStatusFilter(status: string): void {
    this.statusFilterState.set(status);
  }

  selectOrder(order: Order | null): void {
    this.selectedOrderState.set(order);
  }

  setFulfilmentOption(option: 'pickup' | 'delivery'): void {
    this.fulfilmentOptionState.set(option);
  }

  getOrderById(id: string): Order | undefined {
    return this.listState().find((o) => o.id === id);
  }

  loadOrders(): void {
    this.listState.set([...MOCK_ORDERS]);
  }

  clearFilters(): void {
    this.searchQueryState.set('');
    this.statusFilterState.set('');
  }
}
