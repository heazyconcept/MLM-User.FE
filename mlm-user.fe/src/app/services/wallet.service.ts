import { Injectable, signal, computed, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { delay, tap } from 'rxjs/operators';
import { ModalService } from './modal.service';
import { NotificationService } from './notification.service';


export interface Wallet {
  id: string;
  currency: 'NGN' | 'USD';
  balance: number;
  cashBalance: number;
  voucherBalance: number;
  autoshipBalance: number;
}

export interface Transaction {
  id: string;
  date: string;
  type: 'Deposit' | 'Commission' | 'Withdrawal';
  amount: number;
  currency: 'NGN' | 'USD';
  status: 'Pending' | 'Approved' | 'Rejected';
  description?: string;
}

export interface WithdrawalRequest {
  id: string;
  date: string;
  currency: 'NGN' | 'USD';
  amount: number;
  status: 'Pending' | 'Approved' | 'Rejected';
  bankName: string;
  accountNumber: string;
  accountName: string;
}

const WALLET_KEY = 'mlm_wallets';
const WITHDRAWAL_HISTORY_KEY = 'mlm_withdrawal_history';

@Injectable({
  providedIn: 'root'
})
export class WalletService {
  private wallets = signal<Wallet[]>([]);
  private transactions = signal<Transaction[]>([]);
  private withdrawalRequests = signal<WithdrawalRequest[]>([]);
  private modalService = inject(ModalService);
  private notificationService = inject(NotificationService);


  readonly allWallets = computed(() => this.wallets());

  readonly allTransactions = computed(() => this.transactions());
  readonly allWithdrawals = computed(() => this.withdrawalRequests());

  // Total balance across all wallets (aggregated)
  readonly totalBalance = computed(() => {
    const wallets = this.wallets();
    return wallets.reduce((sum, w) => sum + w.balance, 0);
  });

  // Total cash balance (withdrawable)
  readonly totalCashBalance = computed(() => {
    const wallets = this.wallets();
    return wallets.reduce((sum, w) => sum + w.cashBalance, 0);
  });

  // Total voucher balance
  readonly totalVoucherBalance = computed(() => {
    const wallets = this.wallets();
    return wallets.reduce((sum, w) => sum + w.voucherBalance, 0);
  });

  // Total autoship balance
  readonly totalAutoshipBalance = computed(() => {
    const wallets = this.wallets();
    return wallets.reduce((sum, w) => sum + w.autoshipBalance, 0);
  });

  constructor() {
    this.initialLoad();
  }

  private initialLoad() {
    // Load wallets
    const savedWallets = localStorage.getItem(WALLET_KEY);
    if (savedWallets) {
      let wallets = JSON.parse(savedWallets) as Wallet[];
      // Migration: Ensure new fields exist
      const migrationNeeded = wallets.some(w => w.cashBalance === undefined);
      if (migrationNeeded) {
        wallets = wallets.map(w => ({
          ...w,
          cashBalance: w.cashBalance ?? (w.balance * 0.6),
          voucherBalance: w.voucherBalance ?? (w.balance * 0.2),
          autoshipBalance: w.autoshipBalance ?? (w.balance * 0.2)
        }));
        this.persistWallets(wallets);
      }
      this.wallets.set(wallets);
    } else {
      // Default mock wallets
      const defaultWallets: Wallet[] = [
        { id: '1', currency: 'NGN', balance: 250000.50, cashBalance: 150000.50, voucherBalance: 50000, autoshipBalance: 50000 },
        { id: '2', currency: 'USD', balance: 1250.75, cashBalance: 850.75, voucherBalance: 200, autoshipBalance: 200 }
      ];
      this.wallets.set(defaultWallets);
      this.persistWallets(defaultWallets);
    }

    // Load withdrawal history
    const savedHistory = localStorage.getItem(WITHDRAWAL_HISTORY_KEY);
    if (savedHistory) {
      this.withdrawalRequests.set(JSON.parse(savedHistory));
    } else {
      // Default mock initial history
      const initialHistory: WithdrawalRequest[] = [
        { id: 'w1', date: '2023-10-20T10:00:00Z', currency: 'NGN', amount: 5000, status: 'Approved', bankName: 'Access Bank', accountNumber: '1234567890', accountName: 'John Doe' },
        { id: 'w2', date: '2023-10-21T14:30:00Z', currency: 'USD', amount: 100, status: 'Pending', bankName: 'Global Bank', accountNumber: '9876543210', accountName: 'John Doe' }
      ];
      this.withdrawalRequests.set(initialHistory);
      this.persistWithdrawals(initialHistory);
    }
  }

  private persistWallets(wallets: Wallet[]) {
    localStorage.setItem(WALLET_KEY, JSON.stringify(wallets));
  }

  private persistWithdrawals(history: WithdrawalRequest[]) {
    localStorage.setItem(WITHDRAWAL_HISTORY_KEY, JSON.stringify(history));
  }



  getWallet(currency: 'NGN' | 'USD') {
    return computed(() => this.wallets().find(w => w.currency === currency));
  }

  fetchWallets(): Observable<Wallet[]> {
    return of(this.wallets()).pipe(delay(800));
  }


  fetchTransactions(currency?: 'NGN' | 'USD'): Observable<Transaction[]> {
    // Mock API transactions
    const mockTransactions: Transaction[] = [];



    const filtered = currency ? mockTransactions.filter(t => t.currency === currency) : mockTransactions;
    
    return of(filtered).pipe(
      delay(1200), // Slightly longer delay to appreciate skeleton loader
      tap(data => this.transactions.set(data))
    );
  }


  withdraw(params: { 
    currency: 'NGN' | 'USD', 
    amount: number,
    bankName: string,
    accountNumber: string,
    accountName: string
  }): Observable<boolean> {
    const { currency, amount, bankName, accountNumber, accountName } = params;
    
    // Mock withdrawal logic
    return of(true).pipe(
      delay(1500),
      tap(() => {
        // Update wallet balance
        const updatedWallets = this.wallets().map(w => 
          w.currency === currency ? { ...w, balance: w.balance - amount } : w
        );
        this.wallets.set(updatedWallets);
        this.persistWallets(updatedWallets);

        // Add to withdrawal history
        const newWithdrawal: WithdrawalRequest = {
          id: 'wdr-' + Math.random().toString(36).substr(2, 9),
          date: new Date().toISOString(),
          currency,
          amount,
          status: 'Pending',
          bankName,
          accountNumber,
          accountName
        };

        const updatedHistory = [newWithdrawal, ...this.withdrawalRequests()];
        this.withdrawalRequests.set(updatedHistory);
        this.persistWithdrawals(updatedHistory);

        // Show "Withdrawal Submitted" modal
        this.modalService.open(
          'success',
          'Withdrawal Submitted',
          `Your withdrawal request of ${currency === 'NGN' ? '₦' : '$'}${amount} has been successfully submitted and is currently pending admin approval.`
        );

        this.notificationService.add({
          title: 'Withdrawal Submitted',
          message: `Your withdrawal of ${currency === 'NGN' ? '₦' : '$'}${amount} is pending.`,
          type: 'info',
          category: 'wallet'
        });

        // Simulate Mock Admin Approval after 10 seconds

        this.simulateAdminApproval(newWithdrawal.id);
      })
    );
  }

  private simulateAdminApproval(withdrawalId: string) {
    setTimeout(() => {
      const history = this.withdrawalRequests();
      const withdrawalIndex = history.findIndex(w => w.id === withdrawalId);
      
      if (withdrawalIndex !== -1) {
        // 80% chance for approval for testing purposes
        const isApproved = Math.random() > 0.2;
        const status = isApproved ? 'Approved' : 'Rejected';
        
        const updatedHistory = [...history];
        updatedHistory[withdrawalIndex] = {
          ...updatedHistory[withdrawalIndex],
          status
        };
        
        this.withdrawalRequests.set(updatedHistory);
        this.persistWithdrawals(updatedHistory);

        // Notify user via modal
        this.modalService.open(
          isApproved ? 'success' : 'error',
          `Withdrawal ${status}`,
          `Your withdrawal request (${withdrawalId}) has been ${status.toLowerCase()} by the admin.`,
          '/withdrawals'
        );

        this.notificationService.add({
          title: `Withdrawal ${status}`,
          message: `Request ${withdrawalId} was ${status.toLowerCase()}.`,
          type: isApproved ? 'success' : 'error',
          category: 'wallet'
        });
      }

    }, 10000); // 10 seconds delay
  }



  fetchWithdrawals(): Observable<WithdrawalRequest[]> {
     return of(this.withdrawalRequests()).pipe(delay(800));
  }

}

