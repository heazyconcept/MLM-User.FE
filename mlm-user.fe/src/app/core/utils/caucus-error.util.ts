import { CAUCUS_ERROR_CODES } from '../models/caucus.models';

export function caucusErrorMessage(err: unknown): string {
  const http = err as {
    error?: { code?: string; message?: string | string[] };
    message?: string;
  };
  const code = http?.error?.code;
  if (typeof code === 'string' && MESSAGES[code]) {
    return MESSAGES[code];
  }
  const msg = http?.error?.message;
  if (Array.isArray(msg)) {
    return msg.join(', ');
  }
  if (typeof msg === 'string' && msg.trim()) {
    return msg;
  }
  if (code === CAUCUS_ERROR_CODES.CAUCUS_INSUFFICIENT_BALANCE) {
    return MESSAGES[CAUCUS_ERROR_CODES.CAUCUS_INSUFFICIENT_BALANCE];
  }
  return http?.message ?? 'Something went wrong.';
}

const MESSAGES: Record<string, string> = {
  [CAUCUS_ERROR_CODES.CAUCUS_APPEAL_OPEN]: 'You already have an appeal waiting for review.',
  [CAUCUS_ERROR_CODES.CAUCUS_APPEAL_NOT_ALLOWED]: 'Your membership is active.',
  [CAUCUS_ERROR_CODES.CAUCUS_NOT_ON_TEAM]: 'You are not on the Caucus Team.',
  [CAUCUS_ERROR_CODES.CAUCUS_BANK_REQUIRED]: 'Add your bank account to cash out.',
  [CAUCUS_ERROR_CODES.CAUCUS_INSUFFICIENT_BALANCE]:
    'Amount is above the wallet balance. Refresh and try again.',
  [CAUCUS_ERROR_CODES.IMPERSONATION_ACTION_BLOCKED]: 'This action is disabled during impersonation.',
  INVALID_PIN: 'Incorrect transaction PIN.',
};
