import { Injectable, signal } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class LayoutService {
  isMobileMenuOpen = signal(false);
  isSidebarCollapsed = signal(false);

  toggleMobileMenu() {
    this.isMobileMenuOpen.update(open => !open);
  }

  closeMobileMenu() {
    this.isMobileMenuOpen.set(false);
  }

  openMobileMenu() {
    this.isMobileMenuOpen.set(true);
  }

  toggleSidebar() {
    this.isSidebarCollapsed.update(collapsed => !collapsed);
  }

  setSidebarCollapsed(collapsed: boolean) {
    this.isSidebarCollapsed.set(collapsed);
  }
}
