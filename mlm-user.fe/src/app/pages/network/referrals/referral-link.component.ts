import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NetworkService } from '../../../services/network.service';
import { CopyButtonComponent } from '../../../components/copy-button/copy-button.component';

@Component({
  selector: 'app-referral-link',
  standalone: true,
  imports: [CommonModule, CopyButtonComponent],
  templateUrl: './referral-link.component.html'
})
export class ReferralLinkComponent {
  private networkService = inject(NetworkService);
  referral = this.networkService.referralLink;
}
