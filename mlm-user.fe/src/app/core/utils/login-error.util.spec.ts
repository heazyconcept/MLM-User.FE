import { HttpErrorResponse } from '@angular/common/http';
import { describe, it, expect } from 'vitest';
import { resolveLoginErrorMessage } from './login-error.util';

const LOGIN_URL = 'https://api.segulah.ng/auth/login';
const PROFILE_URL = 'https://api.segulah.ng/users/me';

describe('resolveLoginErrorMessage', () => {
  it('returns fixed credentials message for 401 on auth/login', () => {
    const err = new HttpErrorResponse({
      error: { message: 'Invalid credentials' },
      status: 401,
      statusText: 'Unauthorized',
      url: LOGIN_URL,
    });

    expect(resolveLoginErrorMessage(err)).toBe(
      'Invalid username or password. Please try again.',
    );
  });

  it('returns API message for 429 rate limit', () => {
    const err = new HttpErrorResponse({
      error: { message: 'Too many requests' },
      status: 429,
      statusText: 'Too Many Requests',
      url: LOGIN_URL,
    });

    expect(resolveLoginErrorMessage(err)).toBe('Too many requests');
  });

  it('returns rate-limit fallback when 429 has no body', () => {
    const err = new HttpErrorResponse({
      error: null,
      status: 429,
      statusText: 'Too Many Requests',
      url: LOGIN_URL,
    });

    expect(resolveLoginErrorMessage(err)).toBe('Too many requests. Please try again later.');
  });

  it('sanitizes internal server error messages', () => {
    const err = new HttpErrorResponse({
      error: { message: 'Internal server error' },
      status: 500,
      statusText: 'Internal Server Error',
      url: LOGIN_URL,
    });

    expect(resolveLoginErrorMessage(err)).toBe('Unable to complete the request. Please try again.');
  });

  it('returns profile fallback for users/me failures without API message', () => {
    const err = new HttpErrorResponse({
      error: null,
      status: 500,
      statusText: 'Internal Server Error',
      url: PROFILE_URL,
    });

    expect(resolveLoginErrorMessage(err)).toBe(
      'Your account was verified but we could not load your profile. Please try again.',
    );
  });

  it('returns API message for users/me failures when present', () => {
    const err = new HttpErrorResponse({
      error: { message: 'Profile service unavailable' },
      status: 503,
      statusText: 'Service Unavailable',
      url: PROFILE_URL,
    });

    expect(resolveLoginErrorMessage(err)).toBe('Profile service unavailable');
  });

  it('does not show credentials message for 401 on users/me', () => {
    const err = new HttpErrorResponse({
      error: { message: 'Unauthorized' },
      status: 401,
      statusText: 'Unauthorized',
      url: PROFILE_URL,
    });

    expect(resolveLoginErrorMessage(err)).toBe('Unauthorized');
    expect(resolveLoginErrorMessage(err)).not.toContain('Invalid username or password');
  });

  it('returns network error message for client-side failures', () => {
    const err = new HttpErrorResponse({
      error: new ErrorEvent('error', { message: 'Failed to fetch' }),
      status: 0,
      statusText: 'Unknown Error',
      url: LOGIN_URL,
    });

    expect(resolveLoginErrorMessage(err)).toBe(
      'Network error. Please check your connection and try again.',
    );
  });

  it('returns generic fallback when login fails with no API body', () => {
    const err = new HttpErrorResponse({
      error: null,
      status: 502,
      statusText: 'Bad Gateway',
      url: LOGIN_URL,
    });

    expect(resolveLoginErrorMessage(err)).toBe('Login failed. Please try again.');
  });

  it('extracts message from string array in API body', () => {
    const err = new HttpErrorResponse({
      error: { message: ['Account locked', 'Contact support'] },
      status: 403,
      statusText: 'Forbidden',
      url: LOGIN_URL,
    });

    expect(resolveLoginErrorMessage(err)).toBe('Account locked Contact support');
  });

  it('extracts message from error field when message is absent', () => {
    const err = new HttpErrorResponse({
      error: { error: 'Service temporarily unavailable' },
      status: 503,
      statusText: 'Service Unavailable',
      url: LOGIN_URL,
    });

    expect(resolveLoginErrorMessage(err)).toBe('Service temporarily unavailable');
  });
});
