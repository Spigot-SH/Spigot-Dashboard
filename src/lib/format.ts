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
