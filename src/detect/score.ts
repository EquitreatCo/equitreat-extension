import { HASHED_ORDER_ID_PREFIX, MIN_ORDER_CONFIDENCE, parseAmount, type CurrencyHints, type OrderCandidate, type DetectionMethod } from '../shared/index.js';
import { fnv1a32hex } from '../lib/hash';
import type { DomSignals } from './dom-signals';
import { findOrderId } from './order-id';
import type { StructuredSignal, StructuredSource } from './structured';
import { matchConfirmationUrl } from './url-rules';

export interface ScoreInput {
  readonly url: string;
  readonly dom: DomSignals;
  readonly structured: readonly StructuredSignal[];
  readonly hints: CurrencyHints;
  readonly now?: Date;
}

/**
 * A page event on its own stays below the threshold: any script on a page can emit one, so the URL
 * or the visible page has to agree before an order is recorded.
 */
const SOURCE_WEIGHT: Readonly<Record<StructuredSource, number>> = { datalayer: 50, jsonld: 50, shopify: 50, fbq: 35 };
const WEIGHT_HEADLINE = 20;
const WEIGHT_ORDER_ID = 15;
const WEIGHT_TOTAL = 20;
const WEIGHT_NEGATIVE = -40;
/** Path segments longer than the max, or at least the min long with a digit, are ids or tokens. */
const OPAQUE_MIN_LENGTH = 8;
const OPAQUE_MAX_LENGTH = 32;

/** Precedence for amount/currency/orderId when several structured sources disagree. */
const SOURCE_PRIORITY: readonly StructuredSource[] = ['datalayer', 'jsonld', 'shopify', 'fbq'];

const uniqueSources = (signals: readonly StructuredSignal[]): readonly StructuredSource[] =>
  signals.reduce<readonly StructuredSource[]>((acc, s) => (acc.includes(s.source) ? acc : [...acc, s.source]), []);

const bySourcePriority = (signals: readonly StructuredSignal[]): readonly StructuredSignal[] =>
  [...signals].sort((a, b) => SOURCE_PRIORITY.indexOf(a.source) - SOURCE_PRIORITY.indexOf(b.source));

const stripWww = (host: string): string => host.replace(/^www\./, '');

/**
 * The page path with ids and tokens replaced by :id and anything holding an @ by :redacted, so an
 * order-status link (Shopify's /checkouts/cn/<token>/thank-you, for one) is never stored. The query
 * and fragment are always dropped. The database applies the same rules (public.redact_page_url).
 */
export const redactPath = (pathname: string): string =>
  pathname
    .split('/')
    .map((seg) => {
      if (seg === '') return seg;
      if (/@|%40/i.test(seg)) return ':redacted';
      if (/^\d{4,}$/.test(seg)) return ':id';
      if (seg.length > OPAQUE_MAX_LENGTH || (seg.length >= OPAQUE_MIN_LENGTH && /\d/.test(seg))) return ':id';
      return seg;
    })
    .join('/');

const parseLocation = (url: string): { domain: string; pageUrl: string; path: string } | null => {
  try {
    const u = new URL(url);
    return { domain: stripWww(u.hostname.toLowerCase()), pageUrl: `${u.origin}${redactPath(u.pathname)}`, path: u.pathname.replace(/\/+$/, '') || '/' };
  } catch {
    return null;
  }
};

const clamp = (n: number): number => Math.max(0, Math.min(100, Math.round(n)));

const detectionMethod = (sources: readonly StructuredSource[], urlMatched: boolean, domHit: boolean): DetectionMethod => {
  if (sources.length === 1 && !urlMatched && !domHit) return sources[0] as DetectionMethod;
  if (sources.length >= 1) return 'mixed';
  return urlMatched ? 'url' : 'dom';
};

/** True when some path segment identifies one order, i.e. redactPath turns it into :id. */
const hasOrderToken = (path: string): boolean => redactPath(path).split('/').includes(':id');

/**
 * Id for an order page that shows no order number: the store, the confirmation page's path, the
 * amount and the currency. When the path carries an order token, that alone tells orders apart, so no
 * date is added and a later revisit gives the same id. A fixed path (Magento's /checkout/onepage/success)
 * adds the day, so a repeat purchase on a later day is not lost to the unique order key. The raw path
 * only feeds this 32-bit hash; the stored pageUrl is redacted.
 */
const hashedOrderId = (domain: string, path: string, amount: number, currency: string, now: Date): string => {
  const day = hasOrderToken(path) ? '' : `|${now.toISOString().slice(0, 10)}`;
  return `${HASHED_ORDER_ID_PREFIX}${fnv1a32hex(`${domain}|${path}|${amount}|${currency}${day}`)}`;
};

/** Combine URL, DOM and structured signals into a validated OrderCandidate, or null if too weak. */
export const scoreCandidate = (input: ScoreInput): OrderCandidate | null => {
  const location = parseLocation(input.url);
  if (!location) return null;
  const now = input.now ?? new Date();

  const urlMatch = matchConfirmationUrl(input.url);
  const platform = urlMatch?.platform ?? null;
  const sources = uniqueSources(input.structured);
  const prioritized = bySourcePriority(input.structured);
  // Generic thank-you and receipt paths are easy to reach again from order history, so they only count
  // when the store also emits a purchase event. Platform-specific confirmation URLs always count.
  const urlScore = urlMatch && (urlMatch.platform !== 'generic' || sources.length > 0) ? urlMatch.score : 0;

  const domTotal = input.dom.totalText ? parseAmount(input.dom.totalText, input.hints) : null;
  const domOrderId = findOrderId(input.dom.orderIdText ?? input.dom.bodyExcerpt, platform);

  const confidence =
    sources.reduce((sum, s) => sum + SOURCE_WEIGHT[s], 0) +
    urlScore +
    (input.dom.headlineHit ? WEIGHT_HEADLINE : 0) +
    (domOrderId ? WEIGHT_ORDER_ID : 0) +
    (domTotal ? WEIGHT_TOTAL : 0) +
    (input.dom.negative ? WEIGHT_NEGATIVE : 0);

  const structuredAmount = prioritized.find((s) => s.amount !== undefined && s.amount > 0);
  const amount = structuredAmount?.amount ?? domTotal?.amount ?? null;
  const currency = structuredAmount?.currency ?? prioritized.find((s) => s.currency)?.currency ?? domTotal?.currency ?? input.hints.metaCurrency?.toUpperCase() ?? null;

  if (confidence < MIN_ORDER_CONFIDENCE || amount === null || amount <= 0 || !currency || !/^[A-Z]{3}$/.test(currency)) return null;

  const orderId = prioritized.find((s) => s.orderId)?.orderId ?? domOrderId ?? hashedOrderId(location.domain, location.path, amount, currency, now);
  const domHit = input.dom.headlineHit || domOrderId !== null || domTotal !== null;

  return {
    merchantDomain: location.domain,
    orderId,
    amount,
    currency,
    pageUrl: location.pageUrl,
    detectionMethod: detectionMethod(sources, urlMatch !== null, domHit),
    confidence: clamp(confidence),
    rawSignals: {
      url: urlMatch?.score ?? null,
      platform,
      headline: input.dom.headlineHit,
      orderIdFound: domOrderId !== null,
      sources: [...sources],
      negative: input.dom.negative,
    },
    detectedAt: now.toISOString(),
  };
};

const SECOND_LEVEL = new Set(['co', 'com', 'org', 'net', 'ac', 'gov']);

const tldOf = (hostname: string): string | undefined => {
  const labels = hostname.toLowerCase().split('.').filter(Boolean);
  if (labels.length < 2) return undefined;
  const last = labels[labels.length - 1] as string;
  const second = labels[labels.length - 2] as string;
  return labels.length >= 3 && SECOND_LEVEL.has(second) ? `${second}.${last}` : last;
};

const META_CURRENCY_SELECTOR = 'meta[property="og:price:currency"], meta[property="product:price:currency"]';

/** Currency hints for parseAmount derived from the page. */
export const hintsFromDocument = (doc: Document, url: string): CurrencyHints => {
  const hostname = (() => {
    try {
      return new URL(url).hostname;
    } catch {
      return '';
    }
  })();
  const tld = tldOf(hostname);
  const lang = doc.documentElement.getAttribute('lang')?.trim() || undefined;
  const metaCurrency = doc.querySelector(META_CURRENCY_SELECTOR)?.getAttribute('content')?.trim().toUpperCase() || undefined;
  return { ...(tld ? { tld } : {}), ...(lang ? { lang } : {}), ...(metaCurrency ? { metaCurrency } : {}) };
};
