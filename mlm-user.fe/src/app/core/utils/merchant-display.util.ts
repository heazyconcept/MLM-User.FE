/**
 * Formats a merchant identity for display as `username(businessName)`.
 *
 * Rules:
 * - Both present and different → `username(businessName)`
 * - Username only → `username`
 * - Business name only → `businessName`
 * - Neither → empty string (callers apply their own fallback)
 */
export function formatMerchantUsernameLabel(
  username?: string | null,
  businessName?: string | null,
): string {
  const user = (username ?? '').trim();
  const business = (businessName ?? '').trim();

  if (user && business) {
    if (user.toLowerCase() === business.toLowerCase()) {
      return user;
    }
    return `${user}(${business})`;
  }

  return user || business;
}
