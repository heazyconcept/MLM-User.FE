import { HttpErrorResponse } from '@angular/common/http';
import { describe, expect, it } from 'vitest';
import {
  PROFILE_INCOMPLETE_CODE,
  PROFILE_SETUP_PATH,
  checkoutProfileMessage,
  formatProfileMissingFields,
  isProfileIncompleteError,
  parseProfileMissingFields,
  profileIncompleteMissingFields,
  resolvePostLoginRedirect,
} from './profile-complete.util';

describe('profile-complete.util', () => {
  describe('parseProfileMissingFields', () => {
    it('keeps only known profile fields', () => {
      expect(parseProfileMissingFields(['phone', 'address', 'unknown', 12])).toEqual([
        'phone',
        'address',
      ]);
    });

    it('returns an empty list for non-arrays', () => {
      expect(parseProfileMissingFields(undefined)).toEqual([]);
      expect(parseProfileMissingFields('phone')).toEqual([]);
    });
  });

  describe('formatProfileMissingFields', () => {
    it('joins human labels', () => {
      expect(formatProfileMissingFields(['phone', 'address', 'bankName'])).toBe(
        'phone number, address, and bank name',
      );
    });

    it('returns empty string when nothing is missing', () => {
      expect(formatProfileMissingFields([])).toBe('');
    });
  });

  describe('isProfileIncompleteError', () => {
    it('detects the backend checkout contract', () => {
      const err = new HttpErrorResponse({
        status: 400,
        statusText: 'Bad Request',
        error: {
          code: PROFILE_INCOMPLETE_CODE,
          message: 'Complete your profile before placing an order.',
          missingFields: ['phone', 'address'],
        },
      });

      expect(isProfileIncompleteError(err)).toBe(true);
      expect(profileIncompleteMissingFields(err)).toEqual(['phone', 'address']);
    });

    it('detects a local gate error', () => {
      expect(isProfileIncompleteError({ code: PROFILE_INCOMPLETE_CODE })).toBe(true);
    });

    it('ignores other errors', () => {
      expect(
        isProfileIncompleteError(
          new HttpErrorResponse({
            status: 400,
            error: { code: 'NO_ACTIVE_PRICE', message: 'No active price' },
          }),
        ),
      ).toBe(false);
    });
  });

  describe('resolvePostLoginRedirect', () => {
    it('sends unpaid users to activation even if profile is incomplete', () => {
      expect(resolvePostLoginRedirect('UNPAID', false)).toEqual({
        path: '/auth/activation',
        promptProfile: false,
      });
    });

    it('prompts paid users with an incomplete profile', () => {
      expect(resolvePostLoginRedirect('PAID', false)).toEqual({
        path: PROFILE_SETUP_PATH,
        queryParams: { setup: 'complete' },
        promptProfile: true,
      });
    });

    it('sends paid complete users to the dashboard', () => {
      expect(resolvePostLoginRedirect('PAID', true)).toEqual({
        path: '/dashboard',
        promptProfile: false,
      });
    });

    it('does not prompt when completeness is unknown', () => {
      expect(resolvePostLoginRedirect('PAID', undefined)).toEqual({
        path: '/dashboard',
        promptProfile: false,
      });
    });
  });

  describe('checkoutProfileMessage', () => {
    it('lists remaining fields when the API provides them', () => {
      expect(checkoutProfileMessage(['phone', 'address'])).toContain('phone number');
      expect(checkoutProfileMessage(['phone', 'address'])).toContain('address');
    });

    it('falls back when no fields are provided', () => {
      expect(checkoutProfileMessage()).toContain('phone number');
    });
  });
});
