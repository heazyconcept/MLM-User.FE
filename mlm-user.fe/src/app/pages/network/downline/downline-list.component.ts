import { Component, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NetworkService } from '../../../services/network.service';

@Component({
  selector: 'app-downline-list',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './downline-list.component.html'
})
export class DownlineListComponent {
  private networkService = inject(NetworkService);
  members = this.networkService.downlineList;
  
  searchQuery = signal('');

  filteredMembers = computed(() => {
    const query = this.searchQuery().toLowerCase();
    return this.members().filter(m => 
      m.username.toLowerCase().includes(query) || 
      m.fullName.toLowerCase().includes(query)
    );
  });

  getPackageClass(pkg: string): string {
    switch (pkg.toLowerCase()) {
      case 'vip': return 'bg-orange-50 text-orange-600';
      case 'premium': return 'bg-blue-50 text-blue-600';
      default: return 'bg-gray-100 text-gray-600';
    }
  }

  getStatusClass(status: string): string {
    return status === 'active' 
      ? 'bg-green-50 text-green-600' 
      : 'bg-red-50 text-red-600';
  }
}
