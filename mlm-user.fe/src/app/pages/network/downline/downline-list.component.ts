import { Component, inject, signal, computed, ViewChild, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NetworkService } from '../../../services/network.service';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { Table } from 'primeng/table';
import { SkeletonModule } from 'primeng/skeleton';
import { StatusBadgeComponent } from '../../../components/status-badge/status-badge.component';

@Component({
  selector: 'app-downline-list',
  standalone: true,
  imports: [CommonModule, FormsModule, TableModule, ButtonModule, SkeletonModule, StatusBadgeComponent],
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
  members = this.networkService.downlineList;
  
  searchQuery = signal('');
  isLoading = signal(true);
  skeletonRows = Array(5).fill({});

  filteredMembers = computed(() => {
    const query = this.searchQuery().toLowerCase();
    return this.members().filter(m => 
      m.username.toLowerCase().includes(query) || 
      m.fullName.toLowerCase().includes(query)
    );
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
}
