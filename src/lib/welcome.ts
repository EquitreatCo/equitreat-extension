/**
 * One-shot "you just signed in" flag. The background worker sets it when a sign-in completes; the
 * popup consumes it on its next render to show a short success screen before the main view.
 * Needed because Chrome closes the popup while the Google window has focus.
 */
import { getItem, removeItem, setItem } from './storage';

export type WelcomeMethod = 'google' | 'email';

export interface WelcomeFlag {
  readonly at: number;
  readonly method: WelcomeMethod;
}

export const WELCOME_KEY = 'era:welcome';
/** Ignore flags older than this (the user closed the popup and came back much later). */
export const WELCOME_TTL_MS = 2 * 60 * 1000;

export const isFreshWelcome = (flag: unknown, now: number): flag is WelcomeFlag => {
  if (typeof flag !== 'object' || flag === null) return false;
  const { at, method } = flag as Partial<WelcomeFlag>;
  return typeof at === 'number' && (method === 'google' || method === 'email') && now - at >= 0 && now - at <= WELCOME_TTL_MS;
};

export const markWelcome = (method: WelcomeMethod, now = Date.now()): Promise<void> => setItem(WELCOME_KEY, { at: now, method });

/** Read and clear the flag. Returns it only when it is fresh. */
export const takeWelcome = async (now = Date.now()): Promise<WelcomeFlag | null> => {
  const flag = await getItem<unknown>(WELCOME_KEY);
  if (flag === undefined) return null;
  await removeItem(WELCOME_KEY);
  return isFreshWelcome(flag, now) ? flag : null;
};
