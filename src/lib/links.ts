/** Links from the popup to the rewards page, where every wallet action (linking, claiming) happens. */
import { sendMessage } from './messages';

const REWARDS_URL = import.meta.env.VITE_WALLET_CONNECT_URL;

export type RewardsPageMode = 'link' | 'view';

/** Rewards page URL; `link` asks the page to attach the signed wallet to this account. */
export const rewardsPageHref = (mode: RewardsPageMode): string => {
  if (!REWARDS_URL) throw new Error('VITE_WALLET_CONNECT_URL is not configured');
  const url = new URL(REWARDS_URL);
  if (mode === 'link') url.searchParams.set('link', '1');
  return url.toString();
};

/**
 * Linking must start here: `link:begin` lets the service worker hand the rewards page one link
 * token during the next five minutes.
 */
export const openRewardsPage = (mode: RewardsPageMode): void => {
  const open = (): void => void chrome.tabs.create({ url: rewardsPageHref(mode) });
  if (mode !== 'link') return open();
  sendMessage({ type: 'link:begin' }).then(open, (err: unknown) => {
    console.warn('[equitreat] could not start linking:', err);
    open();
  });
};
