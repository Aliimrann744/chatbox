export const ADMIN_EMAIL = 'mustafaimran816@gmail.com';

export function isAdminEmail(email?: string | null): boolean {
  if (!email) return false;
  return email.trim().toLowerCase() === ADMIN_EMAIL;
}

type AdminCandidate = {
  email?: string | null;
  isVerified?: boolean | null;
} | null | undefined;

export function isAdminUser(candidate: AdminCandidate): boolean {
  if (!candidate) return false;
  if (isAdminEmail(candidate.email)) return true;
  return false;
}
