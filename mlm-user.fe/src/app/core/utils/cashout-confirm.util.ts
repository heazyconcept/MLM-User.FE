import type { ConfirmationService } from 'primeng/api';
import { formatCashoutConfirmMessage } from './cashout-charge.util';

export function confirmCashoutCharge(
  confirmationService: ConfirmationService,
  options: {
    amount: number;
    feeRate: number;
    currency: 'NGN' | 'USD';
    header?: string;
    accept: () => void;
  },
): void {
  confirmationService.confirm({
    header: options.header ?? 'Confirm cash out',
    message: formatCashoutConfirmMessage(options.amount, options.feeRate, options.currency),
    icon: 'pi pi-wallet',
    acceptLabel: 'Confirm',
    rejectLabel: 'Cancel',
    accept: options.accept,
  });
}
