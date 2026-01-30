import { Routes } from '@angular/router';
// import { LoginComponent } from './auth/login/login.component';

export const routes: Routes = [
  { path: '', redirectTo: 'auth/login', pathMatch: 'full' },
  {
    path: 'auth',
    children: [
      { 
        path: 'login', 
        loadComponent: () => import('./auth/login-modern/login-modern.component').then(m => m.LoginModernComponent)
      },
      { 
        path: 'register', 
        loadComponent: () => import('./auth/register/register.component').then(m => m.RegisterComponent) 
      },
      {
        path: 'forgot-password',
        loadComponent: () => import('./auth/forgot-password/forgot-password.component').then(m => m.ForgotPasswordComponent)
      },
      {
        path: 'reset-password',
        loadComponent: () => import('./auth/reset-password/reset-password.component').then(m => m.ResetPasswordComponent)
      },
      {
        path: 'verify',
        loadComponent: () => import('./auth/verify/verify.component').then(m => m.VerifyComponent)
      },
      {
        path: 'logout',
        redirectTo: 'login'
      }
    ]
  },
  {
    path: 'onboarding',
    loadComponent: () => import('./onboarding/layouts/onboarding-layout/onboarding-layout.component').then(m => m.OnboardingLayoutComponent),
    children: [
      { path: '', redirectTo: 'profile', pathMatch: 'full' },
      { 
        path: 'profile', 
        loadComponent: () => import('./onboarding/pages/profile/profile.component').then(m => m.ProfileInfoComponent) 
      },
      { 
        path: 'contact', 
        loadComponent: () => import('./onboarding/pages/contact/contact-details.component').then(m => m.ContactDetailsComponent) 
      },
      { 
        path: 'identity', 
        loadComponent: () => import('./onboarding/pages/identity/identity-kyc.component').then(m => m.IdentityKycComponent) 
      },
      { 
        path: 'bank', 
        loadComponent: () => import('./onboarding/pages/bank/bank-details.component').then(m => m.BankDetailsComponent) 
      },
      { 
        path: 'preferences', 
        loadComponent: () => import('./onboarding/pages/preferences/preferences.component').then(m => m.PreferencesComponent) 
      }
    ]
  },
  {
    path: 'dashboard',
    loadComponent: () => import('./layouts/dashboard-layout/dashboard-layout.component').then(m => m.DashboardLayoutComponent),
    children: [
      {
        path: '',
        loadComponent: () => import('./pages/dashboard/dashboard.component').then(m => m.DashboardComponent)
      }
    ]
  },
  {
    path: 'profile',
    loadComponent: () => import('./layouts/dashboard-layout/dashboard-layout.component').then(m => m.DashboardLayoutComponent),
    children: [
      {
        path: '',
        loadComponent: () => import('./pages/profile/profile.component').then(m => m.ProfileComponent)
      }
    ]
  },
  { path: 'shop', redirectTo: 'marketplace', pathMatch: 'full' },
  {
    path: 'marketplace',
    loadComponent: () => import('./layouts/dashboard-layout/dashboard-layout.component').then(m => m.DashboardLayoutComponent),
    children: [
      {
        path: '',
        loadComponent: () => import('./pages/shop/shop.component').then(m => m.ShopComponent),
        data: { title: 'Marketplace' }
      },
      {
        path: 'product/:id',
        loadComponent: () => import('./pages/shop/product-detail-page/product-detail-page.component').then(m => m.ProductDetailPageComponent),
        data: { title: 'Product' }
      }
    ]
  },
  {
    path: 'wallet',
    loadComponent: () => import('./layouts/dashboard-layout/dashboard-layout.component').then(m => m.DashboardLayoutComponent),
    children: [
      {
        path: '',
        loadComponent: () => import('./pages/wallet/wallet.component').then(m => m.WalletComponent)
      },
      {
        path: 'transactions/:currency',
        loadComponent: () => import('./pages/wallet/transactions/transaction-history.component').then(m => m.TransactionHistoryComponent)
      }
    ]
  },


  {
    path: 'network',
    loadComponent: () => import('./layouts/dashboard-layout/dashboard-layout.component').then(m => m.DashboardLayoutComponent),
    children: [
      { path: '', redirectTo: 'overview', pathMatch: 'full' },
      {
        path: 'overview',
        loadComponent: () => import('./pages/network/overview/network-overview.component').then(m => m.NetworkOverviewComponent),
        data: { title: 'Network Overview' }
      },
      {
        path: 'referrals',
        loadComponent: () => import('./pages/network/referrals/referral-link.component').then(m => m.ReferralLinkComponent),
        data: { title: 'Referral Link' }
      },
      {
        path: 'matrix',
        loadComponent: () => import('./pages/network/matrix/matrix-tree.component').then(m => m.MatrixTreeComponent),
        data: { title: 'Matrix Tree' }
      },
      {
        path: 'downline',
        loadComponent: () => import('./pages/network/downline/downline-list.component').then(m => m.DownlineListComponent),
        data: { title: 'Downline List' }
      },
      {
        path: 'performance',
        loadComponent: () => import('./pages/network/performance/performance-cpv.component').then(m => m.PerformanceCpvComponent),
        data: { title: 'Performance Stats' }
      }
    ]
  },
  {
    path: 'commissions',
    loadComponent: () => import('./layouts/dashboard-layout/dashboard-layout.component').then(m => m.DashboardLayoutComponent),
    children: [
      {
        path: '',
        loadComponent: () => import('./pages/commissions/earnings-overview.component').then(m => m.EarningsOverviewComponent)
      },
      {
        path: 'breakdown',
        loadComponent: () => import('./pages/commissions/commission-breakdown.component').then(m => m.CommissionBreakdownComponent)
      },
      {
        path: 'bonuses',
        loadComponent: () => import('./pages/commissions/bonuses.component').then(m => m.BonusesComponent)
      },
      {
        path: 'ranking',
        loadComponent: () => import('./pages/commissions/ranking.component').then(m => m.RankingComponent)
      },
      {
        path: 'cpv',
        loadComponent: () => import('./pages/commissions/cpv-milestones.component').then(m => m.CpvMilestonesComponent)
      }
    ]
  },
  {
    path: 'transactions',
    loadComponent: () => import('./layouts/dashboard-layout/dashboard-layout.component').then(m => m.DashboardLayoutComponent),
    children: [
      {
        path: '',
        loadComponent: () => import('./pages/transactions/transactions.component').then(m => m.TransactionsComponent),
        data: { title: 'Transactions' }
      }
    ]
  },
  {
    path: 'withdrawals',
    loadComponent: () => import('./layouts/dashboard-layout/dashboard-layout.component').then(m => m.DashboardLayoutComponent),
    children: [
      {
        path: '',
        loadComponent: () => import('./pages/wallet/withdrawals/withdrawal-history.component').then(m => m.WithdrawalHistoryComponent),
        data: { title: 'Withdrawals' }
      }
    ]
  },
  {
    path: 'orders',
    loadComponent: () => import('./layouts/dashboard-layout/dashboard-layout.component').then(m => m.DashboardLayoutComponent),
    children: [
      {
        path: '',
        loadComponent: () => import('./pages/orders/orders-overview/orders-overview.component').then(m => m.OrdersOverviewComponent),
        data: { title: 'Orders' }
      },
      {
        path: 'preview',
        loadComponent: () => import('./pages/orders/order-preview/order-preview.component').then(m => m.OrderPreviewComponent),
        data: { title: 'Fulfilment options' }
      },
      {
        path: ':id',
        loadComponent: () => import('./pages/orders/order-detail/order-detail.component').then(m => m.OrderDetailComponent),
        data: { title: 'Order details' }
      }
    ]
  }
];
