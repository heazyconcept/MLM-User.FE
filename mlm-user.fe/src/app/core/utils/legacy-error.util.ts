import { LEGACY_ERROR_CODES } from '../models/legacy-club.models';
import { LegacyClubHttpError } from '../mocks/legacy-club.mock';

export function legacyErrorMessage(err: unknown, fallback = 'Something went wrong.'): string {
  if (err instanceof LegacyClubHttpError) {
    switch (err.code) {
      case LEGACY_ERROR_CODES.SPONSOR_NOT_FOUND:
        return 'We could not find that username.';
      case LEGACY_ERROR_CODES.SPONSOR_NOT_LEGACY:
        return 'That member has not joined Legacy Club yet.';
      case LEGACY_ERROR_CODES.SPONSOR_SELF:
        return 'You cannot register yourself.';
      case LEGACY_ERROR_CODES.SPONSOR_USERNAME_REQUIRED:
        return 'Enter a Legacy Club username.';
      case LEGACY_ERROR_CODES.SPONSOR_MUST_BE_AUTO:
        return 'Your Segulah sponsor is already in Legacy Club.';
      case LEGACY_ERROR_CODES.PACKAGE_INACTIVE:
        return 'That package is not available.';
      case LEGACY_ERROR_CODES.ALREADY_ACTIVE:
        return 'You are already in Legacy Club.';
      case LEGACY_ERROR_CODES.REGISTRATION_UNPAID:
        return 'Complete your Segulah registration payment first.';
      case LEGACY_ERROR_CODES.LEGACY_CART_BELOW_PACKAGE:
        return err.message || 'Add more products to meet the package amount.';
      case LEGACY_ERROR_CODES.LEGACY_VOUCHER_REQUIRED:
        return 'Pay with Legacy product voucher only.';
      case LEGACY_ERROR_CODES.IMPERSONATION_ACTION_BLOCKED:
        return 'Action disabled during impersonation.';
      case 'WALLET_LOCKED':
        return 'Your Legacy account is locked. Contact support.';
      case 'INSUFFICIENT_BALANCE':
        return err.message || 'Insufficient balance.';
      case 'INVALID_PIN':
        return 'Incorrect transaction PIN.';
      case 'PACKAGE_NOT_HIGHER':
        return 'Choose a higher Legacy package.';
      case 'CYCLE_NOT_COMPLETE':
        return 'You can reactivate after your 6-month cycle is complete.';
      case 'NOT_LEGACY_MEMBER':
        return 'Join Legacy Club first.';
      default:
        return mapPinValidationMessage(err.message) ?? err.message ?? fallback;
    }
  }
  const http = err as { error?: { message?: string | string[]; code?: string }; message?: string };
  const raw =
    typeof http?.error?.message === 'string'
      ? http.error.message
      : Array.isArray(http?.error?.message)
        ? http.error.message.join(' ')
        : http?.message;
  return mapPinValidationMessage(raw) ?? raw ?? fallback;
}

function mapPinValidationMessage(message: string | undefined): string | null {
  if (!message) return null;
  const normalized = message.toLowerCase();
  if (
    normalized.includes('pin must match') ||
    normalized.includes('pin must be a string') ||
    normalized.includes('pin should not be empty') ||
    normalized.includes('pin must be longer') ||
    normalized.includes('pin is required')
  ) {
    return 'Enter your 4-digit transaction PIN to continue.';
  }
  return null;
}
