import { Component, inject, signal, computed, OnInit, ChangeDetectionStrategy, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { MessageModule } from 'primeng/message';
import { MerchantService } from '../../../services/merchant.service';
import { NIGERIAN_STATES } from '../../../core/constants/states.constants';

@Component({
  selector: 'app-merchant-profile',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    FormsModule,
    ButtonModule,
    InputTextModule,
    MessageModule
  ],
  templateUrl: './merchant-profile.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MerchantProfileComponent implements OnInit {
  private merchantService = inject(MerchantService);

  profile = this.merchantService.profile;
  loading = this.merchantService.loading;
  actionLoading = this.merchantService.actionLoading;
  error = this.merchantService.error;

  // Form Signals
  businessName = signal('');
  phoneNumber = signal('');
  address = signal('');
  
  // Custom multi-select state selector signals
  selectedStates = signal<string[]>([]);
  statesDropdownOpen = signal(false);
  statesSearchQuery = signal('');
  allStates = NIGERIAN_STATES;

  successMessage = signal('');

  filteredStates = computed(() => {
    const query = this.statesSearchQuery().toLowerCase().trim();
    if (!query) return this.allStates;
    return this.allStates.filter((state) => state.toLowerCase().includes(query));
  });

  constructor() {
    // Automatically populate form when profile signal updates (e.g. loads from API or merges local storage)
    effect(() => {
      const p = this.profile();
      if (p && !p.message) {
        this.businessName.set(p.businessName || '');
        this.phoneNumber.set(p.phoneNumber || '');
        this.address.set(p.address || '');
        this.selectedStates.set(p.serviceAreas || []);
      }
    });
  }

  ngOnInit(): void {
    this.merchantService.fetchProfile();
  }

  toggleStateSelection(state: string): void {
    const current = this.selectedStates();
    if (current.includes(state)) {
      this.selectedStates.set(current.filter((s) => s !== state));
    } else {
      this.selectedStates.set([...current, state]);
    }
  }

  isStateSelected(state: string): boolean {
    return this.selectedStates().includes(state);
  }

  removeState(state: string): void {
    this.selectedStates.set(this.selectedStates().filter((s) => s !== state));
  }

  // Handle Form Submission
  onSubmit(): void {
    this.successMessage.set('');
    const name = this.businessName().trim();
    const phone = this.phoneNumber().trim();
    const addr = this.address().trim();
    const areas = this.selectedStates();

    if (!name || !phone || !addr || areas.length === 0) {
      return;
    }

    this.merchantService.updateProfile({
      businessName: name,
      phoneNumber: phone,
      address: addr,
      serviceAreas: areas
    }).subscribe((res) => {
      if (res) {
        this.merchantService.clearError();
        this.successMessage.set('Merchant profile updated successfully.');
        setTimeout(() => this.successMessage.set(''), 4000);
      }
    });
  }

  // Reset form to active profile values
  onReset(): void {
    const p = this.profile();
    if (p) {
      this.businessName.set(p.businessName || '');
      this.phoneNumber.set(p.phoneNumber || '');
      this.address.set(p.address || '');
      this.selectedStates.set(p.serviceAreas || []);
    }
    this.successMessage.set('');
  }
}
