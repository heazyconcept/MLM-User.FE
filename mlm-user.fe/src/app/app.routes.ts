import { Routes } from '@angular/router';
import { LoginComponent } from './auth/login/login.component';
import { DashboardLayoutComponent } from './layouts/dashboard-layout/dashboard-layout.component';

export const routes: Routes = [
  { path: '', redirectTo: 'auth/login', pathMatch: 'full' },
  {
    path: 'auth',
    children: [
      { path: 'login', component: LoginComponent },
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
