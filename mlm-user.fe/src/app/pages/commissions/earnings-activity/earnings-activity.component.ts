import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { EarningsActivityService } from '../../../services/earnings-activity.service';

import { UiTableComponent } from '../../../components/table/table-component';

@Component({
  selector: 'app-earnings-activity',
  standalone: true,
  imports: [CommonModule, UiTableComponent],
  templateUrl: './earnings-activity.component.html'
})
export class EarningsActivityComponent implements OnInit {
  readonly activityService = inject(EarningsActivityService);

  activeTab = signal<'ledger' | 'pv'>('ledger');
  fromDate  = signal('');
  toDate    = signal('');

  skeletonRows = Array(10);

  ngOnInit(): void {
    this.activityService.fetchActivity();
  }

  applyFilter(): void {
    this.activityService.fetchActivity({
      from: this.fromDate() || undefined,
      to:   this.toDate()   || undefined
    });
  }

  clearFilter(): void {
    this.fromDate.set('');
    this.toDate.set('');
    this.activityService.fetchActivity();
  }

  /* ── Tab-specific pagination ────────────────────────────── */

  nextPage(): void {
    if (this.activeTab() === 'ledger') {
      this.activityService.ledgerNextPage();
    } else {
      this.activityService.pvNextPage();
    }
  }

  prevPage(): void {
    if (this.activeTab() === 'ledger') {
      this.activityService.ledgerPrevPage();
    } else {
      this.activityService.pvPrevPage();
    }
  }

  currentPage(): number {
    return this.activeTab() === 'ledger'
      ? this.activityService.ledgerPage()
      : this.activityService.pvPage();
  }

  totalPages(): number {
    return this.activeTab() === 'ledger'
      ? this.activityService.ledgerTotalPages()
      : this.activityService.pvTotalPages();
  }

  hasMore(): boolean {
    return this.activeTab() === 'ledger'
      ? this.activityService.ledgerHasMore()
      : this.activityService.pvHasMore();
  }

  totalItems(): number {
    return this.activeTab() === 'ledger'
      ? this.activityService.totalLedger()
      : this.activityService.totalPv();
  }

  rangeStart(): number {
    return (this.currentPage() - 1) * this.activityService.pageSize + 1;
  }

  rangeEnd(): number {
    const items = this.activeTab() === 'ledger'
      ? this.activityService.ledgerItems()
      : this.activityService.pvItems();
    return (this.currentPage() - 1) * this.activityService.pageSize + items.length;
  }
}
