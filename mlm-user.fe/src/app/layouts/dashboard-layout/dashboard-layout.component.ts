import { Component, ChangeDetectionStrategy, inject, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet } from '@angular/router';
import { SideMenuComponent } from '../../components/side-menu/side-menu.component';
import { DashboardHeaderComponent } from '../../components/dashboard-header/dashboard-header.component';
import { LayoutService } from '../../services/layout.service';
import { RealTimeNotificationService } from '../../services/realtime-notification.service';

@Component({
  selector: 'app-dashboard-layout',
  imports: [CommonModule, RouterOutlet, SideMenuComponent, DashboardHeaderComponent],

  templateUrl: './dashboard-layout.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DashboardLayoutComponent implements OnInit, OnDestroy {
  layoutService = inject(LayoutService);
  isSidebarCollapsed = this.layoutService.isSidebarCollapsed;

  private realtimeNotifications = inject(RealTimeNotificationService);

  ngOnInit(): void {
    // Always start with the mobile drawer closed when entering the dashboard.
    // The LayoutService is providedIn: 'root' so its state survives across
    // navigations; this guarantees a fresh state after login.
    this.layoutService.closeMobileMenu();
    this.realtimeNotifications.initialize();
  }

  ngOnDestroy(): void {
    this.realtimeNotifications.disconnect();
  }
}
