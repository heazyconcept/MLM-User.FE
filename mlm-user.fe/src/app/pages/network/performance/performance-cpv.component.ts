import { Component, inject, signal, computed, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MessageService } from 'primeng/api';
import { NetworkService } from '../../../services/network.service';
import { StatCardComponent } from '../../../components/stat-card/stat-card.component';

/** Mock earnings contribution by source (for visual only). */
const MOCK_EARNINGS_CONTRIBUTION = {
  fromDirectReferrals: 45000,
  fromTeamCpv: 120000,
  personalSales: 28000
};

@Component({
  selector: 'app-performance-cpv',
  standalone: true,
  imports: [CommonModule, RouterModule, StatCardComponent],
  templateUrl: './performance-cpv.component.html'
})
export class PerformanceCpvComponent implements AfterViewInit {
  private networkService = inject(NetworkService);
  private messageService = inject(MessageService);
  cpv = this.networkService.cpvSummary;
  summary = this.networkService.networkSummary;
  
  animatedPercentage = signal(0);
  /** Mock earnings contribution (read-only) for the Earnings Contribution block. */
  earningsContribution = MOCK_EARNINGS_CONTRIBUTION;

  get totalEarningsContribution(): number {
    return this.earningsContribution.fromDirectReferrals + this.earningsContribution.fromTeamCpv + this.earningsContribution.personalSales;
  }

  getEarningsShare(value: number): number {
    const total = this.totalEarningsContribution;
    return total ? (value / total) * 100 : 0;
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
