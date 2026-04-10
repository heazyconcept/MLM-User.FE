import { toWords } from 'number-to-words';

function capitalizeFirstLetter(s: string): string {
  if (!s) return '';
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * Spells out a withdrawal amount in English with naira/kobo or dollars/cents (sentence case).
 */
export function formatWithdrawalAmountInWords(
  amount: number | null | undefined,
  currency: 'NGN' | 'USD' | null
): string {
  if (currency == null) return '';
  if (amount == null || typeof amount !== 'number' || Number.isNaN(amount) || amount <= 0) {
    return '';
  }

  const totalMinor = Math.round(amount * 100);
  if (totalMinor <= 0) return '';

  const whole = Math.floor(totalMinor / 100);
  const sub = totalMinor % 100;

  const mainUnit = currency === 'NGN' ? 'naira' : 'dollars';
  const subUnit = currency === 'NGN' ? 'kobo' : 'cents';

  try {
    const wholeWords = toWords(whole);
    let out: string;
    if (sub === 0) {
      out = `${wholeWords} ${mainUnit}`;
    } else {
      const subWords = toWords(sub);
      out = `${wholeWords} ${mainUnit} and ${subWords} ${subUnit}`;
    }
    return capitalizeFirstLetter(out);
  } catch {
    return '';
  }
}
