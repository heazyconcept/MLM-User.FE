const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

export function formatCaucusNgn(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) {
    return '—';
  }
  return `₦${value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function formatLagosDate(iso: string | null | undefined, withTime = false): string {
  if (!iso) {
    return '—';
  }
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return '—';
  }
  return date.toLocaleString('en-GB', {
    timeZone: 'Africa/Lagos',
    ...(withTime
      ? { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }
      : { year: 'numeric', month: 'short', day: 'numeric' }),
  });
}

export function caucusMonthTitle(monthKey: string): string {
  const [yearStr, monthStr] = monthKey.split('-');
  const month = Number(monthStr);
  const year = Number(yearStr);
  if (!month || month < 1 || month > 12 || !year) {
    return monthKey;
  }
  return `${MONTH_NAMES[month - 1]} ${year}`;
}

export const CAUCUS_MONTH_STATUS_LABEL: Record<string, string> = {
  OPEN: 'Building',
  KEPT_ASIDE: 'Kept aside',
  PENDING_PAYOUT: 'Pending payout',
  PAID: 'Paid',
  ADDED_TO_NEXT: 'Added to the next month',
  NOT_PAYABLE: 'Not payable',
};
