import { InjectionToken } from '@angular/core';

/**
 * Optional override for Legacy Club mock mode (specs).
 * Defaults to `environment.useLegacyClubMocks` when not provided.
 */
export const LEGACY_CLUB_USE_MOCKS = new InjectionToken<boolean>('LEGACY_CLUB_USE_MOCKS');
