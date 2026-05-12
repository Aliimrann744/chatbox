/**
 * Helpers for the "verified admin" user concept.
 *
 * An account whose email matches one of the addresses in the ADMIN_EMAILS env
 * var is treated as an official admin (like the verified Meta/WhatsApp account
 * on WhatsApp). When such a user is exposed to OTHER users — in chat lists,
 * chat-detail responses, contact lists, group member lists, search results —
 * the server strips their `phone`, `countryCode`, and `email` from the
 * response and stamps an `isAdmin: true` flag so the client can render a
 * blue-tick verified badge without ever seeing real contact details.
 *
 * The admin's own session (auth/profile endpoints) is never sanitized — they
 * still see their own phone/email when editing their profile.
 */

const DEFAULT_ADMIN_EMAILS = 'zahidpfvj68@gmail.com';

let cachedEmails: Set<string> | null = null;

function loadAdminEmails(): Set<string> {
  if (cachedEmails) return cachedEmails;
  const raw = (process.env.ADMIN_EMAILS ?? DEFAULT_ADMIN_EMAILS).trim();
  cachedEmails = new Set(
    raw
      .split(',')
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean),
  );
  return cachedEmails;
}

/**
 * Test hook — clears the cached env value so a test or subsequent call sees
 * a fresh ADMIN_EMAILS. Not used in production.
 */
export function resetAdminEmailCache(): void {
  cachedEmails = null;
}

export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return loadAdminEmails().has(email.trim().toLowerCase());
}

export function isAdminUser(
  user: { email?: string | null } | null | undefined,
): boolean {
  if (!user) return false;
  return isAdminEmail(user.email ?? null);
}

interface MaybeUser {
  email?: string | null;
  phone?: string | null;
  countryCode?: string | null;
  [key: string]: any;
}

/**
 * Returns a copy of `user` safe to send to OTHER users. Admin accounts have
 * their phone/email/countryCode nulled out and gain `isAdmin: true`. Non-admin
 * users are returned with `isAdmin: false` so the client can branch on a
 * single field without doing a null check.
 *
 * Pass-through behaviour: `null` and `undefined` come back as-is so the
 * helper composes cleanly inside optional chaining (`user.contact ?? null`).
 *
 * Note on `about`: the admin's `about` line is left intact because it is a
 * deliberately user-authored greeting (e.g. "Official Whatchat support"),
 * not a piece of contact data.
 */
export function sanitizeUserForOthers<T extends MaybeUser>(
  user: T | null | undefined,
): (T & { isAdmin: boolean }) | null | undefined {
  if (user === null || user === undefined) return user as any;
  const admin = isAdminUser(user);
  if (!admin) {
    return { ...user, isAdmin: false } as any;
  }
  const sanitized: any = { ...user, isAdmin: true };
  if ('phone' in sanitized) sanitized.phone = null;
  if ('countryCode' in sanitized) sanitized.countryCode = null;
  if ('email' in sanitized) sanitized.email = null;
  return sanitized;
}
