import { Component, ChangeDetectionStrategy, input } from '@angular/core';
import { CommonModule } from '@angular/common';

/**
 * Comprehensive status enum covering all status types in the application
 */
export type StatusType = 
  // Network/Member statuses
  | 'active' 
  | 'inactive' 
  | 'empty'
  // Activity/Transaction statuses
  | 'Pending' 
  | 'Approved' 
  | 'Rejected' 
  | 'Success' 
  | 'Processing'
  | 'Completed'
  // Payment statuses
  | 'UNPAID' 
  | 'PAID'
  // KYC statuses
  | 'PENDING' 
  | 'VERIFIED' 
  | 'REJECTED'
  // Commission statuses
  | 'Locked'
  // Bonus statuses
  | 'Qualified'
  | 'In Progress'
  | 'Not Qualified'
  | 'Earned';

@Component({
  selector: 'app-status-badge',
  standalone: true,
  imports: [CommonModule],
  template: `
    @if (status()) {
      <span [class]="getStatusClass()">
        {{ getDisplayText() }}
      </span>
    }
  `,
  styles: [`
    :host {
      display: inline-block;
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class StatusBadgeComponent {
  status = input.required<string>();
  size = input<'sm' | 'md' | 'lg'>('md');

  getStatusClass(): string {
    const s = this.status().toLowerCase();
    const baseClasses = 'px-3 py-1.5 rounded-full text-xs font-medium uppercase tracking-wide';
    const sizeClasses = {
      sm: 'px-2 py-1 text-[10px]',
      md: 'px-3 py-1.5 text-xs',
      lg: 'px-4 py-2 text-sm'
    };
    
    let colorClasses = '';
    
    // Network/Member statuses
    if (s === 'active') {
      colorClasses = 'bg-green-50 text-green-600';
    } else if (s === 'inactive') {
      colorClasses = 'bg-red-50 text-red-600';
    } else if (s === 'empty') {
      colorClasses = 'bg-blue-50 text-blue-600';
    }
    // Activity/Transaction statuses - Success states
    else if (s === 'approved' || s === 'success' || s === 'completed' || s === 'verified' || s === 'paid' || s === 'qualified' || s === 'earned') {
      colorClasses = 'bg-green-50 text-green-600';
    } 
    // Pending/In Progress states
    else if (s === 'pending' || s === 'processing' || s === 'locked' || s === 'in progress') {
      colorClasses = 'bg-yellow-50 text-yellow-600';
    }
    // Order fulfilment: in progress (pickup/delivery)
    else if (s === 'ready for pickup' || s === 'out for delivery') {
      colorClasses = 'bg-blue-50 text-blue-600';
    }
    // Order: delivered (success)
    else if (s === 'delivered') {
      colorClasses = 'bg-green-50 text-green-600';
    }
    // Rejected/Failed states (including Cancelled)
    else if (s === 'rejected' || s === 'unpaid' || s === 'not qualified' || s === 'cancelled') {
      colorClasses = 'bg-red-50 text-red-600';
    }
    // Default
    else {
      colorClasses = 'bg-gray-100 text-gray-600';
    }
    
    return `${baseClasses} ${sizeClasses[this.size()]} ${colorClasses}`;
  }

  getDisplayText(): string {
    const s = this.status();
    // Return uppercase for certain statuses
    if (['UNPAID', 'PAID', 'PENDING', 'VERIFIED', 'REJECTED'].includes(s)) {
      return s;
    }
    // Order statuses: preserve "Ready for Pickup", "Out for Delivery" etc.
    if (s === 'Ready for Pickup' || s === 'Out for Delivery') {
      return s;
    }
    // Capitalize first letter only
    return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
  }
}
