import { Component, ChangeDetectionStrategy, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { LegacyCartService } from '../../../services/legacy-cart.service';
import { LegacyClubService } from '../../../services/legacy-club.service';
import { formatLegacyMoney } from '../../../core/utils/legacy-money.util';
import {
  LegacyShopMode,
  resolveLegacyShopMode,
} from '../../../core/models/legacy-club.models';

const ACTIVE_SHOP_MODES: LegacyShopMode[] = ['AUTOSHIP', 'UPGRADE', 'REACTIVATE'];

@Component({
  selector: 'app-legacy-cart',
  imports: [CommonModule, RouterLink, ButtonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="min-h-screen bg-mlm-background">
      <main class="py-8">
        <div class="mx-auto max-w-7xl space-y-6 px-4 sm:px-6 lg:px-8">
      <a routerLink="/legacy/shop" class="text-sm font-medium text-mlm-primary hover:underline"
        >← Legacy marketplace</a
      >
      <h1 class="text-2xl font-bold text-mlm-text">Legacy cart</h1>

      @if (cart.isEmpty()) {
        <div class="rounded-2xl border border-gray-100 bg-white px-6 py-10 text-center">
          <p class="text-mlm-secondary">Your Legacy cart is empty.</p>
          <a routerLink="/legacy/shop" class="mt-5 inline-block">
            <p-button label="Continue shopping" />
          </a>
        </div>
      } @else {
        <div class="grid gap-5 lg:grid-cols-5">
        <div class="space-y-3 lg:col-span-3">
          @for (line of cart.items(); track line.productId) {
            <div
              class="flex flex-col gap-4 rounded-2xl border border-gray-100 bg-white p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6"
            >
              <div>
                <p class="font-semibold text-mlm-text">{{ line.name }}</p>
                <p class="text-sm text-mlm-secondary">
                  {{ money(line.unitPrice) }} × {{ line.quantity }} · {{ line.pv * line.quantity }} PV
                </p>
              </div>
              <div class="flex items-center gap-2">
                <p-button
                  icon="pi pi-minus"
                  [rounded]="true"
                  [text]="true"
                  size="small"
                  (onClick)="changeQty(line.productId, line.quantity - 1)"
                />
                <span class="w-6 text-center text-sm font-medium">{{ line.quantity }}</span>
                <p-button
                  icon="pi pi-plus"
                  [rounded]="true"
                  [text]="true"
                  size="small"
                  (onClick)="changeQty(line.productId, line.quantity + 1)"
                />
                <p-button
                  icon="pi pi-trash"
                  [rounded]="true"
                  [text]="true"
                  severity="danger"
                  size="small"
                  (onClick)="changeQty(line.productId, 0)"
                />
              </div>
            </div>
          }
        </div>

        <div class="rounded-2xl border border-gray-100 bg-white p-6 sm:p-7 space-y-3 lg:col-span-2 h-fit">
          <div class="flex justify-between text-sm">
            <span class="text-mlm-secondary">Subtotal</span>
            <span class="font-semibold text-mlm-text">{{ money(cart.subtotal()) }}</span>
          </div>

          @if (shopMode() === 'JOIN') {
            <div class="flex justify-between text-sm">
              <span class="text-mlm-secondary">Required for {{ pendingPackage() }}</span>
              <span class="font-semibold text-mlm-text">{{ money(cart.purchaseRequired()) }}</span>
            </div>
            @if (!cart.canCheckout()) {
              <p class="text-sm text-amber-800">
                Add products worth at least {{ money(cart.remaining()) }} more to join as
                {{ pendingPackage() }}.
              </p>
            } @else {
              <p class="text-sm text-emerald-800">
                You can add more than the package amount. Extra products still earn PV.
              </p>
            }
          } @else if (shopMode() === 'AUTOSHIP') {
            <div class="flex justify-between text-sm">
              <span class="text-mlm-secondary">Autoship minimum</span>
              <span class="font-semibold text-mlm-text">{{ money(cart.autoshipRequired()) }}</span>
            </div>
            @if (cart.autoshipWarnBelowUnit()) {
              <p class="text-sm text-amber-800">
                Cart is below one Autoship unit. You can still checkout — this will be PV only and
                will not release waiting months.
              </p>
            } @else if (cart.autoshipReleaseUnits() > 0) {
              <p class="text-sm text-emerald-800">
                This checkout can release {{ cart.autoshipReleaseUnits() }} waiting month(s).
              </p>
            } @else {
              <p class="text-sm text-mlm-secondary">
                Autoship — no Instant Commission. Pay with Legacy product voucher.
              </p>
            }
          } @else if (shopMode() === 'UPGRADE' || shopMode() === 'REACTIVATE') {
            <div class="flex justify-between text-sm">
              <span class="text-mlm-secondary">
                {{ shopMode() === 'UPGRADE' ? 'Upgrade difference' : 'Reactivate package' }}
              </span>
              <span class="font-semibold text-mlm-text">{{ money(cart.purchaseRequired()) }}</span>
            </div>
            @if (!cart.canCheckout()) {
              <p class="text-sm text-amber-800">
                Add products worth at least {{ money(cart.remaining()) }} more.
              </p>
            } @else {
              <p class="text-sm text-emerald-800">
                Ready to checkout. Instant goes to your Legacy account.
              </p>
            }
            @if (cart.autoshipReleaseUnits() > 0) {
              <p class="text-xs text-mlm-secondary">
                This basket can also release {{ cart.autoshipReleaseUnits() }} waiting month(s).
              </p>
            }
          }

          <p-button
            class="mt-3"
            label="Checkout"
            styleClass="w-full"
            [disabled]="!cart.canCheckout()"
            (onClick)="goCheckout()"
          />
          <p-button
            label="Clear cart"
            [text]="true"
            styleClass="w-full"
            (onClick)="clear()"
          />
        </div>
        </div>
      }
        </div>
      </main>
    </div>
  `,
})
export class LegacyCartComponent implements OnInit {
  cart = inject(LegacyCartService);
  private legacyClub = inject(LegacyClubService);
  private router = inject(Router);

  pendingPackage = signal('VIP');
  shopMode = computed(() => resolveLegacyShopMode(this.legacyClub.me()));

  ngOnInit(): void {
    this.legacyClub.loadMe().subscribe({
      next: (me) => {
        const mode = resolveLegacyShopMode(me);
        if (me?.status === 'ACTIVE') {
          if (!ACTIVE_SHOP_MODES.includes(mode)) {
            void this.router.navigate(['/legacy']);
            return;
          }
          this.ensureFloors(mode);
          this.cart.refresh().subscribe({ error: () => undefined });
          return;
        }
        if (me?.status !== 'PENDING_JOIN') {
          void this.router.navigate(['/legacy/join']);
          return;
        }
        this.pendingPackage.set(me.pendingJoin?.package ?? 'VIP');
        this.cart.refresh().subscribe({ error: () => undefined });
      },
    });
  }

  money(amount: number): string {
    return formatLegacyMoney(amount, this.legacyClub.me()?.currency ?? 'NGN');
  }

  changeQty(productId: string, quantity: number): void {
    this.cart.setQuantity(productId, quantity).subscribe({ error: () => undefined });
  }

  clear(): void {
    this.cart.clear().subscribe();
  }

  goCheckout(): void {
    void this.router.navigate(['/legacy/checkout']);
  }

  private ensureFloors(mode: LegacyShopMode): void {
    if (mode === 'UPGRADE' && this.cart.purchaseRequired() <= 0) {
      // Floor should already be set from upgrade start; leave as-is if missing
      return;
    }
    if (mode === 'REACTIVATE' && this.cart.purchaseRequired() <= 0) {
      const pkg = this.legacyClub.me()?.membership?.package;
      if (!pkg) return;
      this.legacyClub.getPackages().subscribe({
        next: (res) => {
          const found = res.packages.find((p) => p.code === pkg);
          if (found) this.cart.setReactivateFloor(found.purchaseAmount);
        },
      });
    }
  }
}
