import { describe, expect, it } from 'vitest';
import { CONFIG_COLUMNS, EMPTY_SUMMARY, toConfig, toPayoutTokens, toSummary } from '../../src/background/summary';

/** One my_reward_summary() row as PostgREST returns it: numerics arrive as strings. */
const ROW = {
  order_count: 5,
  balance_usd: '3.553240',
  claimable_usd: '1.686340',
  locked_usd: '1.374900',
  review_usd: '0.492000',
  paid_usd: '0.300300',
  unconverted_count: 0,
  rejected_count: 1,
  next_unlock_at: '2026-09-16T10:00:00Z',
  to_minimum_usd: '0.000000',
  spend_90d_usd: '385.48',
  spend_tier: 'Regular',
  next_tier: 'Pro',
  spend_to_next_tier_usd: '614.52',
  holder_level: 'None',
  holder_multiplier_bps: 10000,
  holder_cap_usd: '25.00',
  holder_balance: null,
  next_level: 'Bronze',
  tokens_to_next_level: null,
  next_level_extra_usd: '0.888310',
};

describe('toSummary', () => {
  it('reads the first row of the RPC result and turns numeric strings into numbers', () => {
    const s = toSummary([ROW]);
    expect(s.balance_usd).toBeCloseTo(3.55324, 6);
    expect(s.claimable_usd).toBeCloseTo(1.68634, 6);
    expect(s.review_usd).toBeCloseTo(0.492, 6);
    expect(s.spend_90d_usd).toBe(385.48);
    expect(s.spend_to_next_tier_usd).toBe(614.52);
    expect(s.holder_cap_usd).toBe(25);
    expect(s.next_level_extra_usd).toBeCloseTo(0.88831, 6);
    expect(s.spend_tier).toBe('Regular');
    expect(s.next_tier).toBe('Pro');
    expect(s.holder_level).toBe('None');
    expect(s.holder_multiplier_bps).toBe(10000);
    expect(s.next_unlock_at).toBe('2026-09-16T10:00:00Z');
    expect(s.rejected_count).toBe(1);
  });

  it('keeps unknown values as null instead of zero', () => {
    const s = toSummary(ROW);
    expect(s.holder_balance).toBeNull();
    expect(s.tokens_to_next_level).toBeNull();
    const top = toSummary({ ...ROW, next_tier: null, spend_to_next_tier_usd: null, next_level: null, next_level_extra_usd: null });
    expect(top.next_tier).toBeNull();
    expect(top.spend_to_next_tier_usd).toBeNull();
    expect(top.next_level).toBeNull();
    expect(top.next_level_extra_usd).toBeNull();
  });

  it('reads a known holder balance', () => {
    const s = toSummary({ ...ROW, holder_balance: '12000', tokens_to_next_level: '13000' });
    expect(s.holder_balance).toBe(12000);
    expect(s.tokens_to_next_level).toBe(13000);
  });

  it('falls back to the base tier and level when the row leaves them out', () => {
    const s = toSummary({ order_count: 1, claimable_usd: '0.5', locked_usd: '0.25', review_usd: '0.1' });
    expect(s.spend_tier).toBe('Starter');
    expect(s.holder_level).toBe('None');
    expect(s.holder_multiplier_bps).toBe(10000);
    expect(s.balance_usd).toBeCloseTo(0.85, 6);
  });

  it('returns the empty summary when there is no row', () => {
    expect(toSummary([])).toEqual(EMPTY_SUMMARY);
    expect(toSummary(null)).toEqual(EMPTY_SUMMARY);
    expect(EMPTY_SUMMARY.balance_usd).toBe(0);
    expect(EMPTY_SUMMARY.holder_balance).toBeNull();
  });
});

describe('toConfig', () => {
  it('no longer reads a flat reward rate and carries the tier window and holder token', () => {
    const c = toConfig({ claim_lock_days: 7, min_claim_usd: '1.00', chain_id: 101, chain_name: 'Solana', token_symbol: 'USDC', token_price_usd: '1', tier_window_days: 90, holder_token_address: null, holder_token_decimals: 9 });
    expect(c).not.toBeNull();
    expect(c).not.toHaveProperty('reward_rate_bps');
    expect(c?.tier_window_days).toBe(90);
    expect(c?.holder_token_address).toBeNull();
    expect(c?.min_claim_usd).toBe(1);
  });

  it('is null without a row', () => {
    expect(toConfig(null)).toBeNull();
  });

  it('selects only columns that still exist', () => {
    expect(CONFIG_COLUMNS).not.toContain('reward_rate_bps');
    for (const col of ['claim_lock_days', 'min_claim_usd', 'chain_name', 'tier_window_days', 'holder_token_address', 'holder_token_decimals']) expect(CONFIG_COLUMNS).toContain(col);
  });
});

describe('toPayoutTokens', () => {
  it('offers stock tokens only; a stable row is never a payout choice', () => {
    const tokens = toPayoutTokens([
      { symbol: 'USDC', name: 'USD Coin', kind: 'stable' },
      { symbol: 'NVDA', name: 'NVIDIA', kind: 'swap' },
      { symbol: 'AAPL', name: 'Apple', kind: 'swap' },
      { symbol: 'TSLA', name: 'Tesla', kind: 'swap' },
    ]);
    expect(tokens.map((t) => t.symbol)).toEqual(['NVDA', 'AAPL', 'TSLA']);
    expect(tokens.every((t) => t.kind === 'swap')).toBe(true);
  });

  it('is empty for anything but an array', () => {
    expect(toPayoutTokens(null)).toEqual([]);
  });
});
