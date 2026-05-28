import { Component, ChangeDetectionStrategy, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DialogModule } from 'primeng/dialog';
import { DashboardPopupService } from '../../services/dashboard-popup.service';

@Component({
  selector: 'app-dashboard-popup',
  standalone: true,
  imports: [CommonModule, DialogModule],
  templateUrl: './dashboard-popup.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DashboardPopupComponent {
  private popupService = inject(DashboardPopupService);

  popup = this.popupService.activePopup;
  imageIndex = this.popupService.imageIndex;
  isOpen = this.popupService.isOpen;

  imageUrls = computed(() => this.popup()?.imageUrls ?? []);
  hasImages = computed(() => this.imageUrls().length > 0);
  hasMultipleImages = computed(() => this.imageUrls().length > 1);

  close(): void {
    this.popupService.dismissActive();
  }

  nextImage(): void {
    this.popupService.nextImage();
  }

  prevImage(): void {
    this.popupService.prevImage();
  }

  trackByIndex = (index: number) => index;
}
