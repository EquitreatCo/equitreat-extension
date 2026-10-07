/**
 * The stores equitreat records orders from. The list is generated from MERCHANT_ALLOWLIST.md by
 * scripts/sync-merchants.mjs. The database holds the same list in public.merchants and drops orders
 * from anywhere else, so in the extension this only decides where the content scripts run.
 */
import { MERCHANTS, type Merchant } from './merchants.generated.js';

export { MERCHANTS };
export type { Merchant, MerchantKind, MerchantRule } from './merchants.generated.js';

/** Hostname as the database stores it: lowercase, no port, no trailing dot, no leading www. */
export const normalizeHost = (host: string): string =>
  host.trim().toLowerCase().replace(/:\d+$/, '').replace(/\.$/, '').replace(/^www\./, '');

/**
 * The enabled merchant whose domain is the host or a parent of it. The longest match wins, so
 * oldnavy.gap.com resolves to Old Navy rather than Gap. Look-alikes such as target.com.evil.io do not match.
 */
export const findMerchant = (host: string, list: readonly Merchant[] = MERCHANTS): Merchant | null => {
  const h = normalizeHost(host);
  if (!h) return null;
  return list.reduce<Merchant | null>((best, m) => {
    if (!m.enabled || (h !== m.domain && !h.endsWith(`.${m.domain}`))) return best;
    return !best || m.domain.length > best.domain.length ? m : best;
  }, null);
};

export const enabledMerchants = (list: readonly Merchant[] = MERCHANTS): readonly Merchant[] => list.filter((m) => m.enabled);

/** Chrome match patterns for the content scripts. `*.domain` matches the bare domain and every subdomain. */
export const merchantMatchPatterns = (list: readonly Merchant[] = MERCHANTS): string[] => enabledMerchants(list).map((m) => `*://*.${m.domain}/*`);
