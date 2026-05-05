import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { NetworkService } from '../../../services/network.service';
import { ReferralService, type ReferralStats } from '../../../services/referral.service';
import { UserService } from '../../../services/user.service';
import { SkeletonModule } from 'primeng/skeleton';
import { DialogService } from 'primeng/dynamicdialog';
import { CreateReferralComponent } from '../create-referral/create-referral.component';

@Component({
  selector: 'app-network-overview',
  standalone: true,
  imports: [CommonModule, RouterModule, SkeletonModule],
  providers: [DialogService],
  templateUrl: './network-overview.component.html'
})
export class NetworkOverviewComponent implements OnInit {
  private networkService = inject(NetworkService);
  private referralService = inject(ReferralService);
  private userService = inject(UserService);
  private dialogService = inject(DialogService);
  summary = this.networkService.networkSummary;
  cpvSummary = this.networkService.cpvSummary;
  sponsor = this.networkService.sponsorInfo;
  placement = this.networkService.placementInfo;
  isLoading = this.networkService.isLoading;
  error = this.networkService.error;
  currentUser = this.userService.currentUser;

  referralStats = signal<ReferralStats>({
    teamSize: 0,
    totalDirectReferrals: 0,
    totalLeaders: 0,
    isLeader: false
  });
  statsLoading = signal(false);

  ngOnInit(): void {
    if (!this.isLoading()) {
      this.networkService.fetchNetworkData();
    }
    this.fetchReferralStats();
  }

  private fetchReferralStats(): void {
    this.statsLoading.set(true);
    this.referralService.getReferralStats().subscribe({
      next: (stats) => {
        this.referralStats.set(stats);
        this.statsLoading.set(false);
      },
      error: () => {
        this.statsLoading.set(false);
      }
    });
  }

  openCreateReferralDialog(): void {
    this.dialogService.open(CreateReferralComponent, {
      header: 'Create Successline',
      width: '520px',
      contentStyle: { 'max-height': '700px', overflow: 'auto' },
      baseZIndex: 10000,
      data: { returnUrl: '/network' }
    });
  }
}
