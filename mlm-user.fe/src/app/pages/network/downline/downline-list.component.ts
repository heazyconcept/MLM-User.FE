import { Component, inject, signal, computed, ViewChild, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { MessageService } from 'primeng/api';
import { NetworkService } from '../../../services/network.service';
import { ButtonModule } from 'primeng/button';
import { StatusBadgeComponent } from '../../../components/status-badge/status-badge.component';
import { UiTableComponent } from '../../../components/table/table-component';

@Component({
  selector: 'app-downline-list',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, ButtonModule, StatusBadgeComponent, UiTableComponent],
  templateUrl: './downline-list.component.html',
  styles: [`
    /* Table spacing and design */
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
export class DownlineListComponent implements OnInit {
  @ViewChild('dt') table!: UiTableComponent;
  
  private networkService = inject(NetworkService);
  private messageService = inject(MessageService);

  members = this.networkService.downlineList;
  searchQuery = signal('');
  filterLevel = signal<number | 'all'>('all');
  filterStage = signal<string>('all');
  isLoading = computed(() => this.networkService.isLoading());
  error = computed(() => this.networkService.error() ?? null);

  filteredMembers = computed(() => {
    const query = this.searchQuery().toLowerCase();
    const level = this.filterLevel();
    const stage = this.filterStage();
    return this.members().filter(m => {
      const matchesSearch = !query || m.username.toLowerCase().includes(query) || m.fullName.toLowerCase().includes(query);
      const matchesLevel = level === 'all' || m.level === level;
      const matchesStage = stage === 'all' || (m.stage ?? '').toLowerCase() === stage.toLowerCase();
      return matchesSearch && matchesLevel && matchesStage;
    });
  });

  /** Fixed levels 1 through 13 (the full MLM compensation tree). */
  levelOptions = computed(() => Array.from({ length: 13 }, (_, i) => i + 1));

  /** Full list of stages (ranks) — Entry Level first, then progression ranks. */
  stageOptions = computed(() => [
    'Entry Level',
    'Mentor',
    'Manager',
    'Senior Manager',
    'Director',
    'Senior Director',
    'Consultant'
  ]);

  ngOnInit(): void {
    this.networkService.fetchNetworkData();
  }

  getPackageClass(pkg: string): string {
    switch (pkg.toUpperCase()) {
      case 'DIAMOND': return 'bg-sky-50 text-sky-600';
      case 'RUBY': return 'bg-rose-50 text-rose-600';
      case 'PLATINUM': return 'bg-violet-50 text-violet-600';
      case 'GOLD': return 'bg-amber-50 text-amber-600';
      case 'SILVER': return 'bg-slate-100 text-slate-600';
      case 'NICKEL': return 'bg-stone-100 text-stone-500';
      default: return 'bg-gray-100 text-gray-600';
    }
  }

  exportCSV() {
    this.table.exportCSV();
  }

  copyReferralLink(): void {
    const url = this.networkService.referralLink().url;
    navigator.clipboard.writeText(url).then(() => {
      this.messageService.add({ severity: 'success', summary: 'Copied', detail: 'Referral link copied to clipboard' });
    });
  }
}
