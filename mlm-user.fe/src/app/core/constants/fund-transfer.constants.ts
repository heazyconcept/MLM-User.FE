import type { WalletType } from '../../services/wallet.service';

export type FundTransferSourceWallet = 'CASH' | 'REGISTRATION';

export const FUND_TRANSFER_TARGETS: Record<FundTransferSourceWallet, WalletType[]> = {
  CASH: ['CASH', 'REGISTRATION', 'VOUCHER', 'AUTOSHIP'],
  REGISTRATION: ['REGISTRATION', 'CASH', 'VOUCHER', 'AUTOSHIP'],
};

export const FUND_TRANSFER_SOURCE_OPTIONS: { value: FundTransferSourceWallet; label: string }[] = [
  { value: 'CASH', label: 'Cash Wallet' },
  { value: 'REGISTRATION', label: 'Registration Wallet' },
];

export const WALLET_TYPE_LABELS: Record<WalletType, string> = {
  CASH: 'Cash wallet',
  REGISTRATION: 'Registration wallet',
  VOUCHER: 'Product voucher wallet',
  AUTOSHIP: 'Autoship wallet',
};

export function getFundTransferTargetOptions(
  fromWalletType: FundTransferSourceWallet,
): { value: WalletType; label: string }[] {
  return (FUND_TRANSFER_TARGETS[fromWalletType] ?? []).map((value) => ({
    value,
    label: WALLET_TYPE_LABELS[value],
  }));
}
