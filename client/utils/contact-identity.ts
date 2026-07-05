import { Contact } from '@/services/api';

export type IdentityUser = {
  id: string;
  name?: string | null;
  phone?: string | null;
  countryCode?: string | null;
  isAdmin?: boolean;
};

export function formatPhone(user?: Pick<IdentityUser, 'phone' | 'countryCode'> | null): string {
  if (!user?.phone) return '';
  const phone = user.phone.trim();
  const countryCode = user.countryCode?.trim() || '';
  if (!countryCode || phone.startsWith('+') || phone.startsWith(countryCode)) return phone;
  return `${countryCode}${phone}`;
}

export function resolvePrivateDisplayName(
  peer: IdentityUser | null | undefined,
  contact?: Contact | null,
): string {
  if (!peer) return 'Deleted Account';
  if (peer.isAdmin && peer.name?.trim()) return peer.name.trim();
  const nickname = contact?.nickname?.trim();
  if (nickname) return nickname;
  return formatPhone(peer) || 'Unknown user';
}

export function resolveGroupDisplayName(
  member: IdentityUser | null | undefined,
  contact?: Contact | null,
): string {
  if (!member) return 'Unknown user';
  const nickname = contact?.nickname?.trim();
  if (nickname) return nickname;
  if (member.name?.trim()) return member.name.trim();
  return formatPhone(member) || 'Unknown user';
}

export function resolvePrivateContactName(contact: Contact): string {
  return resolvePrivateDisplayName({
    id: contact.contactId,
    name: contact.name,
    phone: contact.phone,
    countryCode: contact.countryCode,
    isAdmin: contact.isAdmin,
  }, contact);
}

export function resolveGroupContactName(contact: Contact): string {
  return resolveGroupDisplayName({
    id: contact.contactId,
    name: contact.name,
    phone: contact.phone,
    countryCode: contact.countryCode,
    isAdmin: contact.isAdmin,
  }, contact);
}
