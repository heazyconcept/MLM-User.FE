import { describe, it, expect } from 'vitest';
import {
  buildMerchantLocationsPayload,
  createEmptyLocationDraft,
  draftsFromProfile,
  enforceTierOnDrafts,
  validateMerchantLocationDrafts,
} from './merchant-locations.util';

describe('merchant-locations.util', () => {
  it('creates a primary empty draft without defaulting country', () => {
    const draft = createEmptyLocationDraft(true);
    expect(draft.isPrimary).toBe(true);
    expect(draft.country).toBe('');
  });

  it('migrates legacy serviceAreas into drafts', () => {
    const drafts = draftsFromProfile({
      serviceAreas: ['Lagos', 'Abuja'],
      address: '12 Market Road',
      phoneNumber: '+2348012345678',
    });
    expect(drafts).toHaveLength(2);
    expect(drafts[0]).toMatchObject({
      country: 'Nigeria',
      state: 'Lagos',
      address: '12 Market Road',
      isPrimary: true,
    });
    expect(drafts[1]).toMatchObject({
      state: 'Abuja',
      address: '',
      isPrimary: false,
    });
  });

  it('collapses to one location for REGIONAL and keeps chosen country', () => {
    const next = enforceTierOnDrafts('REGIONAL', [
      { country: 'Ghana', state: 'Accra', address: 'A', phoneNumber: '', isPrimary: true },
      { country: 'Ghana', state: 'Kumasi', address: 'B', phoneNumber: '', isPrimary: false },
    ]);
    expect(next).toHaveLength(1);
    expect(next[0].country).toBe('Ghana');
    expect(next[0].state).toBe('Accra');
    expect(next[0].isPrimary).toBe(true);
  });

  it('validates REGIONAL requires one complete address in any country', () => {
    expect(
      validateMerchantLocationDrafts(
        'REGIONAL',
        [{ country: 'Ghana', state: 'Accra', address: '12 Road', phoneNumber: '', isPrimary: true }],
        '+233201111111',
      ),
    ).toBeNull();

    expect(
      validateMerchantLocationDrafts(
        'REGIONAL',
        [{ country: '', state: 'Lagos', address: '12 Road', phoneNumber: '', isPrimary: true }],
        '+2348011111111',
      ),
    ).toContain('country');
  });

  it('rejects duplicate NATIONAL service area states and syncs country to primary', () => {
    const synced = enforceTierOnDrafts('NATIONAL', [
      { country: 'Kenya', state: 'Nairobi', address: 'A', phoneNumber: '', isPrimary: true },
      { country: 'Ghana', state: 'Accra', address: 'B', phoneNumber: '', isPrimary: false },
    ]);
    expect(synced.every((d) => d.country === 'Kenya')).toBe(true);

    const error = validateMerchantLocationDrafts(
      'NATIONAL',
      [
        { country: 'Kenya', state: 'Nairobi', address: 'A', phoneNumber: '', isPrimary: true },
        { country: 'Kenya', state: 'Nairobi', address: 'B', phoneNumber: '', isPrimary: false },
      ],
      '+254701111111',
    );
    expect(error).toContain('distinct state');
  });

  it('requires phone for GLOBAL service areas', () => {
    const error = validateMerchantLocationDrafts(
      'GLOBAL',
      [
        {
          country: 'Nigeria',
          state: 'Lagos',
          address: 'HQ',
          phoneNumber: '',
          isPrimary: true,
        },
        {
          country: 'Ghana',
          state: 'Accra',
          address: 'Branch',
          phoneNumber: '',
          isPrimary: false,
        },
      ],
      '+2348010000000',
    );
    expect(error).toContain('phone');
  });

  it('builds payload using contact phone for primary when row phone omitted', () => {
    const payload = buildMerchantLocationsPayload(
      'NATIONAL',
      [
        { country: 'Ghana', state: 'Accra', address: 'HQ', phoneNumber: '', isPrimary: true },
        { country: 'Ghana', state: 'Kumasi', address: 'Branch', phoneNumber: '', isPrimary: false },
      ],
      '+233201234567',
    );
    expect(payload[0].country).toBe('Ghana');
    expect(payload[0].phoneNumber).toBe('+233201234567');
    expect(payload[0].isPrimary).toBe(true);
    expect(payload[1].state).toBe('Kumasi');
  });

  it('rejects wildcard state', () => {
    const error = validateMerchantLocationDrafts(
      'REGIONAL',
      [{ country: 'Nigeria', state: '*', address: 'Anywhere', phoneNumber: '', isPrimary: true }],
      '+2348011111111',
    );
    expect(error).toContain('Wildcard');
  });
});
