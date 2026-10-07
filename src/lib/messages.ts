/** Messages exchanged between popup/content scripts and the service worker. */
export type RuntimeMessage =
  | { type: 'order:candidate'; candidate: unknown; navigationType: string }
  | { type: 'auth:get-session' }
  | { type: 'auth:sign-out' }
  | { type: 'auth:google' }
  | { type: 'auth:email-send'; email: string }
  | { type: 'auth:email-verify'; email: string; token: string }
  | { type: 'profile:get' }
  | { type: 'orders:recent' }
  | { type: 'settings:get' }
  | { type: 'settings:set'; paused: boolean }
  | { type: 'queue:flush' }
  | { type: 'link:begin' };

export type MessageType = RuntimeMessage['type'];

export type RuntimeResponse<T> = { ok: true; data: T } | { ok: false; error: string };

export interface SessionSummary {
  readonly userId: string;
  readonly email: string | null;
  readonly provider: string;
}

export interface ProfileRow {
  readonly user_id: string;
  readonly auth_method: 'google' | 'email' | 'solana';
  readonly email: string | null;
  readonly payout_wallet: string | null;
}

export interface OrderSummary {
  readonly id: string;
  readonly merchant_domain: string;
  readonly order_id: string;
  readonly amount: number;
  readonly currency: string;
  readonly amount_usd: number | null;
  readonly fx_rate: number | null;
  readonly status: 'pending' | 'verified' | 'rejected' | 'paid';
  readonly detected_at: string;
}

/**
 * my_reward_summary(): cashback follows EQUITREAT_TECHNICAL_DOCUMENT.md §10 (spend tier x order size x holder level).
 * Every *_usd value is cashback in US dollars at the user's current holder level, except spend_*.
 */
export interface RewardSummary {
  readonly order_count: number;
  /** All unpaid cashback: locked + in review + claimable. */
  readonly balance_usd: number;
  /** Approved (verified) orders, claimable at once. */
  readonly claimable_usd: number;
  /** Orders inside the waiting period; always 0 now that claim_lock_days is 0. */
  readonly locked_usd: number;
  /** Orders waiting for an operator to approve them. */
  readonly review_usd: number;
  readonly paid_usd: number;
  readonly unconverted_count: number;
  /** Orders that were not counted because they were over a limit. */
  readonly rejected_count: number;
  readonly next_unlock_at: string | null;
  /** More claimable cashback needed before a claim is allowed; 0 once the minimum is met. */
  readonly to_minimum_usd: number;
  /** Rolling spend that sets the tier (tier_window_days, 90 by default). */
  readonly spend_90d_usd: number;
  readonly spend_tier: string;
  /** Null at the top tier. */
  readonly next_tier: string | null;
  readonly spend_to_next_tier_usd: number | null;
  readonly holder_level: string;
  /** 10000 = 1.00×. */
  readonly holder_multiplier_bps: number;
  /** Most cashback one order can pay at this level. */
  readonly holder_cap_usd: number;
  /** Whole project tokens on the payout wallet; null when unknown (no wallet or token configured). */
  readonly holder_balance: number | null;
  readonly next_level: string | null;
  readonly tokens_to_next_level: number | null;
  /** How much more of the current balance the next level would pay. */
  readonly next_level_extra_usd: number | null;
}

/** Spend in one currency and what it adds up to in USD. */
export interface CurrencyBreakdown {
  readonly currency: string;
  readonly order_count: number;
  readonly spend: number;
  readonly spend_usd: number | null;
  readonly unconverted: number;
}

export interface AppConfig {
  readonly claim_lock_days: number;
  readonly min_claim_usd: number;
  readonly chain_id: number;
  readonly chain_name: string;
  /** The treasury's working token (USDC): balances are counted in it, it is never paid out. */
  readonly token_symbol: string;
  readonly token_price_usd: number;
  /** Days of spend that set the spend tier. */
  readonly tier_window_days: number;
  /** Project token whose balance on the payout wallet sets the holder level; null until configured. */
  readonly holder_token_address: string | null;
  readonly holder_token_decimals: number;
}

/** A stock token the user can be paid in (public payout_tokens table, swap rows only). */
export interface PayoutTokenOption {
  readonly symbol: string;
  readonly name: string;
  readonly kind: 'swap';
}

export interface RecentOrders {
  readonly summary: RewardSummary;
  readonly config: AppConfig | null;
  readonly orders: readonly OrderSummary[];
  readonly currencies: readonly CurrencyBreakdown[];
  readonly payoutTokens: readonly PayoutTokenOption[];
  readonly totalRewardUsd: number;
}

export interface Settings {
  readonly paused: boolean;
}

export const ok = <T>(data: T): RuntimeResponse<T> => ({ ok: true, data });
export const fail = (error: unknown): RuntimeResponse<never> => ({
  ok: false,
  error: error instanceof Error ? error.message : typeof error === 'string' ? error : 'Unexpected error',
});

/** Promise wrapper over chrome.runtime.sendMessage that unwraps the response envelope. */
export const sendMessage = async <T>(msg: RuntimeMessage): Promise<T> => {
  const response = (await chrome.runtime.sendMessage(msg)) as RuntimeResponse<T> | undefined;
  if (!response) throw new Error('No response from the extension service worker');
  if (!response.ok) throw new Error(response.error);
  return response.data;
};
