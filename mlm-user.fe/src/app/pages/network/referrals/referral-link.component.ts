import { Component, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MessageService } from 'primeng/api';
import { NetworkService } from '../../../services/network.service';
import { CopyButtonComponent } from '../../../components/copy-button/copy-button.component';
import { StatCardComponent } from '../../../components/stat-card/stat-card.component';

@Component({
  selector: 'app-referral-link',
  standalone: true,
  imports: [CommonModule, RouterModule, CopyButtonComponent, StatCardComponent],
  templateUrl: './referral-link.component.html'
})
export class ReferralLinkComponent {
  private networkService = inject(NetworkService);
  private messageService = inject(MessageService);
  referral = this.networkService.referralLink;
  summary = this.networkService.networkSummary;
  shareModalVisible = signal(false);

  hasNoReferrals = computed(() => this.summary().directReferrals === 0);

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
