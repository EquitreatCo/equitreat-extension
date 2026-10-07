/**
 * Multi-currency helpers. Orders are recorded in the store's currency and converted to USD
 * (the reward unit) with a "units per USD" rate; these helpers keep that maths and its
 * presentation in one place for the popup and the web pages.
 */

export const REWARD_CURRENCY = 'USD';

/** Convert a native amount to USD given how many units of that currency one USD buys. */
export const toUsd = (amount: number, unitsPerUsd: number): number | null => {
  if (!Number.isFinite(amount) || !Number.isFinite(unitsPerUsd) || unitsPerUsd <= 0) return null;
  return Math.round((amount / unitsPerUsd) * 100) / 100;
};

/** "GBP, INR and EUR" style list of the distinct non-empty codes, in first-seen order. Empty when only USD. */
export const describeCurrencyMix = (codes: readonly string[]): string => {
  const distinct = [...new Set(codes.map((c) => c.trim().toUpperCase()).filter(Boolean))];
  if (distinct.length === 0 || (distinct.length === 1 && distinct[0] === REWARD_CURRENCY)) return '';
  if (distinct.length === 1) return distinct[0] ?? '';
  return `${distinct.slice(0, -1).join(', ')} and ${distinct[distinct.length - 1]}`;
};

const usdFormatter = new Intl.NumberFormat('en-US', { style: 'currency', currency: REWARD_CURRENCY, currencyDisplay: 'code' });

/** Fixed "US$1,234.56" rendering, independent of the viewer's locale so totals read the same everywhere. */
export const formatUsd = (amount: number): string => usdFormatter.format(amount).replace(/^USD\s?/, 'US$');

/**
 * Cashback is stored in micro-dollars. Show cents like any other money; only an amount that would
 * round away gets more places, so a fraction of a cent never reads as US$0.00.
 */
const SUB_CENT = 0.005;
/** 2.075 is held as 2.07499…, so nudge before rounding or it would show a cent short. */
const EPSILON = 1e-9;
const cashbackFormatter = (maxDecimals: number): Intl.NumberFormat =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: REWARD_CURRENCY, currencyDisplay: 'code', minimumFractionDigits: 2, maximumFractionDigits: maxDecimals });
const centsFormatter = cashbackFormatter(2);
const subCentFormatter = cashbackFormatter(4);

/** Cashback amounts: "US$3.50", and four places only below half a cent ("US$0.0025"). */
export const formatCashbackUsd = (amount: number): string => {
  const value = Number.isFinite(amount) ? amount : 0;
  if (Math.abs(value) < SUB_CENT) return subCentFormatter.format(value).replace(/^USD\s?/, 'US$');
  const cents = Math.round((Math.abs(value) + EPSILON) * 100) / 100;
  return centsFormatter.format(value < 0 ? -cents : cents).replace(/^USD\s?/, 'US$');
};

interface ConvertedOrder {
  readonly currency: string;
  readonly amount_usd: number | null;
}

/** Secondary line under a native amount: the USD equivalent, "rate pending", or nothing for USD orders. */
export const usdEquivalentLabel = (order: ConvertedOrder): string => {
  if (order.currency.toUpperCase() === REWARD_CURRENCY) return '';
  if (order.amount_usd === null || !Number.isFinite(order.amount_usd)) return 'rate pending';
  return `≈ ${formatUsd(order.amount_usd)}`;
};
