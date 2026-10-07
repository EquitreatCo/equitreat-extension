export type Platform =
  | 'amazon'
  | 'shopify'
  | 'woocommerce'
  | 'magento'
  | 'walmart'
  | 'bigcommerce'
  | 'prestashop'
  | 'flipkart'
  | 'ebay'
  | 'generic';

export interface UrlMatch {
  readonly platform: Platform;
  readonly score: number;
}

interface UrlParts {
  readonly host: string;
  readonly path: string;
}

type Rule = (parts: UrlParts) => UrlMatch | null;

const AMAZON_HOST_RE = /(^|\.)amazon\.[a-z.]+$/;
const SHOPIFY_RE = /\/checkouts\/(cn\/)?[^/]+\/thank[-_]you/;
const GENERIC_RE =
  /(thank[-_]?you|order[-_]?(received|confirm(ed|ation)|complete[d]?|success)|checkout\/(success|complete|confirmation)|purchase[-_]?(complete|confirmation)|receipt)/i;
const NEGATIVE_RE = /\/(cart|basket|checkout\/payment|login)(\/|$|\?)/;

const rule = (platform: Platform, score: number, test: (p: UrlParts) => boolean): Rule => (parts) =>
  test(parts) ? { platform, score } : null;

/** Platform-specific rules; earlier entries win. Strong rules are immune to negative paths. */
const STRONG_RULES: readonly Rule[] = [
  rule('amazon', 40, ({ host, path }) =>
    AMAZON_HOST_RE.test(host) && (path.includes('/gp/buy/thankyou') || (path.includes('/checkout/') && path.includes('thankyou'))),
  ),
  rule('shopify', 40, ({ path }) => SHOPIFY_RE.test(path)),
  rule('woocommerce', 40, ({ path }) => path.includes('/checkout/order-received/')),
  rule('magento', 40, ({ path }) => path.includes('/checkout/onepage/success')),
  rule('walmart', 40, ({ host, path }) => /(^|\.)walmart\.com$/.test(host) && (path.includes('/checkout/thankyou') || path.includes('/thankyou'))),
  rule('bigcommerce', 35, ({ path }) => path.includes('/checkout/order-confirmation')),
  rule('prestashop', 30, ({ path }) => path.includes('/order-confirmation')),
  rule('flipkart', 30, ({ host, path }) =>
    /(^|\.)flipkart\.com$/.test(host) && ((path.includes('/checkout/') && path.includes('orderconfirm')) || path.includes('/order-confirmation')),
  ),
];

const GENERIC_RULE: Rule = rule('generic', 30, ({ path }) => GENERIC_RE.test(path));

const parseUrl = (url: string): UrlParts | null => {
  try {
    const u = new URL(url);
    return { host: u.hostname.toLowerCase(), path: u.pathname.toLowerCase() };
  } catch {
    return null;
  }
};

const firstMatch = (rules: readonly Rule[], parts: UrlParts): UrlMatch | null =>
  rules.reduce<UrlMatch | null>((found, r) => found ?? r(parts), null);

/** Classify a URL as an order-confirmation page, or null. */
export const matchConfirmationUrl = (url: string): UrlMatch | null => {
  const parts = parseUrl(url);
  if (!parts) return null;
  const strong = firstMatch(STRONG_RULES, parts);
  if (strong) return strong;
  if (NEGATIVE_RE.test(parts.path)) return null;
  return GENERIC_RULE(parts);
};
