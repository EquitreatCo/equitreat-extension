import { beforeEach, describe, expect, it } from 'vitest';
import { HASHED_ORDER_ID_PREFIX } from '../../src/shared/index.js';
import { scanDom, type DomSignals } from '../../src/detect/dom-signals';
import { hintsFromDocument, redactPath, scoreCandidate } from '../../src/detect/score';
import type { StructuredSignal } from '../../src/detect/structured';

const NOW = new Date('2026-09-09T12:00:00.000Z');

const dom = (overrides: Partial<DomSignals> = {}): DomSignals => ({
  headlineHit: false,
  orderIdText: null,
  totalText: null,
  negative: false,
  title: '',
  bodyExcerpt: '',
  ...overrides,
});

describe('scoreCandidate', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    document.head.innerHTML = '';
  });

  it('accepts url + headline + total with a dom amount', () => {
    const c = scoreCandidate({
      url: 'https://shop.example.com/checkouts/cn/abc/thank-you?x=1#top',
      dom: dom({ headlineHit: true, totalText: 'Total $56.00', orderIdText: 'Order #1234', bodyExcerpt: 'Thank you Order #1234' }),
      structured: [],
      hints: {},
      now: NOW,
    });
    expect(c).not.toBeNull();
    expect(c?.confidence).toBeGreaterThanOrEqual(60);
    expect(c?.amount).toBe(56);
    expect(c?.currency).toBe('USD');
    expect(c?.orderId).toBe('1234');
    expect(c?.merchantDomain).toBe('shop.example.com');
    expect(c?.pageUrl).toBe('https://shop.example.com/checkouts/cn/abc/thank-you');
    expect(c?.detectionMethod).toBe('url');
    expect(c?.detectedAt).toBe(NOW.toISOString());
  });

  it('ignores a lone page event: any script on the page could have sent it', () => {
    const structured: StructuredSignal[] = [{ source: 'datalayer', orderId: 'T-100', amount: 42.5, currency: 'EUR' }];
    expect(scoreCandidate({ url: 'https://www.example.com/some/page', dom: dom(), structured, hints: {}, now: NOW })).toBeNull();
  });

  it('uses structured data from a datalayer once the page agrees', () => {
    const structured: StructuredSignal[] = [{ source: 'datalayer', orderId: 'T-100', amount: 42.5, currency: 'EUR' }];
    const c = scoreCandidate({ url: 'https://www.example.com/some/page', dom: dom({ headlineHit: true }), structured, hints: {}, now: NOW });
    expect(c?.orderId).toBe('T-100');
    expect(c?.amount).toBe(42.5);
    expect(c?.currency).toBe('EUR');
    expect(c?.detectionMethod).toBe('mixed');
    expect(c?.merchantDomain).toBe('example.com');
    expect(c?.confidence).toBe(70);
  });

  it('stores the page path with ids and tokens replaced, and no page text', () => {
    const c = scoreCandidate({
      url: 'https://shop.example.com/checkouts/cn/Z2NwLXVzLWVhc3QxOjAxSjc5/thank-you?email=a@b.c#top',
      dom: dom({ headlineHit: true, totalText: 'Total $56.00', orderIdText: 'Order #1234', bodyExcerpt: 'Thank you Order #1234' }),
      structured: [],
      hints: {},
      now: NOW,
    });
    expect(c?.pageUrl).toBe('https://shop.example.com/checkouts/cn/:id/thank-you');
    expect(c?.rawSignals).not.toHaveProperty('totalText');
  });

  it('redacts ids, tokens and emails in paths', () => {
    expect(redactPath('/orders/12345678/confirmation')).toBe('/orders/:id/confirmation');
    expect(redactPath('/account/jane@example.com/orders')).toBe('/account/:redacted/orders');
    expect(redactPath('/account/jane%40example.com')).toBe('/account/:redacted');
    expect(redactPath(`/t/${'a'.repeat(40)}`)).toBe('/t/:id');
    expect(redactPath('/thank-you')).toBe('/thank-you');
    expect(redactPath('/v2/checkout/success')).toBe('/v2/checkout/success');
    expect(redactPath('/checkout/order-received/5521/')).toBe('/checkout/order-received/:id/');
    expect(redactPath('/shop/123/cart')).toBe('/shop/123/cart');
    expect(redactPath('/')).toBe('/');
    expect(redactPath('/step/123')).toBe('/step/123');
  });

  it('rejects a cart page with negative signals', () => {
    const c = scoreCandidate({
      url: 'https://example.com/thank-you',
      dom: dom({ headlineHit: true, totalText: 'Total $10.00', negative: true }),
      structured: [],
      hints: {},
      now: NOW,
    });
    expect(c).toBeNull();
  });

  it('rejects when no amount is available', () => {
    const c = scoreCandidate({
      url: 'https://www.amazon.com/gp/buy/thankyou',
      dom: dom({ headlineHit: true, orderIdText: 'Order number 112-3456789-0123456' }),
      structured: [],
      hints: {},
      now: NOW,
    });
    expect(c).toBeNull();
  });

  it('derives a stable hashed order id when none is visible', () => {
    const input = {
      url: 'https://example.com/order-confirmation',
      dom: dom({ headlineHit: true, totalText: 'Grand total £30.00' }),
      structured: [],
      hints: {},
      now: NOW,
    };
    const a = scoreCandidate(input);
    const b = scoreCandidate(input);
    expect(a?.orderId.startsWith(HASHED_ORDER_ID_PREFIX)).toBe(true);
    expect(a?.orderId).toMatch(/^h_[0-9a-f]{8}$/);
    expect(a?.orderId).toBe(b?.orderId);
    expect(a?.currency).toBe('GBP');
  });

  it('lets fbq amount win over a dom total', () => {
    const c = scoreCandidate({
      url: 'https://example.com/thank-you',
      dom: dom({ headlineHit: true, totalText: 'Total $99.99' }),
      structured: [{ source: 'fbq', amount: 80, currency: 'USD' }],
      hints: {},
      now: NOW,
    });
    expect(c?.amount).toBe(80);
    expect(c?.detectionMethod).toBe('mixed');
    expect(c?.rawSignals['sources']).toEqual(['fbq']);
  });

  it('rejects dom-only pages (max 55) and applies tld currency hints', () => {
    const domOnly = scoreCandidate({
      url: 'https://example.com/page',
      dom: dom({ headlineHit: true, totalText: 'Order total $12.00', orderIdText: 'Order number: XY-99887' }),
      structured: [],
      hints: { tld: 'ca' },
      now: NOW,
    });
    expect(domOnly).toBeNull(); // 20 + 15 + 20 = 55 < 60
    const withUrl = scoreCandidate({
      url: 'https://example.ca/checkout/order-received/7781/',
      dom: dom({ headlineHit: true, totalText: 'Order total $12.00', orderIdText: 'Order number: XY-99887' }),
      structured: [],
      hints: { tld: 'ca' },
      now: NOW,
    });
    expect(withUrl?.currency).toBe('CAD');
    expect(withUrl?.confidence).toBe(95);
  });

  it('counts each structured source once and clamps confidence', () => {
    const c = scoreCandidate({
      url: 'https://shop.example.com/checkouts/cn/abc/thank-you',
      dom: dom({ headlineHit: true, totalText: 'Total $5.00' }),
      structured: [
        { source: 'datalayer', amount: 5, currency: 'USD', orderId: '1' },
        { source: 'datalayer', amount: 5, currency: 'USD', orderId: '1' },
        { source: 'jsonld', amount: 5, currency: 'USD' },
      ],
      hints: {},
      now: NOW,
    });
    expect(c?.confidence).toBe(100);
    expect(c?.rawSignals['sources']).toEqual(['datalayer', 'jsonld']);
  });

  it('works end to end from a scanned document', () => {
    document.title = 'Thanks';
    document.body.innerHTML = `<h1>Thank you for your order</h1><p>Order number: WX-55555</p><table><tr><td>Grand total</td><td>$77.10</td></tr></table>`;
    const c = scoreCandidate({ url: 'https://example.com/checkout/order-received/5555/', dom: scanDom(document), structured: [], hints: {}, now: NOW });
    expect(c?.amount).toBe(77.1);
    expect(c?.orderId).toBe('WX-55555');
    expect(c?.confidence).toBe(95);
  });
});

describe('hintsFromDocument', () => {
  it('extracts tld, lang and meta currency', () => {
    document.documentElement.setAttribute('lang', 'en-GB');
    document.head.innerHTML = `<meta property="og:price:currency" content="GBP">`;
    expect(hintsFromDocument(document, 'https://www.shop.co.uk/thank-you')).toEqual({ tld: 'co.uk', lang: 'en-GB', metaCurrency: 'GBP' });
    document.head.innerHTML = '';
    document.documentElement.removeAttribute('lang');
    expect(hintsFromDocument(document, 'https://shop.example.ca/x')).toEqual({ tld: 'ca' });
  });
});
