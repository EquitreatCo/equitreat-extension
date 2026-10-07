import { OrderCandidateSchema, findMerchant } from '../shared/index.js';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { CurrencyBreakdown, OrderSummary, ProfileRow, RecentOrders, RewardSummary, RuntimeMessage, SessionSummary, Settings } from '../lib/messages';
import { readSettings, writeSettings } from '../lib/storage';
import { emailSend, emailVerify, googleSignIn, summarizeSession } from './auth';
import { dedupeKey, isDuplicate, remember } from './dedupe';
import { enqueue, flush } from './queue';
import { beginLink } from './link';
import { CONFIG_COLUMNS, toConfig, toNumber, toPayoutTokens, toSummary } from './summary';

const RECENT_LIMIT = 10;
const ORDER_COLUMNS = 'id, merchant_domain, order_id, amount, currency, amount_usd, fx_rate, status, detected_at';
const FX_REFRESH_FUNCTION = 'fx-refresh';

const requireUserId = async (supabase: SupabaseClient): Promise<string> => {
  const { data } = await supabase.auth.getSession();
  const id = data.session?.user.id;
  if (!id) throw new Error('Not signed in');
  return id;
};

const getSession = async (supabase: SupabaseClient): Promise<SessionSummary | null> => {
  const { data } = await supabase.auth.getSession();
  return summarizeSession(data.session);
};

const signOut = async (supabase: SupabaseClient): Promise<null> => {
  const { error } = await supabase.auth.signOut();
  if (error) throw new Error(error.message);
  return null;
};

type CandidateOutcome = 'queued' | 'ignored:paused' | 'ignored:duplicate' | 'ignored:unsupported-store';

/**
 * Reloads and back/forward navigations are NOT filtered here: the order-id dedupe below already
 * prevents double records, and dropping them would lose orders when a confirmation page is refreshed.
 * The navigation type is kept in raw_signals for diagnostics.
 */
const handleCandidate = async (supabase: SupabaseClient, raw: unknown, navigationType: string): Promise<CandidateOutcome> => {
  const parsed = OrderCandidateSchema.parse(raw);
  // Content scripts run only on listed stores; this re-check also gives each order the store's canonical domain.
  const merchant = findMerchant(parsed.merchantDomain);
  if (!merchant) return 'ignored:unsupported-store';
  const candidate = { ...parsed, merchantDomain: merchant.domain, rawSignals: { ...parsed.rawSignals, navigationType } };
  if ((await readSettings()).paused) return 'ignored:paused';
  const key = await dedupeKey(candidate.merchantDomain, candidate.orderId);
  if (await isDuplicate(key)) return 'ignored:duplicate';
  await remember(key);
  await enqueue(candidate);
  await flush(supabase);
  return 'queued';
};

const getProfile = async (supabase: SupabaseClient): Promise<ProfileRow | null> => {
  const userId = await requireUserId(supabase);
  const { data, error } = await supabase.from('profiles').select('user_id, auth_method, email, payout_wallet').eq('user_id', userId).maybeSingle();
  if (error) throw new Error(error.message);
  return (data as ProfileRow | null) ?? null;
};

const toCurrencies = (raw: unknown): CurrencyBreakdown[] => {
  if (!Array.isArray(raw)) return [];
  return raw.map((row) => {
    const r = row as Record<string, unknown>;
    return {
      currency: String(r['currency'] ?? '').trim().toUpperCase(),
      order_count: toNumber(r['order_count']),
      spend: toNumber(r['spend']),
      spend_usd: r['spend_usd'] === null || r['spend_usd'] === undefined ? null : toNumber(r['spend_usd']),
      unconverted: toNumber(r['unconverted']),
    };
  });
};

const toOrders = (raw: unknown): OrderSummary[] =>
  ((raw ?? []) as OrderSummary[]).map((r) => ({
    ...r,
    amount: toNumber(r.amount),
    amount_usd: r.amount_usd === null ? null : toNumber(r.amount_usd),
    fx_rate: r.fx_rate === null || r.fx_rate === undefined ? null : toNumber(r.fx_rate),
  }));

interface RewardQueries {
  readonly orders: OrderSummary[];
  readonly summary: RewardSummary;
  readonly currencies: CurrencyBreakdown[];
}

const queryRewards = async (supabase: SupabaseClient, userId: string): Promise<RewardQueries> => {
  const [orders, summary, currencies] = await Promise.all([
    supabase.from('orders').select(ORDER_COLUMNS).eq('user_id', userId).order('detected_at', { ascending: false }).limit(RECENT_LIMIT),
    supabase.rpc('my_reward_summary'),
    supabase.rpc('my_currency_breakdown'),
  ]);
  if (orders.error) throw new Error(orders.error.message);
  if (summary.error) throw new Error(summary.error.message);
  if (currencies.error) throw new Error(currencies.error.message);
  return { orders: toOrders(orders.data), summary: toSummary(summary.data), currencies: toCurrencies(currencies.data) };
};

/**
 * Orders in a currency without a stored rate stay unconverted until rates are refreshed. When the
 * popup sees any, it asks the backend to refresh now and re-reads so the user is not left waiting.
 */
const requestFxRefresh = async (supabase: SupabaseClient): Promise<boolean> => {
  const { error } = await supabase.functions.invoke(FX_REFRESH_FUNCTION, { body: {} });
  if (error) console.warn('[equitreat] fx refresh failed:', error.message);
  return !error;
};

const recentOrders = async (supabase: SupabaseClient): Promise<RecentOrders> => {
  const userId = await requireUserId(supabase);
  const [first, config, tokens] = await Promise.all([
    queryRewards(supabase, userId),
    supabase.from('app_config').select(CONFIG_COLUMNS).eq('id', 1).maybeSingle(),
    supabase.from('payout_tokens').select('symbol, name, kind').eq('enabled', true).order('sort_order'),
  ]);
  const rewards = first.summary.unconverted_count > 0 && (await requestFxRefresh(supabase)) ? await queryRewards(supabase, userId) : first;
  return {
    orders: rewards.orders,
    currencies: rewards.currencies,
    payoutTokens: toPayoutTokens(tokens.data),
    totalRewardUsd: rewards.summary.paid_usd,
    summary: rewards.summary,
    config: toConfig(config.data),
  };
};

const setSettings = async (paused: boolean): Promise<Settings> => {
  const next = { paused };
  await writeSettings(next);
  return next;
};

/** Dispatch one runtime message to its handler; throws on failure. */
export const handleMessage = (supabase: SupabaseClient, msg: RuntimeMessage): Promise<unknown> => {
  switch (msg.type) {
    case 'order:candidate':
      return handleCandidate(supabase, msg.candidate, msg.navigationType);
    case 'auth:get-session':
      return getSession(supabase);
    case 'auth:sign-out':
      return signOut(supabase);
    case 'auth:google':
      return googleSignIn(supabase);
    case 'auth:email-send':
      return emailSend(supabase, msg.email).then(() => null);
    case 'auth:email-verify':
      return emailVerify(supabase, msg.email, msg.token);
    case 'profile:get':
      return getProfile(supabase);
    case 'orders:recent':
      return recentOrders(supabase);
    case 'settings:get':
      return readSettings();
    case 'settings:set':
      return setSettings(msg.paused);
    case 'queue:flush':
      return flush(supabase);
    case 'link:begin':
      return beginLink();
    default:
      return Promise.reject(new Error(`Unknown message type: ${String((msg as { type?: unknown }).type)}`));
  }
};
