import { describe, expect, it } from 'vitest';
import {
  interpretLegacyMemberLookup,
  legacyMemberLookupBlockMessage,
  normalizeLegacyMemberLookup,
} from './legacy-member-lookup.util';

describe('normalizeLegacyMemberLookup', () => {
  it('unwraps data and maps snake_case fields', () => {
    const result = normalizeLegacyMemberLookup({
      data: {
        username: 'Kosi10',
        exists: true,
        is_registration_paid: true,
        legacy_status: 'NONE',
        can_register_under_me: false,
        block_code: 'NOT_IN_DOWNLINE',
      },
    });
    expect(result).toMatchObject({
      username: 'Kosi10',
      exists: true,
      isRegistrationPaid: true,
      legacyStatus: 'NONE',
      canRegisterUnderMe: false,
      blockCode: 'NOT_IN_DOWNLINE',
    });
  });
});

describe('interpretLegacyMemberLookup', () => {
  it('returns blocked message for NOT_IN_DOWNLINE', () => {
    const result = interpretLegacyMemberLookup({
      username: 'Kosi10',
      exists: true,
      isRegistrationPaid: true,
      legacyStatus: 'NONE',
      canRegisterUnderMe: false,
      blockCode: 'NOT_IN_DOWNLINE',
    });
    expect(result.kind).toBe('blocked');
    expect(result.message).toContain('not in your downline');
  });

  it('returns ready when canRegisterUnderMe is true', () => {
    const result = interpretLegacyMemberLookup({
      username: 'Kosi11',
      exists: true,
      isRegistrationPaid: true,
      legacyStatus: 'NONE',
      canRegisterUnderMe: true,
      sponsorSourceIfRegistered: 'CHOSEN',
    });
    expect(result.kind).toBe('ready');
    expect(result.message).toContain('Kosi11');
  });

  it('returns not-member when user does not exist', () => {
    const result = interpretLegacyMemberLookup({
      username: 'missing',
      exists: false,
      isRegistrationPaid: false,
      legacyStatus: 'NONE',
    });
    expect(result.kind).toBe('not-member');
    expect(result.message).toBe(
      'This is not a registered member in Segulah Global Network.',
    );
  });
});

describe('legacyMemberLookupBlockMessage', () => {
  it('never returns an empty string', () => {
    expect(legacyMemberLookupBlockMessage('NOT_IN_DOWNLINE').length).toBeGreaterThan(0);
    expect(legacyMemberLookupBlockMessage(undefined).length).toBeGreaterThan(0);
    expect(legacyMemberLookupBlockMessage('UNKNOWN_CODE').length).toBeGreaterThan(0);
  });
});
