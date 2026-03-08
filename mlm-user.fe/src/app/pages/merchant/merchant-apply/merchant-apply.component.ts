import { Component, inject, signal, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MerchantService, type MerchantType } from '../../../services/merchant.service';
import { ButtonModule } from 'primeng/button';

@Component({
  selector: 'app-merchant-apply',
  imports: [CommonModule, RouterLink, FormsModule, ButtonModule],
  templateUrl: './merchant-apply.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MerchantApplyComponent implements OnInit {
  private merchantService = inject(MerchantService);

  categoryConfig = this.merchantService.categoryConfig;
  profile = this.merchantService.profile;
  isMerchant = this.merchantService.isMerchant;
  loading = this.merchantService.loading;
  actionLoading = this.merchantService.actionLoading;
  error = this.merchantService.error;

  selectedType = signal<MerchantType>('REGIONAL');
  serviceAreasInput = signal('');
  submitted = signal(false);

  readonly merchantTypes: MerchantType[] = ['REGIONAL', 'NATIONAL', 'GLOBAL'];

  ngOnInit(): void {
    this.merchantService.fetchCategoryConfig();
    this.merchantService.fetchProfile();
  }

  getTypeLabel(type: MerchantType): string {
    const labels: Record<MerchantType, string> = {
      REGIONAL: 'Regional',
      NATIONAL: 'National',
      GLOBAL: 'Global',
    };
    return labels[type] ?? type;
  }

  getConfigForType(type: MerchantType) {
    return this.categoryConfig().find((c) => c.merchantType === type);
  }

  selectedConfig() {
    return this.getConfigForType(this.selectedType());
  }

  onSubmit(): void {
    const areas = this.serviceAreasInput()
      .split(',')
      .map((a) => a.trim())
      .filter((a) => a.length > 0);

    if (areas.length === 0) return;

    this.merchantService.apply(this.selectedType(), areas);
    this.submitted.set(true);
  }
}
