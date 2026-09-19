/**
 * FNV-1a, 32-bit.
 *
 * Used wherever a name has to pick something stable: an avatar pattern, a skill's hue. It must
 * be a hash and not `Math.random()` or an array index, for two reasons.
 *
 * `Math.random()` differs between the server pass and the client pass, so React reports a
 * hydration mismatch and the value flickers on load. An array index is stable only until
 * somebody reorders the array, at which point every avatar and every tag silently changes.
 */
export function hashString(value: string): number {
  let h = 2166136261;
  for (let i = 0; i < value.length; i++) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h;
}
