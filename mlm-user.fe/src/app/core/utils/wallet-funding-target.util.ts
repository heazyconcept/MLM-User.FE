export type WalletFundingTarget = 'CASH' | 'VOUCHER' | 'LEGACY_VOUCHER' | 'LEGACY_CASHOUT';

export const WALLET_FUND_TARGET_KEY = 'mlm_wallet_fund_target';

export function isWalletFundingTarget(value: string | null | undefined): value is WalletFundingTarget {
  return (
    value === 'CASH' ||
    value === 'VOUCHER' ||
    value === 'LEGACY_VOUCHER' ||
    value === 'LEGACY_CASHOUT'
  );
}

/** Online vs bank-transfer picker. Cash funding goes straight to the gateway form. */
export function usesFundingMethodPicker(target: WalletFundingTarget): boolean {
  return target !== 'CASH';
}

export function walletFundingTitle(target: WalletFundingTarget): string {
  switch (target) {
    case 'VOUCHER':
      return 'Fund Product Voucher Wallet';
    case 'LEGACY_VOUCHER':
      return 'Fund Legacy product voucher';
    case 'LEGACY_CASHOUT':
      return 'Fund Legacy cashout';
    default:
      return 'Fund Wallet';
  }
}

export function walletFundingSubtitle(target: WalletFundingTarget): string {
  switch (target) {
    case 'VOUCHER':
      return 'Add funds specifically for purchasing products from the marketplace.';
    case 'LEGACY_VOUCHER':
      return 'This credits your Legacy product voucher, not your network Product Voucher. Use it in the Legacy marketplace.';
    case 'LEGACY_CASHOUT':
      return 'This credits your Legacy cashout. It is your own money, not a commission.';
    default:
      return 'Add funds to your wallet using your preferred payment method.';
  }
}

export function walletFundingSuccessMessage(target: WalletFundingTarget): string {
  switch (target) {
    case 'LEGACY_VOUCHER':
      return 'Your Legacy product voucher has been credited. Redirecting you...';
    case 'LEGACY_CASHOUT':
      return 'Your Legacy cashout has been credited. Redirecting you...';
    default:
      return 'Your wallet has been credited. Redirecting you...';
  }
}

export function walletFundingReturnPath(target: WalletFundingTarget): string {
  switch (target) {
    case 'LEGACY_VOUCHER':
      return '/legacy/voucher';
    case 'LEGACY_CASHOUT':
      return '/legacy/cashout';
    default:
      return '/wallet';
  }
}
