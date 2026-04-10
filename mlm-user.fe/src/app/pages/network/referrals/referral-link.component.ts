import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MessageService } from 'primeng/api';
import { SkeletonModule } from 'primeng/skeleton';
import { NetworkService } from '../../../services/network.service';
import { EarningsService } from '../../../services/earnings.service';
import { UserService } from '../../../services/user.service';
import { CopyButtonComponent } from '../../../components/copy-button/copy-button.component';

@Component({
  selector: 'app-referral-link',
  standalone: true,
  imports: [CommonModule, RouterModule, CopyButtonComponent, SkeletonModule],
  templateUrl: './referral-link.component.html'
})
export class ReferralLinkComponent implements OnInit {
  private networkService = inject(NetworkService);
  private messageService = inject(MessageService);
  private earningsService = inject(EarningsService);
  private userService = inject(UserService);

  referral = this.networkService.referralLink;
  summary = this.networkService.networkSummary;
  isLoading = this.networkService.isLoading;
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
    if (!this.networkService.isLoading()) {
      this.networkService.fetchNetworkData();
    }
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

  shareVia(channel: 'whatsapp' | 'telegram' | 'email' | 'more'): void {
    const link = this.referral().url;
    const message = `Join me on Segulah: ${link}`;

    if (!link) return;

    switch (channel) {
      case 'whatsapp':
        window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank', 'noopener,noreferrer');
        break;
      case 'telegram':
        window.open(
          `https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent('Join me on Segulah')}`,
          '_blank',
          'noopener,noreferrer'
        );
        break;
      case 'email':
        window.location.href = `mailto:?subject=${encodeURIComponent('Join me on Segulah')}&body=${encodeURIComponent(message)}`;
        break;
      case 'more':
        if (navigator.share) {
          navigator.share({ title: 'Join me on Segulah', text: 'Join me on Segulah', url: link }).catch(() => {});
        } else {
          this.openShareModal();
        }
        break;
      default:
        this.openShareModal();
        break;
    }
  }
}
