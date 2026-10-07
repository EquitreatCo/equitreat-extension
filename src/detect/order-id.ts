import type { Platform } from './url-rules';

const AMAZON_RE = /\b\d{3}-\d{7}-\d{7}\b/;
const FLIPKART_RE = /\bOD\d{15,21}\b/;
const HASH_RE = /#\s?(\d{3,12})\b/;
// Minimum 4 characters: Shopify/WooCommerce order numbers are often 4 digits (#1001).
const GENERIC_RE = /(?:order|confirmation|reference|receipt)\s*(?:number|no\.?|#|id)?\s*[:#]?\s*([A-Z0-9][A-Z0-9-]{3,30})/i;

const STOP_WORDS = new Set(['NUMBER', 'CONFIRMED', 'DETAILS', 'STATUS', 'SUMMARY', 'HISTORY', 'PLACED', 'RECEIVED', 'COMPLETE', 'TOTAL', 'DATE', 'CONFIRMATION']);

type Extractor = (text: string) => string | null;

const firstGroup = (re: RegExp): Extractor => (text) => re.exec(text)?.[1] ?? null;
const wholeMatch = (re: RegExp): Extractor => (text) => re.exec(text)?.[0] ?? null;

const isPlausibleToken = (token: string): boolean =>
  /\d/.test(token) && !STOP_WORDS.has(token.toUpperCase()) && !/^[A-Z]+$/i.test(token);

const generic: Extractor = (text) => {
  const token = firstGroup(GENERIC_RE)(text);
  return token && isPlausibleToken(token) ? token : null;
};

const PLATFORM_EXTRACTORS: Readonly<Partial<Record<Platform, readonly Extractor[]>>> = {
  amazon: [wholeMatch(AMAZON_RE)],
  flipkart: [wholeMatch(FLIPKART_RE)],
  shopify: [firstGroup(HASH_RE)],
  woocommerce: [firstGroup(HASH_RE)],
};

const FALLBACK_EXTRACTORS: readonly Extractor[] = [wholeMatch(AMAZON_RE), wholeMatch(FLIPKART_RE), generic, firstGroup(HASH_RE)];

/** Find the most likely order id in a text fragment, trying platform-specific patterns first. */
export const findOrderId = (text: string, platform: Platform | null): string | null => {
  if (!text) return null;
  const extractors = [...((platform && PLATFORM_EXTRACTORS[platform]) ?? []), ...FALLBACK_EXTRACTORS];
  return extractors.reduce<string | null>((found, extract) => found ?? extract(text), null);
};
