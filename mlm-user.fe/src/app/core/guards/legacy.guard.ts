import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { map, take } from 'rxjs/operators';
import { LegacyClubService } from '../../services/legacy-club.service';
import {
  legacyHomeScreenPath,
  resolveLegacyHomeScreen,
} from '../utils/legacy-routing.util';
import { LegacyPaymentPurpose } from '../models/legacy-club.models';
import {
  canAccessLegacyMarketplace,
  canAccessLegacyVoucher,
  isLegacyMember,
} from '../models/legacy-club.models';

function redirectToHome(router: Router, path: string): boolean {
  void router.navigateByUrl(path, { replaceUrl: true });
  return false;
}

/** Ensures /legacy/me is loaded before child routes render. */
export const legacyBootstrapGuard: CanActivateFn = () => {
  const legacyClub = inject(LegacyClubService);
  const router = inject(Router);

  if (legacyClub.me()) {
    return true;
  }

  return legacyClub.loadMe().pipe(
    take(1),
    map((me) => {
      if (!me) {
        void router.navigate(['/dashboard']);
        return false;
      }
      return true;
    }),
  );
};

/** Redirect users on wrong primary screen (e.g. NONE on /legacy/home). */
export const legacyHomeGuard: CanActivateFn = () => {
  const legacyClub = inject(LegacyClubService);
  const router = inject(Router);
  const me = legacyClub.me();
  if (!me) return true;

  const screen = resolveLegacyHomeScreen(me);
  const allowed = screen === 'HOME_ACTIVE' || screen === 'HOME_GRACE' || screen === 'HOME_SUSPENDED';
  if (!allowed) {
    return redirectToHome(router, legacyHomeScreenPath(screen));
  }
  return true;
};

export const legacyJoinGuard: CanActivateFn = () => {
  const legacyClub = inject(LegacyClubService);
  const router = inject(Router);
  const me = legacyClub.me();
  if (!me) return true;

  if (me.status !== 'NONE') {
    const screen = resolveLegacyHomeScreen(me);
    if (screen !== 'JOIN_PACKAGES') {
      return redirectToHome(router, legacyHomeScreenPath(screen));
    }
  }
  return true;
};

export const legacyMemberGuard: CanActivateFn = () => {
  const legacyClub = inject(LegacyClubService);
  const router = inject(Router);
  const me = legacyClub.me();
  if (!me || !isLegacyMember(me)) {
    return redirectToHome(router, legacyClub.legacyHomePath());
  }
  return true;
};

export const legacyShopGuard: CanActivateFn = () => {
  const legacyClub = inject(LegacyClubService);
  const router = inject(Router);
  const me = legacyClub.me();

  if (!canAccessLegacyMarketplace(me)) {
    if (me?.status === 'NONE') {
      return redirectToHome(router, '/legacy/join');
    }
    return redirectToHome(router, legacyClub.legacyHomePath());
  }
  return true;
};

export const legacyVoucherGuard: CanActivateFn = () => {
  const legacyClub = inject(LegacyClubService);
  const router = inject(Router);
  const me = legacyClub.me();

  if (!canAccessLegacyVoucher(me)) {
    return redirectToHome(router, '/legacy/join');
  }
  return true;
};

export function legacyPayGuard(expected: LegacyPaymentPurpose): CanActivateFn {
  return () => {
    const legacyClub = inject(LegacyClubService);
    const router = inject(Router);
    const me = legacyClub.me();
    if (!me) return true;

    const screen = resolveLegacyHomeScreen(me);
    const payScreens = ['JOIN_PAYMENT', 'UPGRADE_PAYMENT', 'REACTIVATE_PAYMENT'] as const;
    if (!payScreens.includes(screen as (typeof payScreens)[number])) {
      return redirectToHome(router, legacyHomeScreenPath(screen));
    }

    const purposeMap: Record<(typeof payScreens)[number], LegacyPaymentPurpose> = {
      JOIN_PAYMENT: 'JOIN',
      UPGRADE_PAYMENT: 'UPGRADE',
      REACTIVATE_PAYMENT: 'REACTIVATE',
    };
    if (purposeMap[screen as (typeof payScreens)[number]] !== expected) {
      return redirectToHome(router, legacyHomeScreenPath(screen));
    }
    return true;
  };
}
