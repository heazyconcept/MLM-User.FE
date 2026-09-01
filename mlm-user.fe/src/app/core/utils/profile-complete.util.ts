import { HttpErrorResponse } from '@angular/common/http';

export const PROFILE_INCOMPLETE_CODE = 'PROFILE_INCOMPLETE';
export const PROFILE_SETUP_PATH = '/profile';
export const PROFILE_SETUP_QUERY = { setup: 'complete' } as const;
export const PROFILE_SETUP_TITLE = 'Complete your profile';
export const PROFILE_SETUP_ACTION_LABEL = 'Update profile';
export const PROFILE_SETUP_LOGIN_MESSAGE =
  'Merchants need your phone number to fulfil orders. Add your contact and bank details to continue.';

export type ProfileMissingField =
  | 'firstName'
  | 'lastName'
  | 'phone'
  | 'address'
  | 'bankName'
  | 'accountNumber'
  | 'accountName';

export type PostLoginRedirect = {
  path: string;
  queryParams?: Record<string, string>;
  promptProfile: boolean;
};

const KNOWN_FIELDS = new Set<ProfileMissingField>([
  'firstName',
  'lastName',
  'phone',
  'address',
  'bankName',
  'accountNumber',
  'accountName',
]);

const FIELD_LABELS: Record<ProfileMissingField, string> = {
  firstName: 'first name',
  lastName: 'last name',
  phone: 'phone number',
  address: 'address',
  bankName: 'bank name',
  accountNumber: 'account number',
  accountName: 'account name',
};

function isProfileMissingField(value: unknown): value is ProfileMissingField {
  return typeof value === 'string' && KNOWN_FIELDS.has(value as ProfileMissingField);
}

export function parseProfileMissingFields(raw: unknown): ProfileMissingField[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(isProfileMissingField);
}

export function formatProfileMissingFields(fields: readonly string[]): string {
  const labels = parseProfileMissingFields(fields).map((field) => FIELD_LABELS[field]);
  if (labels.length === 0) return '';
  if (labels.length === 1) return labels[0];
  if (labels.length === 2) return `${labels[0]} and ${labels[1]}`;
  return `${labels.slice(0, -1).join(', ')}, and ${labels[labels.length - 1]}`;
}

function errorPayload(err: unknown): Record<string, unknown> | null {
  if (!err || typeof err !== 'object') return null;
  if (err instanceof HttpErrorResponse) {
    return err.error && typeof err.error === 'object'
      ? (err.error as Record<string, unknown>)
      : null;
  }
  return err as Record<string, unknown>;
}

export function isProfileIncompleteError(err: unknown): boolean {
  const payload = errorPayload(err);
  return payload?.['code'] === PROFILE_INCOMPLETE_CODE;
}

export function profileIncompleteMissingFields(err: unknown): ProfileMissingField[] {
  const payload = errorPayload(err);
  return parseProfileMissingFields(payload?.['missingFields'] ?? payload?.['profileMissingFields']);
}

export function resolvePostLoginRedirect(
  paymentStatus: 'PAID' | 'UNPAID',
  isProfileComplete: boolean | undefined,
): PostLoginRedirect {
  if (paymentStatus !== 'PAID') {
    return { path: '/auth/activation', promptProfile: false };
  }
  if (isProfileComplete === false) {
    return {
      path: PROFILE_SETUP_PATH,
      queryParams: { ...PROFILE_SETUP_QUERY },
      promptProfile: true,
    };
  }
  return { path: '/dashboard', promptProfile: false };
}

export function checkoutProfileMessage(missingFields?: readonly string[]): string {
  const listed = formatProfileMissingFields(missingFields ?? []);
  if (listed) {
    return `Finish your profile before placing an order. Still needed: ${listed}.`;
  }
  return 'Finish your profile before placing an order. Merchants need your phone number to contact you.';
}
