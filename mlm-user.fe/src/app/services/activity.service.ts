import { Injectable, inject, computed, signal } from '@angular/core';
import { WalletService } from './wallet.service';
import { CommissionService } from './commission.service';

export type ActivityType = 'Earnings Posted' | 'Wallet Funding' | 'Withdrawal' | 'Order Placed';
export type ActivityStatus = 'Pending' | 'Approved' | 'Rejected' | 'Completed';

export interface Activity {
  id: string;
  type: ActivityType;
  title: string;
  description: string;
  amount?: number;
  currency?: 'NGN' | 'USD';
  date: string; // ISO string
  status: ActivityStatus;
  icon: string; // PrimeIcons class
  route?: string; // Optional navigation route
}

interface Order {
  id: string;
  date: string;
  items: string[];
  total: number;
  currency: 'NGN' | 'USD';
  status: 'Pending' | 'Completed' | 'Cancelled';
}

@Injectable({
  providedIn: 'root'
})
export class ActivityService {
  private walletService = inject(WalletService);
  private commissionService = inject(CommissionService);
  
  // Mock orders data
  private mockOrders = signal<Order[]>([
    {
      id: 'ord-001',
      date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(), // 2 days ago
      items: ['Premium Health Pack', 'Energy Boost'],
      total: 15000,
      currency: 'NGN',
      status: 'Completed'
    },
    {
      id: 'ord-002',
      date: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(), // 5 days ago
      items: ['Starter Kit'],
      total: 45,
      currency: 'USD',
      status: 'Completed'
    },
    {
      id: 'ord-003',
      date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days ago
      items: ['Wellness Bundle'],
      total: 25000,
      currency: 'NGN',
      status: 'Completed'
    },
    {
      id: 'ord-004',
      date: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(), // 12 hours ago
      items: ['Monthly Subscription'],
      total: 8000,
      currency: 'NGN',
      status: 'Pending'
    }
  ]);

  /**
   * Get recent activities aggregated from all sources
   */
  getRecentActivities(limit: number = 5) {
    return computed(() => {
      const activities: Activity[] = [];

      // 1. Transform transactions (Wallet Funding)
      const transactions = this.walletService.allTransactions();
      transactions
        .filter(t => t.type === 'Deposit')
        .forEach(t => {
          activities.push({
            id: `wallet-${t.id}`,
            type: 'Wallet Funding',
            title: 'Wallet Funded',
            description: t.description || `${t.currency} wallet credited`,
            amount: t.amount,
            currency: t.currency,
            date: t.date,
            status: this.mapTransactionStatus(t.status),
            icon: 'pi-arrow-down-left',
            route: `/wallet/transactions/${t.currency}`
          });
        });

      // 2. Transform commissions (Earnings Posted)
      const commissions = this.commissionService.getAllCommissions()();
      commissions.forEach(c => {
        activities.push({
          id: `commission-${c.id}`,
          type: 'Earnings Posted',
          title: `${c.type} Earned`,
          description: `From ${c.source}`,
          amount: c.amount,
          currency: c.currency,
          date: c.date,
          status: this.mapCommissionStatus(c.status),
          icon: 'pi-bolt',
          route: '/commissions'
        });
      });

      // 3. Transform withdrawals
      const withdrawals = this.walletService.allWithdrawals();
      withdrawals.forEach(w => {
        activities.push({
          id: `withdrawal-${w.id}`,
          type: 'Withdrawal',
          title: 'Withdrawal Request',
          description: `To ${w.bankName}`,
          amount: w.amount,
          currency: w.currency,
          date: w.date,
          status: this.mapWithdrawalStatus(w.status),
          icon: 'pi-arrow-up-right',
          route: '/withdrawals'
        });
      });

      // 4. Transform orders
      const orders = this.mockOrders();
      orders.forEach(o => {
        activities.push({
          id: `order-${o.id}`,
          type: 'Order Placed',
          title: 'Order Placed',
          description: o.items.join(', '),
          amount: o.total,
          currency: o.currency,
          date: o.date,
          status: this.mapOrderStatus(o.status),
          icon: 'pi-shopping-bag',
          route: '/orders'
        });
      });

      // Sort by date (newest first) and limit
      return activities
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .slice(0, limit);
    });
  }

  private mapTransactionStatus(status: 'Pending' | 'Approved' | 'Rejected'): ActivityStatus {
    return status;
  }

  private mapCommissionStatus(status: 'Pending' | 'Approved' | 'Locked'): ActivityStatus {
    if (status === 'Locked') return 'Pending';
    return status;
  }

  private mapWithdrawalStatus(status: 'Pending' | 'Approved' | 'Rejected'): ActivityStatus {
    return status;
  }

  private mapOrderStatus(status: 'Pending' | 'Completed' | 'Cancelled'): ActivityStatus {
    if (status === 'Completed') return 'Completed';
    if (status === 'Cancelled') return 'Rejected';
    return 'Pending';
  }
}

