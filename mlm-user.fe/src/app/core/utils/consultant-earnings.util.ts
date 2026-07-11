export type ConsultantEarningsKind = 'registration' | 'product';

export interface ConsultantEarningsEntry {
  earningType?: string;
  type?: string;
  source?: string;
  id?: string;
}

const REGISTRATION_TYPES = new Set([
  'BUSINESS_CONSULTANT_REGISTRATION',
  'BCR',
]);

const PRODUCT_TYPES = new Set([
  'BUSINESS_CONSULTANT_PRODUCT',
  'BCP',
]);

export function matchesConsultantEarningsKind(
  entry: ConsultantEarningsEntry,
  kind: ConsultantEarningsKind,
): boolean {
  const earningType = `${entry.earningType ?? entry.type ?? ''}`.toUpperCase().trim();
  if (!earningType) return false;

  if (kind === 'registration') {
    return (
      REGISTRATION_TYPES.has(earningType) ||
      earningType.includes('BUSINESS_CONSULTANT_REGISTRATION') ||
      earningType.includes('BCR')
    );
  }

  return (
    PRODUCT_TYPES.has(earningType) ||
    earningType.includes('BUSINESS_CONSULTANT_PRODUCT') ||
    earningType.includes('BCP')
  );
}

export function filterConsultantEarnings<T extends ConsultantEarningsEntry>(
  entries: T[],
  kind: ConsultantEarningsKind,
): T[] {
  return entries.filter((entry) => matchesConsultantEarningsKind(entry, kind));
}

export function formatConsultantEarningType(type: string | undefined): string {
  if (!type) return '—';
  const normalized = type.toUpperCase().trim();
  const labels: Record<string, string> = {
    BUSINESS_CONSULTANT_REGISTRATION: 'Business consultant registration/upgrade bonus',
    BUSINESS_CONSULTANT_PRODUCT: 'Business consultant product bonus',
    BCR: 'Business consultant registration/upgrade bonus',
    BCP: 'Business consultant product bonus',
  };
  if (labels[normalized]) {
    return labels[normalized];
  }
  return type
    .toLowerCase()
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}
