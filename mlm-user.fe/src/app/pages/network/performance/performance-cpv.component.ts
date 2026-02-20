import { Component, inject, signal, computed, AfterViewInit, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MessageService } from 'primeng/api';
import { NetworkService } from '../../../services/network.service';
import { EarningsService } from '../../../services/earnings.service';
import { UserService } from '../../../services/user.service';
import { StatCardComponent } from '../../../components/stat-card/stat-card.component';
import { SkeletonModule } from 'primeng/skeleton';

@Component({
  selector: 'app-performance-cpv',
  standalone: true,
  imports: [CommonModule, RouterModule, StatCardComponent, SkeletonModule],
  templateUrl: './performance-cpv.component.html'
})
export class PerformanceCpvComponent implements OnInit, AfterViewInit {
  private networkService = inject(NetworkService);
  private messageService = inject(MessageService);
  private earningsService = inject(EarningsService);
  private userService = inject(UserService);

  cpv = this.networkService.cpvSummary;
  summary = this.networkService.networkSummary;
  earningsSummary = this.earningsService.earningsSummary;
  displayCurrency = this.userService.displayCurrency;
  isLoading = this.networkService.isLoading;
  error = this.networkService.error;

  animatedPercentage = signal(0);

  /** Earnings contribution from API (or zeros if not available). */
  earningsContribution = computed(() => {
    const s = this.earningsSummary();
    return {
      fromDirectReferrals: s.directReferralBonus ?? s.fromDirectReferrals ?? 0,
      fromTeamCpv: s.fromTeamCpv ?? 0,
      personalSales: s.personalSales ?? 0
    };
  });

  totalEarningsContribution = computed(() => {
    const e = this.earningsContribution();
    return e.fromDirectReferrals + e.fromTeamCpv + e.personalSales;
  });

  currencySymbol = computed(() => (this.displayCurrency() === 'NGN' ? '₦' : '$'));

  getEarningsShare(value: number): number {
    const total = this.totalEarningsContribution();
    return total ? (value / total) * 100 : 0;
  }

  ngOnInit(): void {
    if (!this.isLoading()) {
      this.networkService.fetchNetworkData();
    }
  }

  /** True when there is no CPV activity (used for empty state). */
  hasNoCpvActivity = computed(() => this.cpv().teamCpv === 0 && this.cpv().personalCpv === 0);

  copyReferralLink(): void {
    const url = this.networkService.referralLink().url;
    navigator.clipboard.writeText(url).then(() => {
      this.messageService.add({ severity: 'success', summary: 'Copied', detail: 'Referral link copied to clipboard' });
    });
  }

  getPercentage() {
    const { teamCpv, requiredCpv } = this.cpv();
    if (!requiredCpv) return 0;
    return Math.min(100, (teamCpv / requiredCpv) * 100);
  }

  getTeamCpvSubValue(): string {
    return `/ ${this.cpv().requiredCpv} required`;
  }

  getRankSubValue(): string {
    return `${this.summary().nextRank} next`;
  }

  getProgressValue(): string {
    return `${this.getPercentage().toFixed(0)}%`;
  }

  ngAfterViewInit(): void {
    // Start animation after a small delay to ensure view is fully rendered
    setTimeout(() => {
      this.animateProgressBar();
    }, 100);
  }

  private animateProgressBar(): void {
    const targetPercentage = this.getPercentage();
    const duration = 1500; // 1.5 seconds
    const startTime = Date.now();
    const startValue = 0;

    const animate = () => {
      const currentTime = Date.now();
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // Easing function for smooth animation (ease-out)
      const easeOut = 1 - Math.pow(1 - progress, 3);
      const currentValue = startValue + (targetPercentage - startValue) * easeOut;
      
      this.animatedPercentage.set(currentValue);

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        // Ensure we end exactly at target percentage
        this.animatedPercentage.set(targetPercentage);
      }
    };

    requestAnimationFrame(animate);
  }
}
