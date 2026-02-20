import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { NetworkService } from '../../../services/network.service';
import { StatCardComponent } from '../../../components/stat-card/stat-card.component';
import { SkeletonModule } from 'primeng/skeleton';

@Component({
  selector: 'app-network-overview',
  standalone: true,
  imports: [CommonModule, RouterModule, StatCardComponent, SkeletonModule],
  templateUrl: './network-overview.component.html'
})
export class NetworkOverviewComponent implements OnInit {
  private networkService = inject(NetworkService);
  summary = this.networkService.networkSummary;
  cpvSummary = this.networkService.cpvSummary;
  isLoading = this.networkService.isLoading;
  error = this.networkService.error;

  ngOnInit(): void {
    this.networkService.fetchNetworkData();
  }
}
