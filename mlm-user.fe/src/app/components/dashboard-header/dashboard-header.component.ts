import {
  Component,
  ChangeDetectionStrategy,
  inject,
  signal,
  OnInit,
  computed,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { AvatarModule } from 'primeng/avatar';
import { MenuModule } from 'primeng/menu';
import { BadgeModule } from 'primeng/badge';
import { MenuItem } from 'primeng/api';
import { DrawerModule } from 'primeng/drawer';
import { UserService } from '../../services/user.service';
import { MerchantService } from '../../services/merchant.service';
import { AuthService } from '../../services/auth.service';
import { LayoutService } from '../../services/layout.service';
import { NotificationService } from '../../services/notification.service';
import { WalletService } from '../../services/wallet.service';
import { CartService } from '../../services/cart.service';

@Component({
  selector: 'app-dashboard-header',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    ButtonModule,
    AvatarModule,
    MenuModule,
    BadgeModule,
    DrawerModule,
  ],
  templateUrl: './dashboard-header.component.html',
  styles: [
    `
      .hide-scrollbar {
        -ms-overflow-style: none;
        scrollbar-width: none;
      }
      .hide-scrollbar::-webkit-scrollbar {
        display: none;
      }

      @keyframes cart-hint-enter {
        from {
          opacity: 0;
          transform: translateY(-4px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }

      .cart-checkout-hint {
        animation: cart-hint-enter 0.2s ease-out;
      }

      @keyframes cart-icon-pulse {
        0%,
        100% {
          box-shadow: 0 0 0 0 rgba(var(--mlm-primary-rgb, 34, 139, 34), 0.35);
        }
        50% {
          box-shadow: 0 0 0 6px rgba(var(--mlm-primary-rgb, 34, 139, 34), 0);
        }
      }

      .cart-icon-hint-active {
        animation: cart-icon-pulse 1.5s ease-in-out infinite;
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DashboardHeaderComponent implements OnInit {
  private userService = inject(UserService);
  private merchantService = inject(MerchantService);
  private authService = inject(AuthService);
  private layoutService = inject(LayoutService);
  private notificationService = inject(NotificationService);
  private walletService = inject(WalletService);
  private cartService = inject(CartService);
  private router = inject(Router);

  isPaid = this.userService.isPaid;
  cartItemCount = this.cartService.itemCount;
  cartCheckoutHintVisible = this.cartService.checkoutHintVisible;
  displayCurrency = this.userService.displayCurrency;
  currentUser = this.userService.currentUser;
  walletsLoading = signal(false);
  notifications = this.notificationService.drawerNotifications;
  unreadCount = this.notificationService.unreadCount;
  impersonation = this.authService.impersonation;

  notificationsVisible = signal(false);
  isExitingImpersonation = signal(false);

  primaryWallet = computed(() => {
    const wallets = this.walletService.allWallets();
    const currency = this.displayCurrency();
    return wallets.find((w) => w.currency === currency) ?? wallets[0] ?? null;
  });

  headerWalletItems = computed(() => {
    const wallet = this.primaryWallet();
    if (!wallet) return [];
    const currency = wallet.currency;
    return [
      { key: 'cash', label: 'Cash', shortLabel: 'Cash', amount: wallet.cashBalance, icon: 'pi-wallet' },
      {
        key: 'voucher',
        label: 'Product Voucher',
        shortLabel: 'Voucher',
        amount: wallet.voucherBalance,
        icon: 'pi-ticket',
      },
      {
        key: 'autoship',
        label: 'Autoship',
        shortLabel: 'Autoship',
        amount: wallet.autoshipBalance,
        icon: 'pi-sync',
      },
    ].map((item) => ({
      ...item,
      formatted: this.formatBalance(item.amount, currency),
    }));
  });

  ngOnInit(): void {
    this.notificationService.loadUnreadCount().subscribe();
    this.authService.loadImpersonationState().subscribe();
    this.merchantService.fetchProfile();
    if (this.isPaid()) {
      this.loadWallets();
    }
  }

  private loadWallets(): void {
    this.walletsLoading.set(true);
    this.walletService.fetchWallets().subscribe({
      next: () => this.walletsLoading.set(false),
      error: () => this.walletsLoading.set(false),
    });
  }

  formatBalance(amount: number, currency: 'NGN' | 'USD'): string {
    if (amount == null || amount === 0) return '--';
    const symbol = currency === 'NGN' ? '₦' : '$';
    return `${symbol}${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

  openNotificationsDrawer(): void {
    this.notificationsVisible.set(true);
    if (this.notifications().length === 0) {
      this.notificationService.loadNotifications({ limit: 20 }).subscribe();
    }
  }

  userMenuItems = computed<MenuItem[]>(() => {
    const items: MenuItem[] = [
      {
        label: 'Profile',
        icon: 'pi pi-user',
        command: () => this.router.navigate(['/profile']),
      },
      ...(this.userService.isMerchant() || this.merchantService.isActiveMerchant()
        ? []
        : [
            {
              label: 'Become a Merchant',
              icon: 'pi pi-shop',
              command: () => this.router.navigate(['/merchant/apply']),
            },
          ]),
      {
        label: 'Settings',
        icon: 'pi pi-cog',
        command: () => this.router.navigate(['/settings/account']),
      },
      {
        separator: true,
      },
      {
        label: 'Logout',
        icon: 'pi pi-power-off',
        command: () => this.logout(),
      },
    ];
    return items;
  });

  toggleMobileMenu() {
    this.layoutService.toggleMobileMenu();
  }

  markAllAsRead() {
    this.notificationService.markAllAsRead();
  }

  dismissNotification(id: string): void {
    this.notificationService.dismissFromDrawer(id);
  }

  logout() {
    this.authService.logout().subscribe({
      next: () => {
        this.router.navigate(['/auth/login']);
      },
      error: () => this.router.navigate(['/auth/login']),
    });
  }

  exitImpersonation(): void {
    if (this.isExitingImpersonation()) return;

    this.isExitingImpersonation.set(true);
    this.authService.endImpersonation().subscribe({
      next: (response) => {
        this.isExitingImpersonation.set(false);
        if (typeof window !== 'undefined' && response?.adminDashboardUrl) {
          window.location.href = response.adminDashboardUrl;
          if (window.opener) {
            setTimeout(() => window.close(), 600);
          }
        } else {
          this.router.navigate(['/auth/login']);
        }
      },
      error: () => {
        this.isExitingImpersonation.set(false);
        this.authService.logoutLocal();
        this.router.navigate(['/auth/login']);
      },
    });
  }

  onCartClick(): void {
    this.cartService.dismissCheckoutHint();
  }

  dismissCartCheckoutHint(event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    this.cartService.dismissCheckoutHint();
  }
}
