import { Component, ChangeDetectionStrategy, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { LegacyClubService } from '../../../services/legacy-club.service';
import { formatLegacyMoney } from '../../../core/utils/legacy-money.util';
import { LegacyPageShellComponent } from '../components/legacy-page-shell.component';
import { LegacyPageHeaderComponent } from '../components/legacy-page-header.component';
import { LegacyPanelComponent } from '../components/legacy-panel.component';
import { LegacyBalanceBannerComponent } from '../components/legacy-balance-banner.component';

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

        <div class="grid gap-6 lg:grid-cols-2 lg:gap-8">
          <app-legacy-panel title="Voucher balance">
            <app-legacy-balance-banner
              label="Legacy product voucher"
              [amount]="money(balance())"
              hint="Use this balance when paying in the Legacy marketplace."
            />
          </app-legacy-panel>

          <app-legacy-panel title="Legacy marketplace">
            <p class="text-sm leading-relaxed text-mlm-secondary">
              Instant commission from product purchases is credited to this voucher.
            </p>
            <a routerLink="/legacy/shop" class="mt-6 block">
              <p-button label="Legacy marketplace" styleClass="w-full" />
            </a>
          </app-legacy-panel>
        </div>
      </div>
    </app-legacy-page-shell>
  `,
})
export class LegacyVoucherComponent implements OnInit {
  private legacyClub = inject(LegacyClubService);

  balance = signal(0);

  ngOnInit(): void {
    this.refresh();
  }

  refresh(): void {
    this.legacyClub.loadMe().subscribe();
    this.legacyClub.getVoucher().subscribe({
      next: (res) => this.balance.set(res.balance),
    });
  }

  money(amount: number): string {
    return formatLegacyMoney(amount, this.legacyClub.me()?.currency ?? 'NGN');
  }
}
