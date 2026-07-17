import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { finalize } from 'rxjs/operators';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import {
  ReferralService,
  type Pending3DrDownlineRow,
} from '../../../services/referral.service';
import { StatusBadgeComponent } from '../../../components/status-badge/status-badge.component';
import { UiTableComponent } from '../../../components/table/table-component';

@Component({
  selector: 'app-pending-leaders',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, StatusBadgeComponent, UiTableComponent],
  templateUrl: './pending-leaders.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [
    `
      :host ::ng-deep .pending-leaders-table .p-datatable-wrapper {
        border-radius: 0;
      }

      :host ::ng-deep .pending-leaders-table .p-datatable-tbody > tr > td:first-child {
        font-weight: 500;
      }

      :host ::ng-deep .pending-leaders-table .p-datatable-tbody > tr > td:nth-child(2) {
        min-width: 12rem;
      }
    `,
  ],
})
export class PendingLeadersComponent implements OnInit {
  private referralService = inject(ReferralService);
  private destroyRef = inject(DestroyRef);
  private debounceHandle: ReturnType<typeof setTimeout> | null = null;

  rows = signal<Pending3DrDownlineRow[]>([]);
  isLoading = signal(false);
  errorMessage = signal<string | null>(null);
  searchQuery = signal('');
  depth = signal<number | 'all'>('all');
  page = signal(1);
  limit = signal(20);
  totalRecords = signal(0);
  totalPages = signal(1);
  hasNextPage = signal(false);
  hasPreviousPage = signal(false);

  readonly depthOptions = Array.from({ length: 13 }, (_, index) => index + 1);
  readonly pageSizeOptions = [10, 20, 50];
  readonly tableHeaders = [
    'Member',
    'DR Progress',
    'Package',
    'Rank',
    'Stage',
    'Depth',
    'Team',
    'Joined',
    'Account',
    'Status',
  ];

  readonly showingFrom = computed(() =>
    this.totalRecords() === 0 ? 0 : (this.page() - 1) * this.limit() + 1,
  );
  readonly showingTo = computed(() =>
    Math.min(this.page() * this.limit(), this.totalRecords()),
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

  onDepthChange(value: string): void {
    this.depth.set(value === 'all' ? 'all' : Number(value));
    this.page.set(1);
    this.loadRows();
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

  memberName(row: Pending3DrDownlineRow): string {
    return [row.firstName, row.lastName].filter(Boolean).join(' ') || row.username;
  }

  drProgressLabel(row: Pending3DrDownlineRow): string {
    return `${row.directReferralsCount} / 3 DR`;
  }

  drRemainingLabel(row: Pending3DrDownlineRow): string {
    return row.drRemaining === 1 ? '1 more DR needed' : `${row.drRemaining} more DRs needed`;
  }

  drProgressPercent(row: Pending3DrDownlineRow): number {
    return Math.min(100, Math.round((row.directReferralsCount / 3) * 100));
  }

  accountStatus(row: Pending3DrDownlineRow): string {
    return row.isActive ? 'active' : 'inactive';
  }

  private loadRows(): void {
    this.isLoading.set(true);
    this.errorMessage.set(null);
    const selectedDepth = this.depth();

    this.referralService
      .getDownlinesPending3Dr({
        page: this.page(),
        limit: this.limit(),
        search: this.searchQuery(),
        depth: selectedDepth === 'all' ? undefined : selectedDepth,
      })
      .pipe(
        finalize(() => this.isLoading.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (response) => {
          const { pagination, downlines } = response.data;
          this.rows.set(downlines);
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
          this.errorMessage.set('Could not load pending leaders. Please try again.');
        },
      });
  }
}
