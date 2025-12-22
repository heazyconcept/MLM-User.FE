import { Routes } from '@angular/router';
import { LoginComponent } from './pages/auth/login/login.component';
import { DashboardLayoutComponent } from './layouts/dashboard-layout/dashboard-layout.component';

export const routes: Routes = [
  { path: '', redirectTo: 'login', pathMatch: 'full' },
  { path: 'login', component: LoginComponent },
  { 
    path: 'register', 
    loadComponent: () => import('./pages/auth/register/register.component').then(m => m.RegisterComponent) 
  },
  {
    path: 'dashboard',
    component: DashboardLayoutComponent,
    children: [
      {
        path: '',
        loadComponent: () => import('./pages/dashboard/dashboard.component').then(m => m.DashboardComponent)
      }
    ]
  },
  {
    path: 'profile',
    component: DashboardLayoutComponent,
    children: [
      {
        path: '',
        loadComponent: () => import('./pages/profile/profile.component').then(m => m.ProfileComponent)
      }
    ]
  },
  {
    path: 'shop',
    component: DashboardLayoutComponent,
    children: [
      {
        path: '',
        loadComponent: () => import('./pages/placeholder/placeholder.component').then(m => m.PlaceholderComponent),
        data: { title: 'Shop' }
      }
    ]
  },
  {
    path: 'wallet',
    component: DashboardLayoutComponent,
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
    component: DashboardLayoutComponent,
    children: [
      {
        path: '',
        loadComponent: () => import('./pages/placeholder/placeholder.component').then(m => m.PlaceholderComponent),
        data: { title: 'Network' }
      }
    ]
  },
  {
    path: 'commissions',
    component: DashboardLayoutComponent,
    children: [
      {
        path: '',
        loadComponent: () => import('./pages/commissions/earnings-overview.component').then(m => m.EarningsOverviewComponent)
      },
      {
        path: 'breakdown',
        loadComponent: () => import('./pages/commissions/commission-breakdown.component').then(m => m.CommissionBreakdownComponent)
      }
    ]
  },
  {
    path: 'withdrawals',
    component: DashboardLayoutComponent,
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
    component: DashboardLayoutComponent,
    children: [
      {
        path: '',
        loadComponent: () => import('./pages/placeholder/placeholder.component').then(m => m.PlaceholderComponent),
        data: { title: 'Orders' }
      }
    ]
  }
];
