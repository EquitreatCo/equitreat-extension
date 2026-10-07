export const formatMoney = (amount: number, currency: string, maximumFractionDigits = 2): string => {
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency, maximumFractionDigits }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currency}`;
  }
};

export const formatDate = (iso: string): string => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
};

/** Base58 keys have no 0x prefix, so more of the front is kept than an Ethereum address needed. */
export const shortAddress = (addr: string): string => (addr.length > 14 ? `${addr.slice(0, 5)}…${addr.slice(-5)}` : addr);

const BPS_PER_UNIT = 10_000;

/** Holder multiplier from basis points: 12500 -> "1.25×". */
export const formatMultiplier = (bps: number): string => `${(bps / BPS_PER_UNIT).toFixed(2)}×`;

/** Whole project tokens with grouping: 25000 -> "25,000". */
export const formatTokens = (tokens: number): string => Math.floor(tokens).toLocaleString('en-US');

/** Two-letter avatar text from a merchant domain: "amazon.com" -> "AM". */
export const merchantInitials = (domain: string): string => {
  const label = domain.replace(/^www\./, '').split('.')[0] ?? domain;
  return label.slice(0, 2).toUpperCase();
};

const AVATAR_HUES = [62, 150, 200, 30, 280, 330, 100, 240];

/** Stable pastel background per merchant, derived from the domain. */
export const merchantHue = (domain: string): number => {
  let h = 0;
  for (const ch of domain) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return AVATAR_HUES[h % AVATAR_HUES.length] ?? 62;
};

const NEW_WINDOW_MS = 15 * 60 * 1000;

export const isRecent = (iso: string, now = Date.now()): boolean => {
  const t = new Date(iso).getTime();
  return !Number.isNaN(t) && now - t < NEW_WINDOW_MS;
};
