import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { NetworkService } from '../../../services/network.service';
import { StatCardComponent } from '../../../components/stat-card/stat-card.component';

@Component({
  selector: 'app-network-overview',
  standalone: true,
  imports: [CommonModule, RouterModule, StatCardComponent],
  templateUrl: './network-overview.component.html'
})
export class NetworkOverviewComponent {
  private networkService = inject(NetworkService);
  summary = this.networkService.networkSummary;
  cpvSummary = this.networkService.cpvSummary;
}
