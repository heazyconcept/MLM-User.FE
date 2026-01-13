import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NetworkService } from '../../../services/network.service';

@Component({
  selector: 'app-performance-cpv',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './performance-cpv.component.html'
})
export class PerformanceCpvComponent {
  private networkService = inject(NetworkService);
  cpv = this.networkService.cpvSummary;
  summary = this.networkService.networkSummary;

  getPercentage() {
    const { teamCpv, requiredCpv } = this.cpv();
    if (!requiredCpv) return 0;
    return Math.min(100, (teamCpv / requiredCpv) * 100);
  }
}
