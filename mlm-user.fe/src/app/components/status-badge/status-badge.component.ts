import { Component, ChangeDetectionStrategy, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TagModule } from 'primeng/tag';

export type StatusType = 'Pending' | 'Approved' | 'Rejected' | 'Success' | 'Processing';

@Component({
  selector: 'app-status-badge',
  standalone: true,
  imports: [CommonModule, TagModule],
  template: `
    @if (status()) {
      <div class="flex items-center gap-2">
        <div [class]="getDotClass()"></div>
        <p-tag 
          [severity]="getSeverity()" 
          [value]="status()" 
          [rounded]="true"
          styleClass="!bg-transparent !border-none !px-0 !font-semibold !text-sm">
        </p-tag>
      </div>
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

  getSeverity(): "success" | "secondary" | "info" | "warn" | "danger" | "contrast" | undefined {
    const s = this.status().toLowerCase();
    if (s.includes('approved') || s.includes('success')) return 'success';
    if (s.includes('pending') || s.includes('processing')) return 'warn';
    if (s.includes('rejected') || s.includes('failed')) return 'danger';
    return 'info';
  }

  getDotClass(): string {
    const s = this.status().toLowerCase();
    let colorClass = 'bg-gray-400';
    if (s.includes('approved') || s.includes('success')) colorClass = 'bg-mlm-success';
    else if (s.includes('pending') || s.includes('processing')) colorClass = 'bg-mlm-warning';
    else if (s.includes('rejected') || s.includes('failed')) colorClass = 'bg-mlm-error';
    
    return `h-2 w-2 rounded-full ${colorClass}`;
  }
}
