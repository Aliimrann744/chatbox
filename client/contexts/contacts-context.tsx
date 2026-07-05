import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import * as ExpoContacts from 'expo-contacts';

import { useAuth } from '@/contexts/auth-context';
import { cache, CacheKeys } from '@/services/cache';
import { Contact, contactApi } from '@/services/api';
import { ensureContactsPermission } from '@/utils/permissions';

type ContactsContextValue = {
  contacts: Contact[];
  contactsByUserId: Record<string, Contact>;
  refreshServerContacts: () => Promise<Contact[]>;
  syncDeviceContacts: (requestPermission?: boolean) => Promise<Contact[]>;
};

const ContactsContext = createContext<ContactsContextValue | undefined>(undefined);
const SILENT_SYNC_INTERVAL = 5 * 60 * 1000;

function toSyncPayload(data: ExpoContacts.Contact[]) {
  const result: { phone: string; name: string }[] = [];
  for (const contact of data) {
    const name = contact.name || '';
    for (const phone of contact.phoneNumbers || []) {
      if (!phone.number) continue;
      result.push({ phone: phone.number.replace(/[\s\-()]/g, ''), name });
    }
  }
  return result;
}

export function ContactsProvider({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, user } = useAuth();
  const [contacts, setContacts] = useState<Contact[]>(() => cache.get<Contact[]>(CacheKeys.CONTACTS) || []);
  const contactsRef = useRef(contacts);
  const lastSilentSyncRef = useRef(0);
  const syncPromiseRef = useRef<Promise<Contact[]> | null>(null);

  const storeContacts = useCallback((next: Contact[]) => {
    contactsRef.current = next;
    setContacts(next);
    cache.set(CacheKeys.CONTACTS, next);
    return next;
  }, []);

  const refreshServerContacts = useCallback(async () => {
    if (!isAuthenticated) return [];
    return storeContacts(await contactApi.getContacts());
  }, [isAuthenticated, storeContacts]);

  const syncDeviceContacts = useCallback(async (requestPermission = false) => {
    if (!isAuthenticated) return [];
    if (syncPromiseRef.current) return syncPromiseRef.current;

    const task = (async () => {
      const permission = await ExpoContacts.getPermissionsAsync();
      let granted = permission.granted;
      if (!granted && requestPermission) {
        granted = await ensureContactsPermission();
      }

      if (!granted) return refreshServerContacts();
      if (!requestPermission && Date.now() - lastSilentSyncRef.current < SILENT_SYNC_INTERVAL) {
        return contactsRef.current;
      }

      const { data } = await ExpoContacts.getContactsAsync({
        fields: [ExpoContacts.Fields.PhoneNumbers, ExpoContacts.Fields.Name],
      });
      const payload = toSyncPayload(data);
      lastSilentSyncRef.current = Date.now();
      if (payload.length === 0) return refreshServerContacts();
      return storeContacts(await contactApi.syncContacts(payload));
    })().finally(() => {
      syncPromiseRef.current = null;
    });

    syncPromiseRef.current = task;
    return task;
  }, [isAuthenticated, refreshServerContacts, storeContacts]);

  useEffect(() => {
    if (!isAuthenticated || !user?.id) {
      contactsRef.current = [];
      setContacts([]);
      return;
    }
    refreshServerContacts().catch(() => {});
  }, [isAuthenticated, user?.id, refreshServerContacts]);

  const contactsByUserId = useMemo(() => {
    const map: Record<string, Contact> = {};
    for (const contact of contacts) map[contact.contactId] = contact;
    return map;
  }, [contacts]);

  const value = useMemo(() => ({
    contacts,
    contactsByUserId,
    refreshServerContacts,
    syncDeviceContacts,
  }), [contacts, contactsByUserId, refreshServerContacts, syncDeviceContacts]);

  return <ContactsContext.Provider value={value}>{children}</ContactsContext.Provider>;
}

export function useContacts() {
  const context = useContext(ContactsContext);
  if (!context) throw new Error('useContacts must be used within ContactsProvider');
  return context;
}
