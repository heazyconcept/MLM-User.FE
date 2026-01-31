import { Component, inject, signal, computed, ViewChild, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { MessageService } from 'primeng/api';
import { NetworkService } from '../../../services/network.service';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { Table } from 'primeng/table';
import { SkeletonModule } from 'primeng/skeleton';
import { StatusBadgeComponent } from '../../../components/status-badge/status-badge.component';

@Component({
  selector: 'app-downline-list',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, TableModule, ButtonModule, SkeletonModule, StatusBadgeComponent],
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
  @ViewChild('dt') table!: Table;
  
  private networkService = inject(NetworkService);
  private messageService = inject(MessageService);
  members = this.networkService.downlineList;
  
  searchQuery = signal('');
  filterLevel = signal<number | 'all'>('all');
  filterPackage = signal<string>('all');
  filterStatus = signal<string>('all');
  isLoading = signal(true);
  skeletonRows = Array(5).fill({});

  filteredMembers = computed(() => {
    const query = this.searchQuery().toLowerCase();
    const level = this.filterLevel();
    const pkg = this.filterPackage();
    const status = this.filterStatus();
    return this.members().filter(m => {
      const matchesSearch = !query || m.username.toLowerCase().includes(query) || m.fullName.toLowerCase().includes(query);
      const matchesLevel = level === 'all' || m.level === level;
      const matchesPackage = pkg === 'all' || m.package.toLowerCase() === pkg.toLowerCase();
      const matchesStatus = status === 'all' || m.status === status;
      return matchesSearch && matchesLevel && matchesPackage && matchesStatus;
    });
  });

  /** Distinct levels in data for filter dropdown (e.g. 1, 2, 3, 4, 5). */
  levelOptions = computed(() => {
    const levels = new Set(this.members().map(m => m.level));
    return Array.from(levels).sort((a, b) => a - b);
  });

  ngOnInit(): void {
    // Simulate loading delay
    setTimeout(() => {
      this.isLoading.set(false);
    }, 800);
  }

  getPackageClass(pkg: string): string {
    switch (pkg.toLowerCase()) {
      case 'vip': return 'bg-orange-50 text-orange-600';
      case 'premium': return 'bg-blue-50 text-blue-600';
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
