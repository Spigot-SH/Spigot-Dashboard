/**
 * An unknown or inapplicable value.
 *
 * Never `N/A`, never `null`, never an empty cell. A blank cell reads as a rendering bug, and
 * `N/A` is three characters that say less than one.
 */
export const UNKNOWN = '—';

/**
 * Truncate the middle, keeping the head and the tail.
 *
 * Transaction hashes and wallet addresses carry information at both ends: the head identifies,
 * the tail disambiguates. Cutting the tail off is what makes two different values look
 * identical, which is exactly the mistake end-truncation invites on this data.
 *
 * One ellipsis glyph, not three periods. Never use this on prose: cutting the middle out of a
 * sentence destroys its meaning.
 */
export function truncateMiddle(value: string, head = 6, tail = 6): string {
  // No point replacing characters with an ellipsis of the same length.
  if (value.length <= head + tail + 1) return value;
  return `${value.slice(0, head)}…${value.slice(-tail)}`;
}

/**
 * A credit balance, as the user reads it.
 *
 * Four decimal places, everywhere, because calls are priced below a cent and a balance
 * rounded to `$0.00` reads as empty when it is not. The number had been rendered at two,
 * four and six places in different components, and the account menu managed two of those
 * in one component: `$0.00` on the chip and `$0.000000` in the panel it opens.
 */
export const CREDIT_DP = 4;

export const formatCredit = (amount: number): string => `$${amount.toFixed(CREDIT_DP)}`;
