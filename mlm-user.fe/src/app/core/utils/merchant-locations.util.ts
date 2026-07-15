import { NIGERIAN_STATES } from '../constants/states.constants';
import type { MerchantLocation, MerchantType } from '../../services/merchant.service';

/** Used only for Nigerian state-picker detection — not as a form default. */
export const NIGERIA_COUNTRY = 'Nigeria';

export interface MerchantLocationDraft {
  country: string;
  state: string;
  address: string;
  phoneNumber: string;
  isPrimary: boolean;
}

export function createEmptyLocationDraft(
  isPrimary = false,
  country = '',
): MerchantLocationDraft {
  return {
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
  locations?: MerchantLocation[] | null;
  serviceAreas?: string[] | null;
  address?: string | null;
  phoneNumber?: string | null;
}): MerchantLocationDraft[] {
  const locations = input.locations ?? [];
  if (locations.length > 0) {
    return locations.map((loc, index) => ({
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
): MerchantLocationDraft[] {
  let next = drafts.length > 0 ? drafts.map((d) => ({ ...d })) : [createEmptyLocationDraft(true)];

  if (type === 'REGIONAL') {
    const primary = next.find((d) => d.isPrimary) ?? next[0];
    next = [{ ...primary, isPrimary: true }];
  }

  // National service areas stay in the same country as the primary address.
  if (type === 'NATIONAL') {
    const primary = next.find((d) => d.isPrimary) ?? next[0];
    const country = primary.country.trim();
    if (country) {
      next = next.map((d) => ({ ...d, country }));
    }
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
  contactPhone: string,
): string | null {
  const normalized = enforceTierOnDrafts(type, drafts);
  const contact = contactPhone.trim();

  if (!contact) {
    return 'Enter a contact phone number.';
  }

  if (normalized.length === 0) {
    return type === 'REGIONAL'
      ? 'Enter your specific pickup address.'
      : 'Add a primary address.';
  }

  if (type === 'REGIONAL' && normalized.length !== 1) {
    return 'Regional merchants cannot have service areas. Enter one specific address only.';
  }

  if (type === 'NATIONAL' && normalized.length < 1) {
    return 'Add a primary address.';
  }

  const keys = new Set<string>();
  const primaryCountry = (normalized.find((d) => d.isPrimary) ?? normalized[0]).country.trim();

  for (const [index, draft] of normalized.entries()) {
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

    if (!country) {
      return `${label}: select a country.`;
    }
    if (!state) {
      return `${label}: state / region is required.`;
    }
    if (state === '*') {
      return 'Wildcard (*) service areas are not allowed. Pick a specific state.';
    }
    if (!address) {
      return draft.isPrimary || type === 'REGIONAL'
        ? `${label}: a specific street address is required.`
        : `${label}: address is required so distributors can locate this pickup point.`;
    }
    if (type === 'GLOBAL' && !phone) {
      return `${label}: phone number is required for Global service areas.`;
    }
    if (type === 'NATIONAL' && primaryCountry && country.toLowerCase() !== primaryCountry.toLowerCase()) {
      return 'National service areas must be in the same country as your primary address.';
    }

    const key =
      type === 'GLOBAL'
        ? `${country.toLowerCase()}::${state.toLowerCase()}`
        : state.toLowerCase();
    if (keys.has(key)) {
      return type === 'GLOBAL'
        ? 'Each Global service area must use a distinct country and state.'
        : 'Each National service area must use a distinct state / region.';
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
  contactPhone: string,
): MerchantLocation[] {
  const contact = contactPhone.trim();
  return enforceTierOnDrafts(type, drafts).map((draft) => {
    const phone =
      draft.phoneNumber.trim() ||
      (type === 'GLOBAL' || draft.isPrimary ? contact : '');
    return {
      country: draft.country.trim(),
      state: draft.state.trim(),
      address: draft.address.trim(),
      phoneNumber: phone,
      isPrimary: draft.isPrimary,
    };
  });
}

export function isNigeriaCountry(country: string): boolean {
  return country.trim().toLowerCase() === NIGERIA_COUNTRY.toLowerCase();
}

export function nigerianStateOptions(): string[] {
  return NIGERIAN_STATES;
}

/** @deprecated Use NIGERIA_COUNTRY — kept for any older imports. */
export const DEFAULT_MERCHANT_COUNTRY = NIGERIA_COUNTRY;
