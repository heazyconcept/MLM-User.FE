import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { NetworkService } from '../../../services/network.service';
import { StatCardComponent } from '../../../components/stat-card/stat-card.component';
import { SkeletonModule } from 'primeng/skeleton';
import { DialogService } from 'primeng/dynamicdialog';
import { CreateReferralComponent } from '../create-referral/create-referral.component';

@Component({
  selector: 'app-network-overview',
  standalone: true,
  imports: [CommonModule, RouterModule, StatCardComponent, SkeletonModule],
  providers: [DialogService],
  templateUrl: './network-overview.component.html'
})
export class NetworkOverviewComponent implements OnInit {
  private networkService = inject(NetworkService);
  private dialogService = inject(DialogService);
  summary = this.networkService.networkSummary;
  cpvSummary = this.networkService.cpvSummary;
  sponsor = this.networkService.sponsorInfo;
  placement = this.networkService.placementInfo;
  isLoading = this.networkService.isLoading;
  error = this.networkService.error;

  ngOnInit(): void {
    if (!this.isLoading()) {
      this.networkService.fetchNetworkData();
    }
  }

  openCreateReferralDialog(): void {
    this.dialogService.open(CreateReferralComponent, {
      header: 'Create Referral',
      width: '520px',
      contentStyle: { 'max-height': '700px', overflow: 'auto' },
      baseZIndex: 10000,
      data: { returnUrl: '/network' }
    });
  }
}
