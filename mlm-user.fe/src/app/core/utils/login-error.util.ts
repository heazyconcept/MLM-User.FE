import { HttpErrorResponse } from '@angular/common/http';

const INVALID_CREDENTIALS_MESSAGE = 'Invalid username or password. Please try again.';
const RATE_LIMIT_FALLBACK = 'Too many requests. Please try again later.';
const PROFILE_LOAD_FALLBACK =
  'Your account was verified but we could not load your profile. Please try again.';
const NETWORK_ERROR_MESSAGE = 'Network error. Please check your connection and try again.';
const LOGIN_FAILED_FALLBACK = 'Login failed. Please try again.';
const SERVER_ERROR_SANITIZED = 'Unable to complete the request. Please try again.';

function extractApiMessage(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') return null;

  const record = payload as Record<string, unknown>;
  const raw = record['message'];

  if (typeof raw === 'string' && raw.trim()) {
    return raw;
  }

  if (Array.isArray(raw)) {
    const joined = raw
      .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
      .join(' ')
      .trim();
    if (joined) return joined;
  }

  const errorField = record['error'];
  if (typeof errorField === 'string' && errorField.trim()) {
    return errorField;
  }

  return null;
}

function sanitizeUserFacingError(message: string): string {
  const normalized = message.trim().toLowerCase();

  if (
    normalized.includes('database operation failed') ||
    normalized.includes('database error') ||
    normalized.includes('internal server error')
  ) {
    return SERVER_ERROR_SANITIZED;
  }

  return message;
}

function isLoginRequest(url: string | null): boolean {
  return url?.includes('auth/login') ?? false;
}

function isProfileRequest(url: string | null): boolean {
  return url?.includes('users/me') ?? false;
}

export function resolveLoginErrorMessage(err: HttpErrorResponse): string {
  if (err.error instanceof ErrorEvent) {
    return NETWORK_ERROR_MESSAGE;
  }

  if (err.status === 401 && isLoginRequest(err.url)) {
    return INVALID_CREDENTIALS_MESSAGE;
  }

  if (err.status === 429) {
    return sanitizeUserFacingError(extractApiMessage(err.error) ?? RATE_LIMIT_FALLBACK);
  }

  if (isProfileRequest(err.url)) {
    const apiMessage = extractApiMessage(err.error);
    return apiMessage
      ? sanitizeUserFacingError(apiMessage)
      : PROFILE_LOAD_FALLBACK;
  }

  const apiMessage = extractApiMessage(err.error);
  if (apiMessage) {
    return sanitizeUserFacingError(apiMessage);
  }

  return LOGIN_FAILED_FALLBACK;
}
