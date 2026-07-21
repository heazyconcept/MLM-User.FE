import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { finalize } from 'rxjs/operators';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import {
  ReferralService,
  type DirectReferralRow,
} from '../../../services/referral.service';
import { StatusBadgeComponent } from '../../../components/status-badge/status-badge.component';
import { UiTableComponent } from '../../../components/table/table-component';

@Component({
  selector: 'app-direct-referrals',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, StatusBadgeComponent, UiTableComponent],
  templateUrl: './direct-referrals.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [
    `
      :host ::ng-deep .direct-referrals-table .p-datatable-wrapper,
      :host ::ng-deep .direct-referrals-table .p-datatable-table-container {
        border-radius: 0;
        overflow-x: auto;
        -webkit-overflow-scrolling: touch;
      }

      /* Keep a real table on all viewports (never stack into cards). */
      :host ::ng-deep .direct-referrals-table .p-datatable-table {
        display: table !important;
        width: 100%;
        border-collapse: collapse;
      }

      :host ::ng-deep .direct-referrals-table .p-datatable-thead {
        display: table-header-group !important;
      }

      :host ::ng-deep .direct-referrals-table .p-datatable-tbody {
        display: table-row-group !important;
      }

      :host ::ng-deep .direct-referrals-table .p-datatable-thead > tr,
      :host ::ng-deep .direct-referrals-table .p-datatable-tbody > tr {
        display: table-row !important;
      }

      :host ::ng-deep .direct-referrals-table .p-datatable-thead > tr > th,
      :host ::ng-deep .direct-referrals-table .p-datatable-tbody > tr > td {
        display: table-cell !important;
        vertical-align: middle;
      }

      :host ::ng-deep .direct-referrals-table .p-datatable-tbody > tr > td::before {
        content: none !important;
      }

      :host ::ng-deep .direct-referrals-table .p-datatable-tbody > tr > td:nth-child(4) {
        min-width: 8rem;
      }
    `,
  ],
})
export class DirectReferralsComponent implements OnInit {
  private referralService = inject(ReferralService);
  private destroyRef = inject(DestroyRef);
  private debounceHandle: ReturnType<typeof setTimeout> | null = null;

  rows = signal<DirectReferralRow[]>([]);
  isLoading = signal(false);
  errorMessage = signal<string | null>(null);
  searchQuery = signal('');
  page = signal(1);
  limit = signal(20);
  totalRecords = signal(0);
  totalPages = signal(1);
  hasNextPage = signal(false);
  hasPreviousPage = signal(false);

  readonly pageSizeOptions = [10, 20, 50];
  readonly tableHeaders = ['Member', 'Package', 'Status', 'Their DRs', 'Joined'];

  readonly showingFrom = computed(() =>
    this.totalRecords() === 0 ? 0 : (this.page() - 1) * this.limit() + 1,
  );
  readonly showingTo = computed(() =>
    Math.min(this.page() * this.limit(), this.totalRecords()),
  );
  readonly hasInactiveDr = computed(() =>
    this.rows().some((row) => row.status === 'INACTIVE'),
  );

  ngOnInit(): void {
    this.loadRows();
  }

  onSearchInput(value: string): void {
    this.searchQuery.set(value);

    if (this.debounceHandle) {
      clearTimeout(this.debounceHandle);
    }

    this.debounceHandle = setTimeout(() => {
      this.page.set(1);
      this.loadRows();
    }, 300);
  }

  onLimitChange(value: string): void {
    const nextLimit = Number(value);
    if (!Number.isFinite(nextLimit) || nextLimit === this.limit()) return;

    this.limit.set(nextLimit);
    this.page.set(1);
    this.loadRows();
  }

  previousPage(): void {
    if (!this.hasPreviousPage()) return;
    this.page.update((current) => Math.max(1, current - 1));
    this.loadRows();
  }

  nextPage(): void {
    if (!this.hasNextPage()) return;
    this.page.update((current) => current + 1);
    this.loadRows();
  }

  getPackageClass(pkg: string): string {
    switch (pkg.toUpperCase()) {
      case 'DIAMOND':
        return 'bg-sky-50 text-sky-600';
      case 'RUBY':
        return 'bg-rose-50 text-rose-600';
      case 'PLATINUM':
        return 'bg-violet-50 text-violet-600';
      case 'GOLD':
        return 'bg-amber-50 text-amber-600';
      case 'SILVER':
        return 'bg-slate-100 text-slate-600';
      case 'NICKEL':
        return 'bg-stone-100 text-stone-500';
      default:
        return 'bg-gray-100 text-gray-600';
    }
  }

  memberName(row: DirectReferralRow): string {
    return [row.firstName, row.lastName].filter(Boolean).join(' ') || row.username;
  }

  drProgressLabel(row: DirectReferralRow): string {
    return `${row.directReferralsCount} / 3`;
  }

  drProgressPercent(row: DirectReferralRow): number {
    return Math.min(100, Math.round((row.directReferralsCount / 3) * 100));
  }

  statusForBadge(status: string): string {
    return status;
  }

  private loadRows(): void {
    this.isLoading.set(true);
    this.errorMessage.set(null);

    this.referralService
      .getMyDirectReferrals({
        page: this.page(),
        limit: this.limit(),
        search: this.searchQuery(),
      })
      .pipe(
        finalize(() => this.isLoading.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (response) => {
          const { pagination, directReferrals } = response.data;
          this.rows.set(directReferrals);
          this.totalRecords.set(pagination.totalRecords);
          this.totalPages.set(Math.max(1, pagination.totalPages));
          this.page.set(pagination.currentPage);
          this.hasNextPage.set(pagination.hasNextPage);
          this.hasPreviousPage.set(pagination.hasPreviousPage);
        },
        error: () => {
          this.rows.set([]);
          this.totalRecords.set(0);
          this.totalPages.set(1);
          this.hasNextPage.set(false);
          this.hasPreviousPage.set(false);
          this.errorMessage.set('Could not load your direct referrals. Please try again.');
        },
      });
  }
}
