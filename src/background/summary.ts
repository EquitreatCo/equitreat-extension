/**
 * Pure mappers from Supabase rows to the popup's types. PostgREST returns numerics as strings, and the
 * reward summary follows the tiered cashback model in EQUITREAT_TECHNICAL_DOCUMENT.md §10 (spend tier x order size x
 * holder level); nothing here computes cashback, it only reads what the database decided.
 */
import type { AppConfig, PayoutTokenOption, RewardSummary } from '../lib/messages';

/** app_config columns the popup reads. The flat reward rate is gone; cashback comes from the tier tables. */
export const CONFIG_COLUMNS =
  'claim_lock_days, min_claim_usd, chain_id, chain_name, token_symbol, token_price_usd, tier_window_days, holder_token_address, holder_token_decimals';

/** The base spend tier and holder level (EQUITREAT_TECHNICAL_DOCUMENT.md §10.5). */
const BASE_TIER = 'Starter';
const BASE_LEVEL = 'None';
const BASE_MULTIPLIER_BPS = 10_000;
const DEFAULT_TIER_WINDOW_DAYS = 90;

export const toNumber = (v: unknown): number => (typeof v === 'number' ? v : Number(v ?? 0)) || 0;

/** Null stays null ("not known"), so a missing holder balance is never shown as zero tokens. */
const toNullableNumber = (v: unknown): number | null => {
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : null;
};

const toText = (v: unknown, fallback: string): string => (typeof v === 'string' && v.trim() ? v.trim() : fallback);
const toNullableText = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null);

export const EMPTY_SUMMARY: RewardSummary = {
  order_count: 0,
  balance_usd: 0,
  claimable_usd: 0,
  locked_usd: 0,
  review_usd: 0,
  paid_usd: 0,
  unconverted_count: 0,
  rejected_count: 0,
  next_unlock_at: null,
  to_minimum_usd: 0,
  spend_90d_usd: 0,
  spend_tier: BASE_TIER,
  next_tier: null,
  spend_to_next_tier_usd: null,
  holder_level: BASE_LEVEL,
  holder_multiplier_bps: BASE_MULTIPLIER_BPS,
  holder_cap_usd: 0,
  holder_balance: null,
  next_level: null,
  tokens_to_next_level: null,
  next_level_extra_usd: null,
};

/** One my_reward_summary() row. `balance_usd` falls back to the sum of its parts for older rows. */
export const toSummary = (raw: unknown): RewardSummary => {
  const r = (Array.isArray(raw) ? raw[0] : raw) as Record<string, unknown> | null | undefined;
  if (!r) return EMPTY_SUMMARY;
  const claimable = toNumber(r['claimable_usd']);
  const locked = toNumber(r['locked_usd']);
  const review = toNumber(r['review_usd']);
  return {
    order_count: toNumber(r['order_count']),
    balance_usd: toNullableNumber(r['balance_usd']) ?? claimable + locked + review,
    claimable_usd: claimable,
    locked_usd: locked,
    review_usd: review,
    paid_usd: toNumber(r['paid_usd']),
    unconverted_count: toNumber(r['unconverted_count']),
    rejected_count: toNumber(r['rejected_count']),
    next_unlock_at: typeof r['next_unlock_at'] === 'string' ? r['next_unlock_at'] : null,
    to_minimum_usd: toNumber(r['to_minimum_usd']),
    spend_90d_usd: toNumber(r['spend_90d_usd']),
    spend_tier: toText(r['spend_tier'], BASE_TIER),
    next_tier: toNullableText(r['next_tier']),
    spend_to_next_tier_usd: toNullableNumber(r['spend_to_next_tier_usd']),
    holder_level: toText(r['holder_level'], BASE_LEVEL),
    holder_multiplier_bps: toNullableNumber(r['holder_multiplier_bps']) ?? BASE_MULTIPLIER_BPS,
    holder_cap_usd: toNumber(r['holder_cap_usd']),
    holder_balance: toNullableNumber(r['holder_balance']),
    next_level: toNullableText(r['next_level']),
    tokens_to_next_level: toNullableNumber(r['tokens_to_next_level']),
    next_level_extra_usd: toNullableNumber(r['next_level_extra_usd']),
  };
};

export const toConfig = (raw: unknown): AppConfig | null => {
  const r = raw as Record<string, unknown> | null;
  if (!r) return null;
  return {
    claim_lock_days: toNumber(r['claim_lock_days']),
    min_claim_usd: toNumber(r['min_claim_usd']),
    chain_id: toNumber(r['chain_id']),
    chain_name: String(r['chain_name'] ?? ''),
    token_symbol: String(r['token_symbol'] ?? ''),
    token_price_usd: toNumber(r['token_price_usd']),
    tier_window_days: toNullableNumber(r['tier_window_days']) ?? DEFAULT_TIER_WINDOW_DAYS,
    holder_token_address: toNullableText(r['holder_token_address']),
    holder_token_decimals: toNumber(r['holder_token_decimals']),
  };
};

/** Every payout is a tokenized stock: rows that are not swap tokens are never offered. */
export const toPayoutTokens = (raw: unknown): PayoutTokenOption[] =>
  Array.isArray(raw)
    ? raw
        .map((row) => row as Record<string, unknown>)
        .filter((r) => r['kind'] === 'swap')
        .map((r) => ({ symbol: String(r['symbol'] ?? ''), name: String(r['name'] ?? ''), kind: 'swap' as const }))
    : [];
