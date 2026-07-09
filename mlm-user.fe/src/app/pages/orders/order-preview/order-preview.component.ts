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
import {
  MerchantService,
  type AvailableMerchant,
  type MerchantWithStock,
  type MissingCheckoutItem,
  type SelectedMerchantAvailability,
} from '../../../services/merchant.service';
import {
  LocationSelectorComponent,
  PickupLocation,
} from '../../../components/location-selector/location-selector.component';
import { NIGERIAN_STATES } from '../../../core/constants/states.constants';
import { getDeliveryFee } from '../../../core/constants/delivery.constants';
import { formatMerchantUsernameLabel } from '../../../core/utils/merchant-display.util';
import {
  CheckoutConfirmPayload,
  PendingCheckoutData,
} from '../../../services/cart-checkout.service';
import { CheckoutGroup } from '../../../services/order.service';

interface CartLine {
  productId: string;
  productName: string;
  quantity: number;
}

type MissingItemAssignment =
  | { mode: 'pickup'; merchantId: string; merchantName: string }
  | { mode: 'delivery' };

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
  orderConfirmed = output<CheckoutConfirmPayload>();

  fulfilmentOption = this.orderService.fulfilmentOption;
  selectedPickupId = signal<string | null>(null);
  selectedState = signal<string>('');
  deliveryAddress = signal<string>('');
  deliveryState = signal<string>('');
  deliveryDisclaimerAccepted = signal(true);

  readonly nigerianStates = NIGERIAN_STATES;

  merchants = signal<AvailableMerchant[]>([]);
  pickupLocationsLoading = signal(false);
  pickupLocationsError = signal<string | null>(null);
  availabilityLoading = signal(false);
  availabilityError = signal<string | null>(null);
  selectedMerchantAvailability = signal<SelectedMerchantAvailability | null>(null);
  missingAssignments = signal<Record<string, MissingItemAssignment>>({});

  cartLines = computed(() => this.resolveCartLines(this.pendingOrderData() as PendingCheckoutData | null));

  pickupLocations = computed<PickupLocation[]>(() =>
    this.merchants().map((m) => {
      const hasStock = this.merchantHasStockForCart(m);
      return {
        id: m.id,
        name:
          formatMerchantUsernameLabel(m.username, m.businessName ?? m.name) ||
          'Unnamed Merchant',
        address: m.address || undefined,
        phoneNumber: m.phoneNumber || undefined,
        pickupAvailable: m.pickupAvailable,
        stockInStock: hasStock,
      };
    }),
  );

  hasSelectablePickup = computed(() =>
    this.pickupLocations().some((l) => l.pickupAvailable && l.stockInStock === true),
  );

  deliveryFee = computed(() => {
    const state = this.deliveryState();
    if (!state || this.fulfilmentOption() !== 'delivery') return 0;
    return getDeliveryFee(state);
  });

  emptyPickupMessage = computed(() => {
    if (!this.selectedState() || this.merchants().length > 0) return null;
    return `No active merchants in ${this.selectedState()}.`;
  });

  showNoSelectableBanner = computed(() => {
    const locs = this.pickupLocations();
    return locs.length > 0 && !this.hasSelectablePickup();
  });

  needsSplitResolution = computed(() => {
    const avail = this.selectedMerchantAvailability();
    return avail != null && !avail.canFulfillAll && avail.missingItems.length > 0;
  });

  missingItems = computed(() => this.selectedMerchantAvailability()?.missingItems ?? []);

  unresolvedMissingCount = computed(() => {
    const missing = this.missingItems();
    const assignments = this.missingAssignments();
    return missing.filter((m) => !assignments[m.productId]).length;
  });

  checkoutGroups = computed(() => this.buildCheckoutGroups());

  splitSummary = computed(() => {
    const groups = this.checkoutGroups();
    return groups.map((group, index) => ({
      index: index + 1,
      label: this.groupLabel(group),
      itemCount: group.items.reduce((sum, i) => sum + i.quantity, 0),
    }));
  });

  setOption(option: 'pickup' | 'delivery'): void {
    this.orderService.setFulfilmentOption(option);
    this.resetAvailability();
    if (option === 'delivery') {
      this.selectedPickupId.set(null);
      this.selectedState.set('');
      this.merchants.set([]);
    } else {
      this.deliveryState.set('');
      this.deliveryAddress.set('');
    }
  }

  onStateChange(state: string): void {
    this.selectedState.set(state);
    this.selectedPickupId.set(null);
    this.resetAvailability();
    if (!state) {
      this.merchants.set([]);
      this.pickupLocationsError.set(null);
      return;
    }
    this.loadMerchantsForState(state);
  }

  onDeliveryStateChange(state: string): void {
    this.deliveryState.set(state);
  }

  onDeliveryAddressInput(event: Event): void {
    this.deliveryAddress.set((event.target as HTMLInputElement).value);
  }

  onLocationSelect(id: string): void {
    const loc = this.pickupLocations().find((l) => l.id === id);
    if (!loc?.pickupAvailable || loc.stockInStock !== true) return;
    this.selectedPickupId.set(id);
    this.checkMerchantAvailability(id);
  }

  assignMissingToMerchant(item: MissingCheckoutItem, merchantId: string, fallbackName: string): void {
    const merchantName = this.getMerchantDisplayById(merchantId) || fallbackName;
    this.missingAssignments.update((prev) => ({
      ...prev,
      [item.productId]: { mode: 'pickup', merchantId, merchantName },
    }));
  }

  /** Resolve a merchant's `username(businessName)` label by id from the loaded merchant list. */
  getMerchantDisplayById(merchantId: string): string {
    const merchant = this.merchants().find((m) => m.id === merchantId);
    if (!merchant) return '';
    return formatMerchantUsernameLabel(merchant.username, merchant.businessName ?? merchant.name);
  }

  /** Label for a split-order alternate merchant, preferring embedded businessName then a lookup. */
  merchantWithStockLabel(alt: MerchantWithStock): string {
    if (alt.businessName) {
      return formatMerchantUsernameLabel(alt.username, alt.businessName);
    }
    return this.getMerchantDisplayById(alt.merchantId) || alt.username;
  }

  assignMissingToDelivery(item: MissingCheckoutItem): void {
    this.missingAssignments.update((prev) => ({
      ...prev,
      [item.productId]: { mode: 'delivery' },
    }));
  }

  productNameFor(productId: string): string {
    return this.cartLines().find((l) => l.productId === productId)?.productName ?? 'Product';
  }

  assignmentLabel(productId: string): string | null {
    const assignment = this.missingAssignments()[productId];
    if (!assignment) return null;
    if (assignment.mode === 'delivery') return 'Admin delivery';
    return `Pickup at ${assignment.merchantName}`;
  }

  formatCurrency(amount: number): string {
    return `₦${amount.toLocaleString('en-US')}`;
  }

  canConfirm(): boolean {
    if (this.submitting()) return false;

    if (this.fulfilmentOption() === 'pickup') {
      if (!this.selectedState() || !this.selectedPickupId()) return false;
      if (this.availabilityLoading()) return false;
      if (this.needsSplitResolution() && this.unresolvedMissingCount() > 0) return false;
      const groups = this.checkoutGroups();
      return groups.length > 0 && groups.every((g) => g.items.length > 0);
    }

    const address = this.deliveryAddress().trim();
    return address.length >= 10 && !!this.deliveryState();
  }

  confirmButtonLabel(): string {
    if (this.submitting()) return 'Processing checkout…';
    if (this.fulfilmentOption() === 'pickup') {
      if (!this.selectedState()) return 'Select a state';
      if (this.pickupLocationsLoading()) return 'Loading merchants…';
      if (this.availabilityLoading()) return 'Checking stock…';
      if (!this.selectedPickupId()) return 'Select a pickup merchant';
      if (this.unresolvedMissingCount() > 0) {
        return `Resolve ${this.unresolvedMissingCount()} item(s)`;
      }
      if (this.splitSummary().length > 1) return 'Confirm split order';
      return 'Confirm Order';
    }
    if (!this.deliveryState()) return 'Select a state';
    if (this.deliveryAddress().trim().length < 10) return 'Enter full delivery address';
    return 'Confirm Order';
  }

  onConfirm(): void {
    if (!this.canConfirm()) return;

    const state =
      this.fulfilmentOption() === 'pickup' ? this.selectedState() : this.deliveryState();

    const groups =
      this.fulfilmentOption() === 'delivery'
        ? this.buildDeliveryOnlyGroups()
        : this.checkoutGroups();

    if (!state || groups.length === 0) return;

    this.orderConfirmed.emit({ state, groups });
  }

  private resetAvailability(): void {
    this.selectedMerchantAvailability.set(null);
    this.missingAssignments.set({});
    this.availabilityError.set(null);
  }

  private loadMerchantsForState(state: string): void {
    this.pickupLocationsLoading.set(true);
    this.pickupLocationsError.set(null);

    this.merchantService.fetchPickupMerchantsForCart(state, this.cartLines()).subscribe({
      next: (merchants) => {
        this.merchants.set(merchants);
        this.pickupLocationsLoading.set(false);
      },
      error: (err) => {
        this.pickupLocationsError.set(
          MerchantService.extractApiErrorMessage(
            err,
            'Could not load pickup merchants for this state. Try again or choose delivery.',
          ),
        );
        this.merchants.set([]);
        this.pickupLocationsLoading.set(false);
      },
    });
  }

  private checkMerchantAvailability(merchantId: string): void {
    const state = this.selectedState();
    const lines = this.cartLines();
    if (!state || lines.length === 0) return;

    this.availabilityLoading.set(true);
    this.availabilityError.set(null);
    this.resetAvailability();
    this.selectedPickupId.set(merchantId);

    this.merchantService
      .checkCheckoutAvailability({
        state,
        items: lines.map((l) => ({ productId: l.productId, quantity: l.quantity })),
        selectedMerchantId: merchantId,
      })
      .subscribe({
        next: (res) => {
          this.merchants.set(res.merchants);
          this.selectedMerchantAvailability.set(res.selectedMerchant);
          this.missingAssignments.set({});
          this.availabilityLoading.set(false);
        },
        error: (err) => {
          this.availabilityError.set(
            MerchantService.extractApiErrorMessage(err, 'Could not verify stock for this merchant.'),
          );
          this.availabilityLoading.set(false);
        },
      });
  }

  private merchantHasStockForCart(merchant: AvailableMerchant): boolean {
    if (merchant.requestedProductInStock != null) {
      return merchant.requestedProductInStock;
    }
    return this.merchantCanFulfillCart(merchant);
  }

  private merchantCanFulfillCart(merchant: AvailableMerchant): boolean {
    const lines = this.cartLines();
    if (lines.length === 0) {
      return merchant.requestedProductInStock === true;
    }
    return lines.every((line) => {
      const product = merchant.products.find((p) => p.id === line.productId);
      if (!product) return false;
      if (product.inStock === true) return true;
      if (product.inStock === false) return false;
      if (product.stockQuantity != null) {
        return product.stockQuantity >= line.quantity;
      }
      return false;
    });
  }

  private buildDeliveryOnlyGroups(): CheckoutGroup[] {
    return [
      {
        fulfilmentMode: 'OFFLINE_DELIVERY',
        deliveryAddress: this.deliveryAddress().trim(),
        deliveryDisclaimerAccepted: this.deliveryDisclaimerAccepted(),
        items: this.cartLines().map((l) => ({
          productId: l.productId,
          quantity: l.quantity,
        })),
      },
    ];
  }

  private buildCheckoutGroups(): CheckoutGroup[] {
    const merchantId = this.selectedPickupId();
    if (!merchantId) return [];

    const avail = this.selectedMerchantAvailability();
    const lines = this.cartLines();
    if (!avail || avail.canFulfillAll) {
      return [
        {
          fulfilmentMode: 'PICKUP',
          selectedMerchantId: merchantId,
          items: lines.map((l) => ({ productId: l.productId, quantity: l.quantity })),
        },
      ];
    }

    const missingMap = new Map(
      avail.missingItems.map((m) => [m.productId, m.quantityNeeded] as const),
    );
    const assignments = this.missingAssignments();
    const primaryItems: { productId: string; quantity: number }[] = [];
    const pickupBuckets = new Map<string, { productId: string; quantity: number }[]>();
    const deliveryItems: { productId: string; quantity: number }[] = [];

    for (const line of lines) {
      const missingQty = missingMap.get(line.productId) ?? 0;
      const primaryQty = line.quantity - missingQty;
      if (primaryQty > 0) {
        primaryItems.push({ productId: line.productId, quantity: primaryQty });
      }
      if (missingQty > 0) {
        const assignment = assignments[line.productId];
        if (assignment?.mode === 'pickup') {
          const bucket = pickupBuckets.get(assignment.merchantId) ?? [];
          bucket.push({ productId: line.productId, quantity: missingQty });
          pickupBuckets.set(assignment.merchantId, bucket);
        } else if (assignment?.mode === 'delivery') {
          deliveryItems.push({ productId: line.productId, quantity: missingQty });
        }
      }
    }

    const groups: CheckoutGroup[] = [];
    if (primaryItems.length > 0) {
      groups.push({
        fulfilmentMode: 'PICKUP',
        selectedMerchantId: merchantId,
        items: primaryItems,
      });
    }
    for (const [mid, items] of pickupBuckets) {
      groups.push({ fulfilmentMode: 'PICKUP', selectedMerchantId: mid, items });
    }
    if (deliveryItems.length > 0) {
      groups.push({
        fulfilmentMode: 'OFFLINE_DELIVERY',
        deliveryAddress: this.buildAdminDeliveryAddress(),
        deliveryDisclaimerAccepted: true,
        items: deliveryItems,
      });
    }
    return groups;
  }

  private buildAdminDeliveryAddress(): string {
    const state = this.selectedState();
    return `Admin delivery — ${state} (fulfilled by Segulah)`;
  }

  private groupLabel(group: CheckoutGroup): string {
    if (group.fulfilmentMode === 'OFFLINE_DELIVERY') return 'Admin delivery';
    const label = this.getMerchantDisplayById(group.selectedMerchantId ?? '');
    return `Pickup — ${label || 'Merchant'}`;
  }

  private resolveCartLines(orderData: PendingCheckoutData | null): CartLine[] {
    if (!orderData) return [];

    if (orderData.mode === 'cart') {
      return orderData.items.map((line) => ({
        productId: line.productId,
        productName: line.product.name,
        quantity: line.quantity,
      }));
    }

    if (orderData.mode === 'single' && orderData.product) {
      return [
        {
          productId: orderData.product.id,
          productName: orderData.product.name,
          quantity: orderData.quantity > 0 ? orderData.quantity : 1,
        },
      ];
    }

    return [];
  }
}
