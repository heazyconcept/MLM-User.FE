import { Component, computed, signal, inject, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';
import { UserService } from '../../services/user.service';
import { AuthService } from '../../services/auth.service';

interface MenuItem {
  label: string;
  route: string;
  icon: string;
  requiresPayment: boolean;
  children?: MenuItem[];
}

import { LayoutService } from '../../services/layout.service';

@Component({
  selector: 'app-side-menu',
  imports: [CommonModule, RouterModule],
  templateUrl: './side-menu.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SideMenuComponent {
  private router = inject(Router);
  private userService = inject(UserService);
  private authService = inject(AuthService);
  private layoutService = inject(LayoutService);

  isPaid = this.userService.isPaid;
  currentUser = this.userService.currentUser;
  mobileMenuOpen = this.layoutService.isMobileMenuOpen;
  activeRoute = signal('');
  openMenus = signal<Set<string>>(new Set());


  menuItems = signal<MenuItem[]>([
    { label: 'Dashboard', route: '/dashboard', icon: 'pi pi-home', requiresPayment: false },
    { label: 'Profile', route: '/profile', icon: 'pi pi-user', requiresPayment: false },
    { label: 'Shop', route: '/shop', icon: 'pi pi-shopping-cart', requiresPayment: true },
    { 
      label: 'Wallet', 
      route: '/wallet', 
      icon: 'pi pi-wallet', 
      requiresPayment: true,
      children: [
        { label: 'Transaction History', route: '/wallet/transactions/NGN', icon: 'pi pi-history', requiresPayment: true }
      ]
    },
    { label: 'Network', route: '/network', icon: 'pi pi-users', requiresPayment: true },
    { label: 'Commissions', route: '/commissions', icon: 'pi pi-dollar', requiresPayment: true },
    { label: 'Withdrawals', route: '/withdrawals', icon: 'pi pi-money-bill', requiresPayment: true },
    { label: 'Orders', route: '/orders', icon: 'pi pi-shopping-bag', requiresPayment: true }
  ]);

  isItemDisabled = (item: MenuItem): boolean => {
    return item.requiresPayment && !this.isPaid();
  };

  updateTooltipPosition(event: MouseEvent): void {
    const target = event.currentTarget as HTMLElement;
    const tooltip = target.querySelector('[data-tooltip]') as HTMLElement;
    if (!tooltip) return;
    const rect = target.getBoundingClientRect();
    tooltip.style.setProperty('--tooltip-top', `${rect.top + rect.height / 2}px`);
  }

  constructor() {
    this.router.events
      .pipe(filter(event => event instanceof NavigationEnd))
      .subscribe((event: unknown) => {
        const navEvent = event as NavigationEnd;
        this.activeRoute.set(navEvent.urlAfterRedirects);
        this.autoExpandActiveSubmenu();
      });
    
    this.activeRoute.set(this.router.url);
    this.autoExpandActiveSubmenu();
  }

  private autoExpandActiveSubmenu(): void {
    const currentUrl = this.activeRoute();
    this.menuItems().forEach(item => {
      const hasActiveChild = item.children?.some(child => currentUrl.startsWith(child.route));
      const isParentActive = currentUrl === item.route || currentUrl.startsWith(item.route + '/');
      
      if (hasActiveChild || (isParentActive && item.children)) {
        this.toggleSubMenu(item.label, true);
      }
    });
  }

  toggleMobileMenu(): void {
    this.layoutService.toggleMobileMenu();
  }

  closeMobileMenu(): void {
    this.layoutService.closeMobileMenu();
  }

  toggleSubMenu(label: string, forceOpen = false): void {
    const current = new Set(this.openMenus());
    if (forceOpen) {
      current.add(label);
    } else {
      if (current.has(label)) {
        current.delete(label);
      } else {
        current.add(label);
      }
    }
    this.openMenus.set(current);
  }


  navigate(route: string, item: MenuItem): void {
    // Prevent navigation if item requires payment and user hasn't paid
    if (this.isItemDisabled(item)) {
      return;
    }

    if (item.children && item.children.length > 0) {
      this.toggleSubMenu(item.label);
    }

    this.router.navigate([route]);
    this.closeMobileMenu();
  }

  logout(): void {
    this.authService.logout();
    this.userService.clearUser();
    this.router.navigate(['/login']);
  }

  isActiveRoute(route: string): boolean {
    return this.activeRoute() === route || this.activeRoute().startsWith(route + '/');
  }
}

