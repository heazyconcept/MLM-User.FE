import { describe, it, expect } from 'vitest';
import {
  buildMerchantLocationsPayload,
  createEmptyLocationDraft,
  draftsFromProfile,
  enforceTierOnDrafts,
  validateMerchantLocationDrafts,
} from './merchant-locations.util';

describe('merchant-locations.util', () => {
  const ngLagos = {
    countryCode: 'NG',
    subdivisionCode: 'LA',
    country: 'Nigeria',
    state: 'Lagos',
    address: '12 Market Road',
    phoneNumber: '',
    isPrimary: true,
  };

  it('creates a primary empty draft without defaulting geography', () => {
    const draft = createEmptyLocationDraft(true);
    expect(draft.isPrimary).toBe(true);
    expect(draft.countryCode).toBe('');
    expect(draft.subdivisionCode).toBe('');
    expect(draft.country).toBe('');
  });

  it('preserves location codes and leaves legacy subdivision codes unresolved', () => {
    const drafts = draftsFromProfile({
      homeCountryCode: 'NG',
      locations: [{ ...ngLagos, detailsComplete: true }],
    });
    expect(drafts[0]).toMatchObject({
      countryCode: 'NG',
      subdivisionCode: 'LA',
      country: 'Nigeria',
      state: 'Lagos',
    });

    const legacy = draftsFromProfile({
      homeCountryCode: 'NG',
      serviceAreas: ['Lagos', 'Abuja'],
      address: '12 Market Road',
      phoneNumber: '+2348012345678',
    });
    expect(legacy).toHaveLength(2);
    expect(legacy[0]).toMatchObject({
      countryCode: 'NG',
      subdivisionCode: '',
      country: 'Nigeria',
      state: 'Lagos',
      address: '12 Market Road',
      isPrimary: true,
    });
    expect(legacy[1]).toMatchObject({
      state: 'Abuja',
      address: '',
      isPrimary: false,
    });
  });

  it('forces REGIONAL and NATIONAL locations into the home country', () => {
    const ghAccra = {
      countryCode: 'GH',
      subdivisionCode: 'AA',
      country: 'Ghana',
      state: 'Accra',
      address: 'A',
      phoneNumber: '',
      isPrimary: true,
    };
    const next = enforceTierOnDrafts(
      'REGIONAL',
      [ghAccra, { ...ghAccra, isPrimary: false }],
      'NG',
      'Nigeria',
    );
    expect(next).toHaveLength(1);
    expect(next[0].countryCode).toBe('NG');
    expect(next[0].country).toBe('Nigeria');
    expect(next[0].subdivisionCode).toBe('');
    expect(next[0].isPrimary).toBe(true);

    const national = enforceTierOnDrafts('NATIONAL', [ngLagos, ghAccra], 'NG', 'Nigeria');
    expect(national.every((draft) => draft.countryCode === 'NG')).toBe(true);
    expect(national[1].subdivisionCode).toBe('');
  });

  it('requires a home country and canonical subdivision code', () => {
    expect(
      validateMerchantLocationDrafts('REGIONAL', [ngLagos], 'NG', '+2348011111111'),
    ).toBeNull();

    expect(validateMerchantLocationDrafts('REGIONAL', [ngLagos], '', '+2348011111111')).toContain(
      'home country',
    );
    expect(
      validateMerchantLocationDrafts(
        'REGIONAL',
        [{ ...ngLagos, subdivisionCode: '' }],
        'NG',
        '+2348011111111',
      ),
    ).toContain('state or region');
  });

  it('rejects duplicate NATIONAL subdivision codes', () => {
    const error = validateMerchantLocationDrafts(
      'NATIONAL',
      [ngLagos, { ...ngLagos, address: 'Another address', isPrimary: false }],
      'NG',
      '+2348011111111',
    );
    expect(error).toContain('distinct state or region');
  });

  it('requires GLOBAL primary in the home country and a phone for each coverage site', () => {
    const error = validateMerchantLocationDrafts(
      'GLOBAL',
      [
        ngLagos,
        {
          countryCode: 'GH',
          subdivisionCode: 'AA',
          country: 'Ghana',
          state: 'Accra',
          address: 'Branch',
          phoneNumber: '',
          isPrimary: false,
        },
      ],
      'NG',
      '+2348010000000',
    );
    expect(error).toContain('phone');

    const wrongPrimary = validateMerchantLocationDrafts(
      'GLOBAL',
      [{ ...ngLagos, countryCode: 'GH', country: 'Ghana' }],
      'NG',
      '+2348010000000',
    );
    expect(wrongPrimary).toContain('home country');
  });

  it('builds canonical payload using contact phone for the primary location', () => {
    const payload = buildMerchantLocationsPayload(
      'NATIONAL',
      [
        ngLagos,
        {
          ...ngLagos,
          subdivisionCode: 'FC',
          state: 'Federal Capital Territory',
          address: 'Abuja branch',
          isPrimary: false,
        },
      ],
      'NG',
      '+2348012345678',
    );
    expect(payload[0]).toMatchObject({
      countryCode: 'NG',
      subdivisionCode: 'LA',
      country: 'Nigeria',
      state: 'Lagos',
      phoneNumber: '+2348012345678',
      isPrimary: true,
    });
    expect(payload[1].subdivisionCode).toBe('FC');
  });

  it('rejects wildcard subdivision codes', () => {
    const error = validateMerchantLocationDrafts(
      'REGIONAL',
      [{ ...ngLagos, subdivisionCode: '*', state: '*' }],
      'NG',
      '+2348011111111',
    );
    expect(error).toContain('Wildcard');
  });
});
