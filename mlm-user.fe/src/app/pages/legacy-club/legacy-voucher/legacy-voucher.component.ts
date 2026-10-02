import { Component, ChangeDetectionStrategy, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { LegacyClubService } from '../../../services/legacy-club.service';
import { LegacyVoucherLedgerItem } from '../../../core/models/legacy-club.models';
import { formatLegacyMoney } from '../../../core/utils/legacy-money.util';
import { LegacyPageShellComponent } from '../components/legacy-page-shell.component';
import { LegacyPageHeaderComponent } from '../components/legacy-page-header.component';
import { LegacyPanelComponent } from '../components/legacy-panel.component';
import { LegacyBalanceBannerComponent } from '../components/legacy-balance-banner.component';
import { LegacyAddFundsComponent } from '../components/legacy-add-funds.component';

@Component({
  selector: 'app-legacy-voucher',
  imports: [
    CommonModule,
    RouterLink,
    ButtonModule,
    LegacyPageShellComponent,
    LegacyPageHeaderComponent,
    LegacyPanelComponent,
    LegacyBalanceBannerComponent,
    LegacyAddFundsComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-legacy-page-shell>
      <div class="flex flex-col gap-8">
        <app-legacy-page-header
          title="Legacy product voucher"
          subtitle="This is not your network Product Voucher. It is only for the Legacy Club marketplace."
          backLink="/legacy"
          backLabel="Legacy Club"
        />

        <app-legacy-panel title="Voucher balance">
          <app-legacy-balance-banner
            label="Legacy product voucher"
            [amount]="money(balance())"
            hint="Use this balance when paying in the Legacy marketplace."
          />
        </app-legacy-panel>

        <app-legacy-add-funds destination="LEGACY_VOUCHER" (transferred)="refresh()" />

        <div [class]="voucherGridClass()">
          @if (canShop()) {
            <app-legacy-panel title="Legacy marketplace">
              <p class="text-sm leading-relaxed text-mlm-secondary">
                Weekly membership commission also credits this voucher. Product purchases do not pay
                commission — you receive PV on every product purchased by you and your direct
                referrals.
              </p>
              <a routerLink="/legacy/shop" class="mt-6 block">
                <p-button label="Legacy marketplace" styleClass="w-full" />
              </a>
            </app-legacy-panel>
          }

          <app-legacy-panel title="Recent activity" [padded]="false">
            @if (items().length === 0) {
              <p class="px-5 py-8 text-sm text-mlm-secondary sm:px-6">No activity yet.</p>
            } @else {
              <ul class="divide-y divide-gray-100">
                @for (item of items(); track item.id) {
                  <li class="flex items-start justify-between gap-3 px-5 py-4 text-sm sm:px-6">
                    <div>
                      <p class="font-medium text-mlm-text">{{ item.description }}</p>
                      <p class="text-xs text-mlm-secondary">{{ item.date | date: 'medium' }}</p>
                    </div>
                    <span
                      class="font-semibold tabular-nums"
                      [class]="item.type === 'Credit' ? 'text-emerald-700' : 'text-mlm-text'"
                    >
                      {{ item.type === 'Credit' ? '+' : '−' }}{{ money(item.amount) }}
                    </span>
                  </li>
                }
              </ul>
            }
          </app-legacy-panel>
        </div>
      </div>
    </app-legacy-page-shell>
  `,
})
export class LegacyVoucherComponent implements OnInit {
  private legacyClub = inject(LegacyClubService);

  balance = signal(0);
  items = signal<LegacyVoucherLedgerItem[]>([]);
  canShop = this.legacyClub.canShopProducts;
  voucherGridClass = computed(() =>
    this.canShop() ? 'grid gap-6 lg:grid-cols-2 lg:gap-8' : 'grid gap-6',
  );

  ngOnInit(): void {
    this.refresh();
  }

  refresh(): void {
    this.legacyClub.loadMe().subscribe();
    this.legacyClub.getVoucher().subscribe({
      next: (res) => {
        this.balance.set(res.balance);
        this.items.set(res.items ?? []);
      },
    });
  }

  money(amount: number): string {
    return formatLegacyMoney(amount, this.legacyClub.me()?.currency ?? 'NGN');
  }
}
