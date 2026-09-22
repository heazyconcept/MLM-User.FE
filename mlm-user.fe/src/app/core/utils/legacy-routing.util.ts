import {
  LegacyMe,
  LegacyPaymentPurpose,
  isLegacyMember,
} from '../models/legacy-club.models';

export type LegacyHomeScreen =
  | 'JOIN_PACKAGES'
  | 'JOIN_PAYMENT'
  | 'UPGRADE_PAYMENT'
  | 'REACTIVATE_PAYMENT'
  | 'HOME_GRACE'
  | 'HOME_SUSPENDED'
  | 'HOME_ACTIVE';

export function resolveLegacyHomeScreen(me: LegacyMe): LegacyHomeScreen {
  if (me.status === 'NONE') return 'JOIN_PACKAGES';
  if (me.status === 'PENDING_JOIN' || me.pendingJoin) return 'JOIN_PAYMENT';
  if (me.pendingPayment?.purpose === 'UPGRADE' || me.pendingUpgrade) return 'UPGRADE_PAYMENT';
  if (
    me.pendingPayment?.purpose === 'REACTIVATE' ||
    me.status === 'REACTIVATION_DUE'
  ) {
    if (me.lifecycle?.canReactivate ?? me.canReactivate) return 'REACTIVATE_PAYMENT';
    return 'HOME_GRACE';
  }
  if (me.status === 'SUSPENDED') return 'HOME_SUSPENDED';
  return 'HOME_ACTIVE';
}

export function legacyHomeScreenPath(screen: LegacyHomeScreen): string {
  switch (screen) {
    case 'JOIN_PACKAGES':
      return '/legacy/join';
    case 'JOIN_PAYMENT':
      return '/legacy/pay/JOIN';
    case 'UPGRADE_PAYMENT':
      return '/legacy/pay/UPGRADE';
    case 'REACTIVATE_PAYMENT':
      return '/legacy/pay/REACTIVATE';
    case 'HOME_GRACE':
    case 'HOME_SUSPENDED':
    case 'HOME_ACTIVE':
      return '/legacy/home';
    default: {
      const _exhaustive: never = screen;
      return _exhaustive;
    }
  }
}

export function paymentPurposeFromMe(me: LegacyMe): LegacyPaymentPurpose {
  if (me.pendingPayment?.purpose) return me.pendingPayment.purpose;
  if (me.pendingUpgrade) return 'UPGRADE';
  if (me.status === 'REACTIVATION_DUE' || me.status === 'SUSPENDED') return 'REACTIVATE';
  return 'JOIN';
}

export function legacyPaymentPurposeLabel(purpose: LegacyPaymentPurpose): string {
  switch (purpose) {
    case 'JOIN':
      return 'Join Legacy Club';
    case 'UPGRADE':
      return 'Upgrade package';
    case 'REACTIVATE':
      return 'Reactivate membership';
    default: {
      const _exhaustive: never = purpose;
      return _exhaustive;
    }
  }
}

/** Routes that require an established membership (not NONE / PENDING_JOIN). */
export function legacyMemberRouteAllowed(me: LegacyMe | null | undefined): boolean {
  return isLegacyMember(me);
}
