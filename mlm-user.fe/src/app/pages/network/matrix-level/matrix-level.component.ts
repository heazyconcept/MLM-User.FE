import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MessageService } from 'primeng/api';
import { TableModule } from 'primeng/table';
import { SkeletonModule } from 'primeng/skeleton';
import { StatusBadgeComponent } from '../../../components/status-badge/status-badge.component';
import { ReferralService, type MatrixLevelUser } from '../../../services/referral.service';
import { finalize } from 'rxjs/operators';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

@Component({
  selector: 'app-matrix-level',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    FormsModule,
    TableModule,
    SkeletonModule,
    StatusBadgeComponent,
  ],
  templateUrl: './matrix-level.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [`
    :host ::ng-deep .p-datatable .p-datatable-thead > tr > th {
      padding: 1rem 1.5rem;
      background-color: #f9fafb;
      border-bottom: 1px solid #e5e7eb;
    }
    
    :host ::ng-deep .p-datatable .p-datatable-tbody > tr > td {
      padding: 1rem 1.5rem;
      border-bottom: 1px solid #f3f4f6;
    }
    
    :host ::ng-deep .p-datatable .p-datatable-tbody > tr.p-selectable-row:hover {
      background-color: #f9fafb;
      transition: background-color 0.2s ease;
    }
    
    :host ::ng-deep .p-datatable .p-datatable-tbody > tr.p-selectable-row {
      transition: background-color 0.2s ease;
    }
  `]
})
export class MatrixLevelComponent implements OnInit {
  private destroyRef = inject(DestroyRef);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private referralService = inject(ReferralService);
  private messageService = inject(MessageService);

  private debounceHandle: ReturnType<typeof setTimeout> | null = null;
  private requestVersion = 0;

  level = signal<number>(1);
  limit = signal<number>(20);
  offset = signal<number>(0);
  isLoading = signal<boolean>(false);
  users = signal<MatrixLevelUser[]>([]);
  totalRecords = signal<number>(0);
  hasNext = signal<boolean>(false);
  errorMessage = signal<string | null>(null);
  searchQuery = signal<string>('');

  readonly levelOptions = Array.from({ length: 13 }, (_, index) => index + 1);
  readonly pageSizeOptions = [10, 20, 50];
  readonly skeletonRows: MatrixLevelUser[] = Array.from({ length: 6 }, (_, index) => ({
    id: `skeleton-${index}`,
    username: '',
    email: null,
    phone: null,
    joinDate: new Date().toISOString(),
    status: 'UNPAID',
    isDirectReferral: false,
    profilePhotoUrl: null
  }));

  readonly currentPage = computed(() => Math.floor(this.offset() / this.limit()) + 1);
  readonly totalPages = computed(() => Math.max(1, Math.ceil(this.totalRecords() / this.limit())));
  readonly showingFrom = computed(() => (this.totalRecords() === 0 ? 0 : this.offset() + 1));
  readonly showingTo = computed(() => Math.min(this.offset() + this.limit(), this.totalRecords()));
  readonly canGoPrevious = computed(() => this.offset() > 0);
  readonly canGoNext = computed(() => this.hasNext() || this.offset() + this.limit() < this.totalRecords());

  ngOnInit(): void {
    this.route.paramMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      const levelParam = params.get('level');
      const level = this.clampLevel(levelParam);
      this.level.set(level);
      this.offset.set(0);
      this.searchQuery.set('');
      if (this.debounceHandle) {
        clearTimeout(this.debounceHandle);
        this.debounceHandle = null;
      }
      this.loadUsers();
    });
  }

  onLevelChange(event: Event): void {
    const value = Number((event.target as HTMLSelectElement).value);
    if (!Number.isFinite(value) || value === this.level()) {
      return;
    }

    this.router.navigate(['/network/matrix/level', value]);
  }

  onSearchInput(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.searchQuery.set(value);

    if (this.debounceHandle) {
      clearTimeout(this.debounceHandle);
    }

    this.debounceHandle = setTimeout(() => {
      this.offset.set(0);
      this.loadUsers();
    }, 300);
  }

  onLimitChange(event: Event): void {
    const value = Number((event.target as HTMLSelectElement).value);
    if (!Number.isFinite(value) || value === this.limit()) {
      return;
    }

    this.limit.set(value);
    this.offset.set(0);
    this.loadUsers();
  }

  previousPage(): void {
    if (!this.canGoPrevious()) return;
    this.offset.update((currentOffset) => Math.max(0, currentOffset - this.limit()));
    this.loadUsers();
  }

  nextPage(): void {
    if (!this.canGoNext()) return;
    this.offset.update((currentOffset) => currentOffset + this.limit());
    this.loadUsers();
  }

  goToPage(page: number): void {
    if (page < 1 || page > this.totalPages()) return;
    const nextOffset = (page - 1) * this.limit();
    if (nextOffset === this.offset()) return;
    this.offset.set(nextOffset);
    this.loadUsers();
  }

  loadUsers(): void {
    const requestId = ++this.requestVersion;
    this.isLoading.set(true);
    this.errorMessage.set(null);

    this.referralService
      .getMatrixLevelUsers({
        level: this.level(),
        limit: this.limit(),
        offset: this.offset(),
        search: this.searchQuery().trim() || undefined
      })
      .pipe(
        finalize(() => {
          if (requestId === this.requestVersion) {
            this.isLoading.set(false);
          }
        })
      )
      .subscribe({
        next: (response) => {
          if (requestId !== this.requestVersion) return;

          this.users.set(response.data.users);
          this.totalRecords.set(response.data.pagination.totalRecords);
          this.hasNext.set(response.data.pagination.hasNext);
          this.limit.set(response.data.pagination.limit);
          this.offset.set(response.data.pagination.currentOffset);
        },
        error: () => {
          if (requestId !== this.requestVersion) return;

          this.users.set([]);
          this.totalRecords.set(0);
          this.hasNext.set(false);
          this.errorMessage.set('Unable to load this matrix level right now. Please try again.');
          this.messageService.add({
            severity: 'error',
            summary: 'Matrix level unavailable',
            detail: 'Unable to load this matrix level right now.'
          });
        }
      });
  }

  formatStatus(status: string): string {
    if (!status) return 'Unknown';
    if (status === status.toUpperCase()) return status;
    return status.charAt(0).toUpperCase() + status.slice(1).toLowerCase();
  }

  private clampLevel(levelParam: string | null): number {
    const parsed = Number(levelParam ?? 1);
    if (!Number.isFinite(parsed)) return 1;
    return Math.min(13, Math.max(1, Math.trunc(parsed)));
  }
}
