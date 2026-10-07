import { createClient, type SupabaseClient, type SupportedStorage } from '@supabase/supabase-js';
import { getItem, removeItem, setItem } from './storage';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  throw new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY. Copy .env.example to .env in packages/extension.');
}

/** Persists the auth session in chrome.storage.local (service workers have no localStorage). */
const chromeStorageAdapter: SupportedStorage = {
  getItem: async (key) => (await getItem<string>(key)) ?? null,
  setItem: (key, value) => setItem(key, value),
  removeItem: (key) => removeItem(key),
};

export const createExtensionSupabase = (): SupabaseClient =>
  createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: {
      storage: chromeStorageAdapter,
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
    },
    global: { fetch: (...args) => fetch(...args) },
  });
