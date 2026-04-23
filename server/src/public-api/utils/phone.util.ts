/**
 * Normalize a phone number into the canonical form stored in User.phone.
 *
 * The app stores phones as a bare national-subscriber string without the
 * leading zero (e.g. "3001234567") and the country code separately
 * ("+92"). The normalizer accepts every shape a sender might pass:
 *
 *   +923001234567   →  3001234567
 *   923001234567    →  3001234567
 *   03001234567     →  3001234567
 *   3001234567      →  3001234567
 *   +92 300 123 4567 → 3001234567
 *   +1 5551234567   →  15551234567   (fallback: keep as-is after stripping +/zeros)
 *
 * Returns null when the input can't be coerced into digits of sensible length.
 */
export function normalizePhone(raw: string | undefined | null): string | null {
  if (!raw) return null;

  // Keep digits and a possible leading '+'
  let cleaned = String(raw).trim().replace(/[\s\-()]/g, '');
  cleaned = cleaned.replace(/[^\d+]/g, '');
  if (cleaned.startsWith('+')) cleaned = cleaned.slice(1);
  if (!cleaned) return null;

  // Pakistan — the primary format this API supports
  // 12 digits starting with 92  →  strip CC
  if (cleaned.length === 12 && cleaned.startsWith('92')) {
    return cleaned.slice(2);
  }
  // 11 digits starting with 0   →  strip leading zero
  if (cleaned.length === 11 && cleaned.startsWith('0')) {
    return cleaned.slice(1);
  }
  // 10 digits starting with 3   →  already canonical Pakistani mobile
  if (cleaned.length === 10 && cleaned.startsWith('3')) {
    return cleaned;
  }

  // Fallback for other countries — strip a leading zero if present so
  // we don't mis-match the stored column. The full lookup will still
  // attempt both with and without leading zero below.
  if (cleaned.startsWith('0')) cleaned = cleaned.replace(/^0+/, '');
  return cleaned.length >= 6 ? cleaned : null;
}

/**
 * Build all candidate values that may have been stored as User.phone for the
 * given input. The DB column is unique, so we try each until one matches.
 */
export function phoneLookupCandidates(raw: string): string[] {
  const primary = normalizePhone(raw);
  const candidates = new Set<string>();
  if (primary) candidates.add(primary);

  // Also try the exact digits the caller sent, with and without the leading
  // country code — covers cases where a user was registered with a non-default
  // shape.
  const digits = String(raw).replace(/\D/g, '');
  if (digits) {
    candidates.add(digits);
    if (digits.startsWith('0')) candidates.add(digits.replace(/^0+/, ''));
    if (digits.startsWith('92') && digits.length >= 12) {
      candidates.add(digits.slice(2));
    }
  }
  return Array.from(candidates).filter(Boolean);
}
