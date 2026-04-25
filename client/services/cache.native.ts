import { MMKV } from 'react-native-mmkv';

const mmkv = new MMKV({ id: 'whatchat-cache' });

const MAX_CACHE_AGE = 7 * 24 * 60 * 60 * 1000;

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

export const cache = {
  set<T>(key: string, data: T): void {
    try {
      const entry: CacheEntry<T> = { data, timestamp: Date.now() };
      mmkv.set(key, JSON.stringify(entry));
    } catch (error) {
      console.warn('Cache write error:', error);
    }
  },

  get<T>(key: string): T | null {
    try {
      const raw = mmkv.getString(key);
      if (!raw) return null;

      const entry: CacheEntry<T> = JSON.parse(raw);

      if (Date.now() - entry.timestamp > MAX_CACHE_AGE) {
        mmkv.delete(key);
        return null;
      }

      return entry.data;
    } catch (error) {
      console.warn('Cache read error:', error);
      return null;
    }
  },

  delete(key: string): void {
    try {
      mmkv.delete(key);
    } catch (error) {
      console.warn('Cache delete error:', error);
    }
  },

  clearAll(): void {
    try {
      mmkv.clearAll();
    } catch (error) {
      console.warn('Cache clear error:', error);
    }
  },
};

export const CacheKeys = {
  CHATS: 'cache:chats',
  CONTACTS: 'cache:contacts',
  CALLS: 'cache:calls',
  MY_STATUSES: 'cache:my-statuses',
  CONTACT_STATUSES: 'cache:contact-statuses',
  USER_PROFILE: 'cache:user-profile',
  messages: (chatId: string) => `cache:messages:${chatId}`,
  chatDetail: (chatId: string) => `cache:chat:${chatId}`,
  sharedMedia: (chatId: string) => `cache:media:${chatId}`,
};
