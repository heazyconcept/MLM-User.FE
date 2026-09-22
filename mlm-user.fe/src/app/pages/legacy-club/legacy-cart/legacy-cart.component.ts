import { Component, ChangeDetectionStrategy, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { LegacyCartService } from '../../../services/legacy-cart.service';
import { LegacyClubService } from '../../../services/legacy-club.service';
import { formatLegacyMoney } from '../../../core/utils/legacy-money.util';
import { resolveLegacyShopMode } from '../../../core/models/legacy-club.models';
import { LegacyPageShellComponent } from '../components/legacy-page-shell.component';
import { LegacyPageHeaderComponent } from '../components/legacy-page-header.component';
import { LegacyPanelComponent } from '../components/legacy-panel.component';

@Component({
  selector: 'app-legacy-cart',
  imports: [
    CommonModule,
    RouterLink,
    ButtonModule,
    LegacyPageShellComponent,
    LegacyPageHeaderComponent,
    LegacyPanelComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-legacy-page-shell>
      <app-legacy-page-header
        title="Legacy cart"
        subtitle="Review items before checkout with your Legacy product voucher."
        backLink="/legacy/shop"
        backLabel="Legacy marketplace"
      />

      @if (cart.isEmpty()) {
        <app-legacy-panel>
          <div class="py-6 text-center">
            <p class="text-mlm-secondary">Your Legacy cart is empty.</p>
            <a routerLink="/legacy/shop" class="mt-5 inline-block">
              <p-button label="Continue shopping" />
            </a>
          </div>
        </app-legacy-panel>
      } @else {
        <div class="grid gap-6 lg:grid-cols-5">
        <div class="space-y-3 lg:col-span-3">
          @for (line of cart.items(); track line.productId) {
            <div
              class="flex flex-col gap-4 rounded-xl border border-gray-200 bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:p-6"
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

        <div class="lg:col-span-2 h-fit">
        <app-legacy-panel title="Order summary">
          <div class="flex justify-between text-sm">
            <span class="text-mlm-secondary">Subtotal</span>
            <span class="font-semibold text-mlm-text">{{ money(cart.subtotal()) }}</span>
          </div>

          <p class="text-sm text-mlm-secondary">
            Pay with Legacy product voucher only. No membership Instant on product checkout.
          </p>
          @if (voucherHint() > 0) {
            <p class="text-xs text-mlm-secondary">
              Your weekly voucher credit is {{ money(voucherHint()) }}.
            </p>
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
        </app-legacy-panel>
        </div>
        </div>
      }
    </app-legacy-page-shell>
  `,
})
export class LegacyCartComponent implements OnInit {
  cart = inject(LegacyCartService);
  private legacyClub = inject(LegacyClubService);
  private router = inject(Router);

  voucherHint = computed(() => this.cart.weeklyVoucherHintAmount());

  ngOnInit(): void {
    this.legacyClub.loadMe().subscribe({
      next: (me) => {
        if (resolveLegacyShopMode(me) !== 'SHOP') {
          void this.router.navigate(['/legacy/home']);
          return;
        }
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
}
