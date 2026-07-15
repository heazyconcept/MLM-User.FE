import type { MerchantLocation, MerchantType } from '../../services/merchant.service';

export const NIGERIA_COUNTRY = 'Nigeria';
export const NIGERIA_COUNTRY_CODE = 'NG';

export interface MerchantLocationDraft {
  countryCode: string;
  subdivisionCode: string;
  country: string;
  state: string;
  address: string;
  phoneNumber: string;
  isPrimary: boolean;
}

export function createEmptyLocationDraft(
  isPrimary = false,
  countryCode = '',
  country = '',
): MerchantLocationDraft {
  return {
    countryCode,
    subdivisionCode: '',
    country,
    state: '',
    address: '',
    phoneNumber: '',
    isPrimary,
  };
}

/** Build location drafts from profile locations, or migrate legacy serviceAreas + address. */
export function draftsFromProfile(input: {
  type?: MerchantType;
  homeCountryCode?: string | null;
  locations?: MerchantLocation[] | null;
  serviceAreas?: string[] | null;
  address?: string | null;
  phoneNumber?: string | null;
}): MerchantLocationDraft[] {
  const locations = input.locations ?? [];
  if (locations.length > 0) {
    return locations.map((loc, index) => ({
      countryCode: loc.countryCode?.trim().toUpperCase() ?? '',
      subdivisionCode: loc.subdivisionCode?.trim() ?? '',
      country: loc.country?.trim() ?? '',
      state: loc.state?.trim() ?? '',
      address: loc.address?.trim() ?? '',
      phoneNumber: loc.phoneNumber?.trim() ?? '',
      isPrimary: loc.isPrimary || (index === 0 && !locations.some((l) => l.isPrimary)),
    }));
  }

  const areas = (input.serviceAreas ?? []).filter((area) => area.trim() && area.trim() !== '*');
  if (areas.length === 0) {
    return [createEmptyLocationDraft(true)];
  }

  const contactPhone = input.phoneNumber?.trim() ?? '';
  const primaryAddress = input.address?.trim() ?? '';

  // Legacy serviceAreas were Nigeria state names without country.
  return areas.map((state, index) => ({
    countryCode: input.homeCountryCode?.trim().toUpperCase() || NIGERIA_COUNTRY_CODE,
    subdivisionCode: '',
    country: NIGERIA_COUNTRY,
    state,
    address: index === 0 ? primaryAddress : '',
    phoneNumber: index === 0 ? contactPhone : '',
    isPrimary: index === 0,
  }));
}

export function enforceTierOnDrafts(
  type: MerchantType,
  drafts: MerchantLocationDraft[],
  homeCountryCode: string,
  homeCountryName = '',
): MerchantLocationDraft[] {
  let next = drafts.length > 0 ? drafts.map((d) => ({ ...d })) : [createEmptyLocationDraft(true)];
  const homeCode = homeCountryCode.trim().toUpperCase();

  const enforceHomeCountry = (draft: MerchantLocationDraft): MerchantLocationDraft => {
    const countryChanged = Boolean(homeCode && draft.countryCode !== homeCode);
    return {
      ...draft,
      countryCode: homeCode,
      country: homeCountryName || (countryChanged ? '' : draft.country),
      subdivisionCode: countryChanged ? '' : draft.subdivisionCode,
      state: countryChanged ? '' : draft.state,
    };
  };

  if (type === 'REGIONAL') {
    const primary = next.find((d) => d.isPrimary) ?? next[0];
    next = [{ ...enforceHomeCountry(primary), isPrimary: true }];
  }

  if (type === 'NATIONAL') {
    next = next.map(enforceHomeCountry);
  }

  if (type === 'GLOBAL') {
    next = next.map((draft) => (draft.isPrimary ? enforceHomeCountry(draft) : draft));
  }

  if (!next.some((d) => d.isPrimary)) {
    next[0] = { ...next[0], isPrimary: true };
  } else {
    let seenPrimary = false;
    next = next.map((d) => {
      if (!d.isPrimary) return d;
      if (seenPrimary) return { ...d, isPrimary: false };
      seenPrimary = true;
      return d;
    });
  }

  return next;
}

export function validateMerchantLocationDrafts(
  type: MerchantType,
  drafts: MerchantLocationDraft[],
  homeCountryCode: string,
  contactPhone: string,
): string | null {
  const homeCode = homeCountryCode.trim().toUpperCase();
  if (!homeCode) {
    return 'Select your home country.';
  }

  const submittedPrimary = drafts.find((draft) => draft.isPrimary) ?? drafts[0];
  if (
    submittedPrimary?.countryCode &&
    submittedPrimary.countryCode.trim().toUpperCase() !== homeCode
  ) {
    return 'Primary address must be in your home country.';
  }

  const normalized = enforceTierOnDrafts(type, drafts, homeCode);
  const contact = contactPhone.trim();

  if (!contact) {
    return 'Enter a contact phone number.';
  }

  if (normalized.length === 0) {
    return type === 'REGIONAL' ? 'Enter your specific pickup address.' : 'Add a primary address.';
  }

  if (type === 'REGIONAL' && normalized.length !== 1) {
    return 'Regional merchants cannot have service areas. Enter one specific address only.';
  }

  if (type === 'NATIONAL' && normalized.length < 1) {
    return 'Add a primary address.';
  }

  const keys = new Set<string>();
  const primary = normalized.find((draft) => draft.isPrimary) ?? normalized[0];
  if (primary.countryCode !== homeCode) {
    return 'Primary address must be in your home country.';
  }

  for (const [index, draft] of normalized.entries()) {
    const countryCode = draft.countryCode.trim().toUpperCase();
    const subdivisionCode = draft.subdivisionCode.trim();
    const country = draft.country.trim();
    const state = draft.state.trim();
    const address = draft.address.trim();
    const phone = (draft.phoneNumber.trim() || (draft.isPrimary ? contact : '')).trim();
    const label =
      type === 'REGIONAL'
        ? 'Your address'
        : draft.isPrimary
          ? 'Primary address'
          : `Service area ${index}`;

    if (!countryCode || !country) {
      return `${label}: select a country.`;
    }
    if (!subdivisionCode || !state) {
      return `${label}: select a state or region.`;
    }
    if (subdivisionCode === '*' || state === '*') {
      return 'Wildcard (*) service areas are not allowed. Pick a specific state or region.';
    }
    if (!address) {
      return draft.isPrimary || type === 'REGIONAL'
        ? `${label}: a specific street address is required.`
        : `${label}: address is required so distributors can locate this pickup point.`;
    }
    if (type === 'GLOBAL' && !phone) {
      return `${label}: phone number is required for Global service areas.`;
    }
    if (type === 'NATIONAL' && countryCode !== homeCode) {
      return 'National service areas must be in your home country.';
    }

    const key =
      type === 'GLOBAL'
        ? `${countryCode}::${subdivisionCode.toLowerCase()}`
        : subdivisionCode.toLowerCase();
    if (keys.has(key)) {
      return type === 'GLOBAL'
        ? 'Each Global service area must use a distinct country and state or region.'
        : 'Each National service area must use a distinct state or region.';
    }
    keys.add(key);
  }

  if (!normalized.some((d) => d.isPrimary)) {
    return 'Mark one address as primary.';
  }

  return null;
}

/** Build API payload locations from drafts. */
export function buildMerchantLocationsPayload(
  type: MerchantType,
  drafts: MerchantLocationDraft[],
  homeCountryCode: string,
  contactPhone: string,
): MerchantLocation[] {
  const contact = contactPhone.trim();
  return enforceTierOnDrafts(type, drafts, homeCountryCode).map((draft) => {
    const phone = draft.phoneNumber.trim() || (type === 'GLOBAL' || draft.isPrimary ? contact : '');
    return {
      countryCode: draft.countryCode.trim().toUpperCase(),
      subdivisionCode: draft.subdivisionCode.trim(),
      country: draft.country.trim(),
      state: draft.state.trim(),
      address: draft.address.trim(),
      phoneNumber: phone,
      isPrimary: draft.isPrimary,
    };
  });
}

/** @deprecated Use NIGERIA_COUNTRY — kept for any older imports. */
export const DEFAULT_MERCHANT_COUNTRY = NIGERIA_COUNTRY;
