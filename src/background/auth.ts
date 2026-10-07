import type { AuthError, Session, SupabaseClient } from '@supabase/supabase-js';
import { randomHex, sha256Hex } from '../lib/hash';
import type { SessionSummary } from '../lib/messages';
import { flush } from './queue';
import { markWelcome } from '../lib/welcome';

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const NONCE_BYTES = 32;

const throwIfError = (error: AuthError | null): void => {
  if (error) throw new Error(error.message);
};

export const summarizeSession = (session: Session | null): SessionSummary | null => {
  if (!session) return null;
  const provider = (session.user.app_metadata['provider'] as string | undefined) ?? 'email';
  return { userId: session.user.id, email: session.user.email ?? null, provider };
};

const parseIdToken = (redirectUrl: string): string => {
  const hash = new URL(redirectUrl).hash.replace(/^#/, '');
  const token = new URLSearchParams(hash).get('id_token');
  if (!token) throw new Error('Google sign-in did not return an id_token');
  return token;
};

const buildGoogleUrl = (clientId: string, hashedNonce: string): string => {
  const params = new URLSearchParams({
    client_id: clientId,
    response_type: 'id_token',
    redirect_uri: `https://${chrome.runtime.id}.chromiumapp.org/`,
    scope: 'openid email profile',
    nonce: hashedNonce,
    prompt: 'select_account',
  });
  return `${GOOGLE_AUTH_URL}?${params.toString()}`;
};

/** Google sign-in via chrome.identity + Supabase id-token exchange (nonce is hashed for Google, raw for Supabase). */
export const googleSignIn = async (supabase: SupabaseClient): Promise<SessionSummary | null> => {
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
  if (!clientId) throw new Error('Google sign-in not configured');
  const nonce = randomHex(NONCE_BYTES);
  const hashedNonce = await sha256Hex(nonce);
  const redirectUrl = await chrome.identity.launchWebAuthFlow({ url: buildGoogleUrl(clientId, hashedNonce), interactive: true });
  if (!redirectUrl) throw new Error('Google sign-in was cancelled');
  const { data, error } = await supabase.auth.signInWithIdToken({ provider: 'google', token: parseIdToken(redirectUrl), nonce });
  throwIfError(error);
  await afterSignIn(supabase);
  await markWelcome('google');
  reopenPopup();
  return summarizeSession(data.session);
};

export const emailSend = async (supabase: SupabaseClient, email: string): Promise<void> => {
  const { error } = await supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: true } });
  throwIfError(error);
};

export const emailVerify = async (supabase: SupabaseClient, email: string, token: string): Promise<SessionSummary | null> => {
  const { data, error } = await supabase.auth.verifyOtp({ email, token, type: 'email' });
  throwIfError(error);
  await afterSignIn(supabase);
  await markWelcome('email');
  return summarizeSession(data.session);
};

/* Chrome closes the popup while the Google window has focus. Reopen it once focus returns to the
   browser window; retry briefly because the auth window may still be closing. chrome.action.openPopup
   exists from Chrome 127; on older versions the user simply reopens the popup and still sees the
   success screen. */
const REOPEN_ATTEMPT_DELAYS_MS = [0, 350, 900] as const;

const reopenPopup = (): void => {
  if (typeof chrome.action?.openPopup !== 'function') return;
  const attempt = (i: number): void => {
    const delay = REOPEN_ATTEMPT_DELAYS_MS[i];
    if (delay === undefined) return;
    setTimeout(() => {
      chrome.action.openPopup().catch(() => attempt(i + 1));
    }, delay);
  };
  attempt(0);
};

/* The profile row is created by the database on sign-up; clients can no longer write it. */
const afterSignIn = async (supabase: SupabaseClient): Promise<void> => {
  await flush(supabase);
};
