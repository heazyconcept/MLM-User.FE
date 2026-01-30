import { Injectable, signal, computed } from '@angular/core';
import type { Order } from './order.service';

export type InventoryStockStatus = 'In Stock' | 'Low' | 'Out';

export interface MerchantInventoryItem {
  productId: string;
  productName: string;
  stockQuantity: number;
  status: InventoryStockStatus;
}

export type DeliveryStatus = 'Pending' | 'Assigned' | 'In Transit' | 'Delivered';

export interface MerchantDelivery {
  id: string;
  orderId: string;
  status: DeliveryStatus;
  customerName: string;
  address?: string;
  phone?: string;
}

export interface MerchantEarnings {
  totalEarnings: number;
  salesCommissions: number;
  deliveryBonuses: number;
}

const LOW_STOCK_THRESHOLD = 5;

function deriveStatus(qty: number): InventoryStockStatus {
  if (qty <= 0) return 'Out';
  if (qty < LOW_STOCK_THRESHOLD) return 'Low';
  return 'In Stock';
}

const MOCK_INVENTORY: MerchantInventoryItem[] = [
  { productId: '1', productName: 'Premium Multivitamin Complex', stockQuantity: 42, status: 'In Stock' },
  { productId: '2', productName: 'Organic Protein Powder', stockQuantity: 18, status: 'In Stock' },
  { productId: '3', productName: 'Luxury Skincare Set', stockQuantity: 4, status: 'Low' },
  { productId: '4', productName: 'Smart Fitness Tracker', stockQuantity: 0, status: 'Out' },
  { productId: '5', productName: 'Omega-3 Fish Oil Capsules', stockQuantity: 56, status: 'In Stock' },
  { productId: '6', productName: 'Essential Oil Diffuser Set', stockQuantity: 12, status: 'In Stock' }
];

const MOCK_MERCHANT_ORDERS: Order[] = [
  {
    id: 'ORD-002',
    date: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    items: [{ name: 'Luxury Skincare Set', quantity: 1, price: 45000 }],
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
    items: [{ name: 'Monthly Wellness Subscription', quantity: 1, price: 25000 }],
    total: 25000,
    currency: 'NGN',
    fulfilmentMethod: 'delivery',
    status: 'Processing',
    paymentMethod: 'Autoship',
    deliveryAddress: '8 Bourdillon Road, Ikoyi, Lagos',
    deliveryFee: 1000
  },
  {
    id: 'ORD-006',
    date: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
    items: [{ name: 'Collagen Beauty Powder', quantity: 2, price: 19500 }],
    total: 39000,
    currency: 'NGN',
    fulfilmentMethod: 'delivery',
    status: 'Pending',
    paymentMethod: 'Voucher',
    deliveryAddress: '22 Ajose Adeogun, Victoria Island, Lagos',
    deliveryFee: 1500
  }
];

const MOCK_DELIVERIES: MerchantDelivery[] = [
  { id: 'DEL-1', orderId: 'ORD-003', status: 'In Transit', customerName: 'Jane Smith', address: '45 Adeola Odeku, Victoria Island, Lagos', phone: '+234 800 000 0001' },
  { id: 'DEL-2', orderId: 'ORD-004', status: 'Assigned', customerName: 'Tunde Adeyemi', address: '8 Bourdillon Road, Ikoyi, Lagos', phone: '+234 800 000 0002' },
  { id: 'DEL-3', orderId: 'ORD-006', status: 'Pending', customerName: 'Amaka Okonkwo', address: '22 Ajose Adeogun, Victoria Island, Lagos', phone: '+234 800 000 0003' }
];

const MOCK_EARNINGS: MerchantEarnings = {
  totalEarnings: 125000,
  salesCommissions: 87500,
  deliveryBonuses: 37500
};

@Injectable({
  providedIn: 'root'
})
export class MerchantService {
  private inventoryState = signal<MerchantInventoryItem[]>(MOCK_INVENTORY.map((i) => ({ ...i })));
  private ordersState = signal<Order[]>(MOCK_MERCHANT_ORDERS.map((o) => ({ ...o })));
  private deliveriesState = signal<MerchantDelivery[]>(MOCK_DELIVERIES.map((d) => ({ ...d })));
  private earningsState = signal<MerchantEarnings>({ ...MOCK_EARNINGS });

  readonly inventory = this.inventoryState.asReadonly();
  readonly orders = this.ordersState.asReadonly();
  readonly deliveries = this.deliveriesState.asReadonly();
  readonly earnings = this.earningsState.asReadonly();

  readonly totalMerchantSales = computed(() => {
    return this.ordersState().reduce((sum, o) => sum + o.total, 0);
  });

  readonly pendingFulfilmentsCount = computed(() => {
    return this.ordersState().filter(
      (o) => o.status === 'Pending' || o.status === 'Processing' || o.status === 'Ready for Pickup' || o.status === 'Out for Delivery'
    ).length;
  });

  readonly inventorySummary = computed(() => {
    const inv = this.inventoryState();
    const total = inv.length;
    const lowOrOut = inv.filter((i) => i.status === 'Low' || i.status === 'Out').length;
    return { total, lowOrOut };
  });

  setStock(productId: string, quantity: number): void {
    this.inventoryState.update((list) =>
      list.map((item) =>
        item.productId === productId
          ? { ...item, stockQuantity: Math.max(0, quantity), status: deriveStatus(quantity) }
          : item
      )
    );
  }

  updateOrderStatus(orderId: string, status: Order['status']): void {
    this.ordersState.update((list) =>
      list.map((o) => (o.id === orderId ? { ...o, status } : o))
    );
  }

  getOrderById(id: string): Order | undefined {
    return this.ordersState().find((o) => o.id === id);
  }
}
