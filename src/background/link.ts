/**
 * Wallets are linked on the rewards page, but only when the user starts it here. Pressing
 * "Link wallet" in the popup records an intent; within five minutes the rewards page may ask once for
 * a link token, a single-use credential the backend mints for this account. The page never receives
 * the Supabase session.
 */
import type { SupabaseClient } from '@supabase/supabase-js';

export const LINK_INTENT_KEY = 'era:link-intent';
export const LINK_INTENT_TTL_MS = 5 * 60_000;
const LINK_TOKEN_FUNCTION = 'link-token';
const NO_INTENT = 'Open the equitreat extension and press Link wallet first, then sign here within five minutes.';
const NOT_SIGNED_IN = 'Sign in to the equitreat extension first.';
const MINT_FAILED = 'Could not start linking. Press Link wallet in the extension again.';

interface Intent {
  readonly at: number;
}

/** Session storage is only readable by the extension's own pages, never by content scripts. */
const area = (): chrome.storage.StorageArea => chrome.storage.session ?? chrome.storage.local;

export const beginLink = async (now: number = Date.now()): Promise<null> => {
  await area().set({ [LINK_INTENT_KEY]: { at: now } satisfies Intent });
  return null;
};

/** True once per intent, while it is fresh. The intent is used up either way. */
export const takeLinkIntent = async (now: number = Date.now()): Promise<boolean> => {
  const stored = (await area().get(LINK_INTENT_KEY))[LINK_INTENT_KEY] as Partial<Intent> | undefined;
  await area().remove(LINK_INTENT_KEY);
  const age = typeof stored?.at === 'number' ? now - stored.at : Number.POSITIVE_INFINITY;
  return age >= 0 && age <= LINK_INTENT_TTL_MS;
};

/** Answer the rewards page's `link:token` request. */
export const requestLinkToken = async (supabase: SupabaseClient): Promise<{ readonly linkToken: string }> => {
  if (!(await takeLinkIntent())) throw new Error(NO_INTENT);
  const { data: auth } = await supabase.auth.getSession();
  if (!auth.session) throw new Error(NOT_SIGNED_IN);
  const { data, error } = await supabase.functions.invoke(LINK_TOKEN_FUNCTION, { body: {} });
  const token = (data as { linkToken?: unknown } | null)?.linkToken;
  if (error || typeof token !== 'string') throw new Error(MINT_FAILED);
  return { linkToken: token };
};
