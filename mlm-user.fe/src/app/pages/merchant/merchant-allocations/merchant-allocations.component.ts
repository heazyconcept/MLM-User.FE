import { Component, inject, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MerchantService } from '../../../services/merchant.service';
import { ButtonModule } from 'primeng/button';

@Component({
  selector: 'app-merchant-allocations',
  imports: [CommonModule, RouterLink, ButtonModule],
  templateUrl: './merchant-allocations.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MerchantAllocationsComponent implements OnInit {
  private merchantService = inject(MerchantService);

  allocations = this.merchantService.allocations;
  loading = this.merchantService.loading;
  actionLoading = this.merchantService.actionLoading;
  error = this.merchantService.error;

  ngOnInit(): void {
    this.merchantService.fetchAllocations();
  }

  accept(allocationId: string): void {
    this.merchantService.acceptAllocation(allocationId);
  }

  formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString('en-NG', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  }
}
