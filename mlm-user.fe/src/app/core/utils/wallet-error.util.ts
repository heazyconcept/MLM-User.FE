import type { InsufficientBalanceError } from '../../services/wallet.service';

export function parseApiErrorMessage(message: string): string | InsufficientBalanceError {
  if (message.startsWith('{')) {
    try {
      return JSON.parse(message) as InsufficientBalanceError;
    } catch {
      return message;
    }
  }
  return message;
}

export function formatInsufficientBalanceError(
  err: InsufficientBalanceError,
  currencySymbol: string,
): string {
  const available = err.availableDisplayAmount.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const requested = err.requestedDisplayAmount.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `Insufficient balance. Available: ${currencySymbol}${available} (requested: ${currencySymbol}${requested}).`;
}

export function resolveWalletErrorMessage(
  rawMessage: unknown,
  currency: 'NGN' | 'USD',
): string {
  const message = Array.isArray(rawMessage) ? rawMessage[0] : String(rawMessage ?? '');
  if (!message) {
    return 'Operation failed. Please try again or contact support.';
  }

  const parsed = parseApiErrorMessage(message);
  if (typeof parsed === 'string') {
    return parsed;
  }

  const symbol = currency === 'NGN' ? '₦' : '$';
  return formatInsufficientBalanceError(parsed, symbol);
}
