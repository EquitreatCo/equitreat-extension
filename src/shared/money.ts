/**
 * Locale-tolerant money parsing: "$1,234.56", "1.234,56 €", "₹1,23,456.00", "1 234,56 kr".
 */

export interface CurrencyHints {
  /** Top-level domain of the merchant (e.g. "ca", "co.uk", "com.au"). */
  readonly tld?: string;
  /** Value of <html lang> (e.g. "en-NZ", "sv"). */
  readonly lang?: string;
  /** Explicit currency from page metadata (og:price:currency, JSON-LD priceCurrency). */
  readonly metaCurrency?: string;
}

export interface ParsedAmount {
  readonly amount: number;
  readonly currency: string;
}

const ISO_CODES = [
  'USD', 'EUR', 'GBP', 'INR', 'JPY', 'AUD', 'CAD', 'SGD', 'AED', 'CHF', 'BRL', 'MXN', 'NZD',
  'HKD', 'SEK', 'NOK', 'DKK', 'PLN', 'CZK', 'HUF', 'RON', 'ZAR', 'KRW', 'CNY', 'TRY', 'RUB',
  'SAR', 'QAR', 'MYR', 'THB', 'IDR', 'PHP', 'VND', 'TWD', 'ILS', 'EGP', 'NGN', 'KES', 'PKR', 'BDT',
] as const;

const ZERO_DECIMAL = new Set(['JPY', 'KRW', 'VND', 'IDR', 'HUF', 'CLP', 'ISK']);

const UNAMBIGUOUS_SYMBOLS: Readonly<Record<string, string>> = {
  '€': 'EUR',
  '£': 'GBP',
  '₹': 'INR',
  'rs': 'INR',
  'rs.': 'INR',
  '₩': 'KRW',
  '₽': 'RUB',
  '₺': 'TRY',
  '₪': 'ILS',
  '₫': 'VND',
  '₱': 'PHP',
  '₦': 'NGN',
  'zł': 'PLN',
  'kč': 'CZK',
  'ft': 'HUF',
  'lei': 'RON',
  'a$': 'AUD',
  'au$': 'AUD',
  'c$': 'CAD',
  'ca$': 'CAD',
  'nz$': 'NZD',
  'hk$': 'HKD',
  's$': 'SGD',
  'sg$': 'SGD',
  'r$': 'BRL',
  'mx$': 'MXN',
  'us$': 'USD',
  'rm': 'MYR',
  '฿': 'THB',
  'rp': 'IDR',
};

const DOLLAR_BY_TLD: Readonly<Record<string, string>> = {
  ca: 'CAD',
  'com.au': 'AUD',
  au: 'AUD',
  'co.nz': 'NZD',
  nz: 'NZD',
  sg: 'SGD',
  'com.sg': 'SGD',
  hk: 'HKD',
  'com.hk': 'HKD',
  'com.mx': 'MXN',
  mx: 'MXN',
};

const DOLLAR_BY_REGION: Readonly<Record<string, string>> = {
  CA: 'CAD', AU: 'AUD', NZ: 'NZD', SG: 'SGD', HK: 'HKD', MX: 'MXN',
};

const KR_BY_HINT: Readonly<Record<string, string>> = {
  sv: 'SEK', se: 'SEK', no: 'NOK', nb: 'NOK', nn: 'NOK', da: 'DKK', dk: 'DKK', is: 'ISK',
};

const YEN_BY_HINT: Readonly<Record<string, string>> = { zh: 'CNY', cn: 'CNY', 'com.cn': 'CNY' };

const regionOf = (lang?: string): string | undefined => {
  const region = lang?.split(/[-_]/)[1];
  return region ? region.toUpperCase() : undefined;
};

const languageOf = (lang?: string): string | undefined => lang?.split(/[-_]/)[0]?.toLowerCase();

/** Resolve a currency symbol to an ISO 4217 code using page hints for ambiguous symbols. */
export const symbolToCurrency = (symbol: string, hints: CurrencyHints = {}): string | null => {
  const key = symbol.trim().toLowerCase();
  const direct = UNAMBIGUOUS_SYMBOLS[key];
  if (direct) return direct;

  const tld = hints.tld?.toLowerCase();
  const region = regionOf(hints.lang);
  const language = languageOf(hints.lang);

  if (key === '$') {
    return (tld && DOLLAR_BY_TLD[tld]) ?? (region && DOLLAR_BY_REGION[region]) ?? 'USD';
  }
  if (key === 'kr' || key === 'kr.') {
    return (language && KR_BY_HINT[language]) ?? (tld && KR_BY_HINT[tld]) ?? 'SEK';
  }
  if (key === '¥' || key === '￥') {
    return (language && YEN_BY_HINT[language]) ?? (tld && YEN_BY_HINT[tld]) ?? 'JPY';
  }
  if (key === 'chf') return 'CHF';
  return null;
};

const NUMBER_RE = /^\d{1,3}(?:[.,'   ]\d{2,3})*(?:[.,]\d{1,2})?$|^\d+(?:[.,]\d{1,2})?$/;

/**
 * Convert a locale-formatted number string to a JS number.
 * Rule: the last separator is the decimal separator iff it is followed by 1-2 digits
 * and either differs from the other separators or is the only separator with ≤2 trailing digits.
 */
export const normalizeNumber = (raw: string): number | null => {
  const text = raw.trim();
  if (!text || !NUMBER_RE.test(text)) return null;

  const separators = text.match(/[.,'   ]/g) ?? [];
  if (separators.length === 0) return Number(text);

  const lastSep = separators[separators.length - 1] as string;
  const lastIdx = text.lastIndexOf(lastSep);
  const trailing = text.slice(lastIdx + 1);
  const distinct = new Set(separators);

  const lastIsDecimal =
    (lastSep === '.' || lastSep === ',') &&
    trailing.length <= 2 &&
    (distinct.size > 1 || separators.length === 1);

  const digitsOnly = (s: string): string => s.replace(/[^\d]/g, '');
  const value = lastIsDecimal
    ? Number(`${digitsOnly(text.slice(0, lastIdx))}.${trailing}`)
    : Number(digitsOnly(text));
  return Number.isFinite(value) ? value : null;
};

const SYMBOL_ALT =
  'US\\$|A\\$|AU\\$|C\\$|CA\\$|NZ\\$|HK\\$|S\\$|SG\\$|R\\$|MX\\$|Rs\\.?|RM|Rp|kr\\.?|zł|Kč|Ft|lei|CHF|[$€£¥￥₹₩₽₺₪₫₱₦฿]';
const CODE_ALT = ISO_CODES.join('|');
const NUM = "\\d{1,3}(?:[.,'\\u00a0\\u202f ]\\d{2,3})*(?:[.,]\\d{1,2})?|\\d+(?:[.,]\\d{1,2})?";

const PREFIX_RE = new RegExp(`(?<![\\w%])(${CODE_ALT}|${SYMBOL_ALT})\\s?(${NUM})(?![\\d%])`, 'iu');
const SUFFIX_RE = new RegExp(`(?<![\\w.,-])(${NUM})\\s?(${CODE_ALT}|${SYMBOL_ALT})(?![\\w])`, 'iu');

const resolveCurrency = (token: string, hints: CurrencyHints): string | null => {
  const upper = token.toUpperCase();
  if ((ISO_CODES as readonly string[]).includes(upper)) {
    return upper;
  }
  return symbolToCurrency(token, hints);
};

const applyMetaOverride = (currency: string, token: string, hints: CurrencyHints): string => {
  const meta = hints.metaCurrency?.toUpperCase();
  const tokenIsIso = (ISO_CODES as readonly string[]).includes(token.toUpperCase());
  if (meta && /^[A-Z]{3}$/.test(meta) && !tokenIsIso) return meta;
  return currency;
};

/** Extract the first money amount (with currency) from a text fragment. */
export const parseAmount = (text: string, hints: CurrencyHints = {}): ParsedAmount | null => {
  const prefix = PREFIX_RE.exec(text);
  const suffix = SUFFIX_RE.exec(text);

  const pick = (() => {
    if (prefix && suffix) return prefix.index <= suffix.index ? { m: prefix, order: 'prefix' } : { m: suffix, order: 'suffix' };
    if (prefix) return { m: prefix, order: 'prefix' };
    if (suffix) return { m: suffix, order: 'suffix' };
    return null;
  })();
  if (!pick) return null;

  const [, a, b] = pick.m;
  const token = (pick.order === 'prefix' ? a : b) ?? '';
  const numberText = (pick.order === 'prefix' ? b : a) ?? '';

  const currency = resolveCurrency(token, hints);
  const amount = normalizeNumber(numberText);
  if (!currency || amount === null) return null;

  const finalCurrency = applyMetaOverride(currency, token, hints);
  const rounded = ZERO_DECIMAL.has(finalCurrency) ? Math.round(amount) : Math.round(amount * 100) / 100;
  return { amount: rounded, currency: finalCurrency };
};

export const isZeroDecimalCurrency = (code: string): boolean => ZERO_DECIMAL.has(code.toUpperCase());
