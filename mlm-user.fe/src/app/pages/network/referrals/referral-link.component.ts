import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MessageService } from 'primeng/api';
import { NetworkService } from '../../../services/network.service';
import { EarningsService } from '../../../services/earnings.service';
import { UserService } from '../../../services/user.service';
import { CopyButtonComponent } from '../../../components/copy-button/copy-button.component';
import { StatCardComponent } from '../../../components/stat-card/stat-card.component';

@Component({
  selector: 'app-referral-link',
  standalone: true,
  imports: [CommonModule, RouterModule, CopyButtonComponent, StatCardComponent],
  templateUrl: './referral-link.component.html'
})
export class ReferralLinkComponent implements OnInit {
  private networkService = inject(NetworkService);
  private messageService = inject(MessageService);
  private earningsService = inject(EarningsService);
  private userService = inject(UserService);

  referral = this.networkService.referralLink;
  summary = this.networkService.networkSummary;
  earningsSummary = this.earningsService.earningsSummary;
  displayCurrency = this.userService.displayCurrency;
  shareModalVisible = signal(false);

  hasNoReferrals = computed(() => this.summary().directReferrals === 0);
  hasSponsor = computed(() => !!this.referral().sponsorName);
  earningsAmount = computed(() => {
    const s = this.earningsSummary();
    return s.directReferralBonus ?? s.totalEarnings ?? 0;
  });
  currencySymbol = computed(() => (this.displayCurrency() === 'NGN' ? '₦' : '$'));

  ngOnInit(): void {
    this.networkService.fetchNetworkData();
  }

  onCopySuccess(): void {
    this.messageService.add({
      severity: 'success',
      summary: 'Copied',
      detail: 'Link copied to clipboard'
    });
  }

  openShareModal(): void {
    this.shareModalVisible.set(true);
  }

  closeShareModal(): void {
    this.shareModalVisible.set(false);
  }
}
