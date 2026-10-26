/** Display label for a downline / referral phone on network screens. */
export function formatMemberPhone(phone: string | null | undefined): string {
  const trimmed = phone?.trim();
  return trimmed ? trimmed : '—';
}

/** `tel:` href when the value is non-empty; otherwise null (no link). */
export function memberPhoneTelHref(phone: string | null | undefined): string | null {
  const trimmed = phone?.trim();
  if (!trimmed) return null;
  return `tel:${trimmed.replace(/\s+/g, '')}`;
}
