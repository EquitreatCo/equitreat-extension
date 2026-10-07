import { describe, expect, it } from 'vitest';
import { MERCHANTS, findMerchant, merchantMatchPatterns, normalizeHost, type Merchant } from '../../src/shared/index.js';

const listed = (domain: string, extra: Partial<Merchant> = {}): Merchant => ({
  domain,
  name: domain,
  region: 'Test',
  kind: 'retailer',
  rule: null,
  note: null,
  enabled: true,
  ...extra,
});

describe('merchant list (generated from MERCHANT_ALLOWLIST.md)', () => {
  it('has unique, lowercase domains without www', () => {
    const domains = MERCHANTS.map((m) => m.domain);
    expect(new Set(domains).size).toBe(domains.length);
    for (const d of domains) {
      expect(d).toMatch(/^[a-z0-9.-]+$/);
      expect(d.startsWith('www.')).toBe(false);
    }
  });

  it('enables retailers and marketplaces and keeps subscriptions off until they have a detector', () => {
    expect(MERCHANTS.filter((m) => m.kind === 'subscription').every((m) => !m.enabled)).toBe(true);
    expect(MERCHANTS.filter((m) => m.kind !== 'subscription').every((m) => m.enabled)).toBe(true);
    expect(MERCHANTS.filter((m) => m.kind === 'retailer').length).toBeGreaterThan(150);
  });

  it('gives every marketplace its condition and no retailer a condition', () => {
    const rule = (d: string) => MERCHANTS.find((m) => m.domain === d)?.rule;
    expect(rule('amazon.com')).toBe('first_party_only');
    expect(rule('amazon.co.uk')).toBe('first_party_only');
    expect(rule('amazon.de')).toBe('first_party_only');
    expect(rule('walmart.com')).toBe('first_party_only');
    expect(rule('decathlon.com')).toBe('own_brands_only');
    expect(rule('temu.com')).toBe('base_rate_only');
    expect(rule('aliexpress.com')).toBe('base_rate_only');
    expect(MERCHANTS.filter((m) => m.kind === 'retailer').every((m) => m.rule === null)).toBe(true);
  });

  it('leaves out the stores the allowlist excludes', () => {
    for (const d of ['ebay.com', 'etsy.com', 'shein.com', 'newegg.com', 'flipkart.com', 'myshopify.com', 'zalando.de']) {
      expect(findMerchant(d)).toBeNull();
    }
  });
});

describe('findMerchant', () => {
  it('matches the bare domain, www, a port and any subdomain', () => {
    expect(findMerchant('target.com')?.domain).toBe('target.com');
    expect(findMerchant('www.target.com')?.domain).toBe('target.com');
    expect(findMerchant('WWW.Target.COM:443')?.domain).toBe('target.com');
    expect(findMerchant('secure.store.apple.com')?.domain).toBe('apple.com');
    expect(findMerchant('www.johnlewis.com')?.name).toBe('John Lewis');
  });

  it('prefers the longest listed domain', () => {
    expect(findMerchant('oldnavy.gap.com')?.name).toBe('Old Navy');
    expect(findMerchant('www.gap.com')?.name).toBe('Gap');
  });

  it('does not stretch a listed subdomain to its parent', () => {
    const list = [listed('gemini.google.com')];
    expect(findMerchant('google.com', list)).toBeNull();
    expect(findMerchant('mail.google.com', list)).toBeNull();
    expect(findMerchant('eu.gemini.google.com', list)?.domain).toBe('gemini.google.com');
  });

  it('rejects look-alike hosts', () => {
    for (const host of ['target.com.evil.io', 'nottarget.com', 'evil-target.com', 'target.co', 'targetcom']) {
      expect(findMerchant(host)).toBeNull();
    }
  });

  it('ignores disabled merchants', () => {
    expect(findMerchant('claude.ai')).toBeNull();
    expect(findMerchant('chatgpt.com')).toBeNull();
    expect(findMerchant('shop.example', [listed('shop.example', { enabled: false })])).toBeNull();
  });

  it('returns null for empty input', () => {
    expect(findMerchant('')).toBeNull();
    expect(findMerchant('   ')).toBeNull();
  });
});

describe('normalizeHost', () => {
  it('lowercases and strips www, port and a trailing dot', () => {
    expect(normalizeHost(' WWW.Zara.com.:8080 ')).toBe('zara.com');
  });
});

describe('merchantMatchPatterns', () => {
  it('has one Chrome match pattern per enabled merchant and none for disabled ones', () => {
    const patterns = merchantMatchPatterns();
    expect(patterns).toHaveLength(MERCHANTS.filter((m) => m.enabled).length);
    expect(patterns).toContain('*://*.target.com/*');
    expect(patterns).toContain('*://*.e.leclerc/*');
    expect(patterns.some((p) => p.includes('claude.ai'))).toBe(false);
  });
});
