import type { OrderCandidate } from '../shared/index.js';
import type { Settings } from './messages';

export const STORAGE_KEYS = {
  queue: 'era:queue',
  seen: 'era:seen',
  settings: 'era:settings',
  session: 'era:supabase-session',
} as const;

/** Map of dedupe key -> expiry timestamp (ms since epoch). */
export type SeenMap = Readonly<Record<string, number>>;

const DEFAULT_SETTINGS: Settings = { paused: false };

/**
 * chrome.storage.local is readable by content scripts by default, and it holds the Supabase session.
 * No content script needs storage, so limit it to extension pages and the service worker (Chrome 102+).
 */
export const restrictStorageToExtension = async (): Promise<void> => {
  await chrome.storage.local.setAccessLevel({ accessLevel: 'TRUSTED_CONTEXTS' });
};

export const getItem = async <T>(key: string): Promise<T | undefined> => {
  const result = await chrome.storage.local.get(key);
  return result[key] as T | undefined;
};

export const setItem = async (key: string, value: unknown): Promise<void> => {
  await chrome.storage.local.set({ [key]: value });
};

export const removeItem = async (key: string): Promise<void> => {
  await chrome.storage.local.remove(key);
};

export const readQueue = async (): Promise<readonly OrderCandidate[]> => (await getItem<OrderCandidate[]>(STORAGE_KEYS.queue)) ?? [];
export const writeQueue = (queue: readonly OrderCandidate[]): Promise<void> => setItem(STORAGE_KEYS.queue, [...queue]);

export const readSeen = async (): Promise<SeenMap> => (await getItem<SeenMap>(STORAGE_KEYS.seen)) ?? {};
export const writeSeen = (seen: SeenMap): Promise<void> => setItem(STORAGE_KEYS.seen, { ...seen });

export const readSettings = async (): Promise<Settings> => ({ ...DEFAULT_SETTINGS, ...((await getItem<Partial<Settings>>(STORAGE_KEYS.settings)) ?? {}) });
export const writeSettings = (settings: Settings): Promise<void> => setItem(STORAGE_KEYS.settings, { ...settings });
