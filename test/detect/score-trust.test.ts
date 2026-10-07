import { describe, expect, it } from 'vitest';
import type { DomSignals } from '../../src/detect/dom-signals';
import { scoreCandidate, type ScoreInput } from '../../src/detect/score';
import type { StructuredSignal } from '../../src/detect/structured';

const DAY_1 = new Date('2026-09-09T12:00:00.000Z');
const DAY_2 = new Date('2026-09-10T09:30:00.000Z');

const dom = (overrides: Partial<DomSignals> = {}): DomSignals => ({
  headlineHit: false,
  orderIdText: null,
  totalText: null,
  negative: false,
  title: '',
  bodyExcerpt: '',
  ...overrides,
});

/** Everything a page can show in text: headline, order number and total. */
const fullDom = dom({ headlineHit: true, totalText: 'Order total $56.00', orderIdText: 'Order #1234', bodyExcerpt: 'Thank you Order #1234' });

const input = (url: string, overrides: Partial<ScoreInput> = {}): ScoreInput => ({ url, dom: fullDom, structured: [], hints: {}, now: DAY_1, ...overrides });

const datalayer: StructuredSignal[] = [{ source: 'datalayer', orderId: 'T-100', amount: 56, currency: 'USD' }];

describe('generic confirmation URLs need a structured purchase signal', () => {
  it.each([
    'https://shop.example.com/thank-you',
    'https://shop.example.com/order-received',
    'https://shop.example.com/account/orders/1234/receipt',
    'https://shop.example.com/purchase-complete',
  ])('ignores page text alone on %s', (url) => {
    expect(scoreCandidate(input(url))).toBeNull();
  });

  it('accepts a generic thank-you page when the store also fires a purchase event', () => {
    const c = scoreCandidate(input('https://shop.example.com/thank-you', { structured: datalayer }));
    expect(c?.orderId).toBe('T-100');
    expect(c?.amount).toBe(56);
  });

  it('still accepts page text on a known platform confirmation URL', () => {
    const c = scoreCandidate(input('https://shop.example.com/checkout/order-received/5521/'));
    expect(c).not.toBeNull();
    expect(c?.orderId).toBe('1234');
  });

  it('still accepts a known platform confirmation URL with only a total', () => {
    const c = scoreCandidate(input('https://www.amazon.com/gp/buy/thankyou/handlers/display.html', { dom: dom({ totalText: 'Order total: $19.99' }) }));
    expect(c?.amount).toBe(19.99);
  });
});

describe('orders without a visible order number', () => {
  const noNumber = dom({ headlineHit: true, totalText: 'Grand total £30.00' });
  const shopify = 'https://shop.example.com/checkouts/cn/Z2NwLWV1cm9wZS13ZXN0NDox/thank-you';

  it('keep the same id when the page is revisited on a later day', () => {
    const first = scoreCandidate(input(shopify, { dom: noNumber, now: DAY_1 }));
    const revisit = scoreCandidate(input(shopify, { dom: noNumber, now: DAY_2 }));
    expect(first?.orderId).toMatch(/^h_[0-9a-f]{8}$/);
    expect(revisit?.orderId).toBe(first?.orderId);
  });

  it('get different ids for different confirmation pages with the same total', () => {
    const a = scoreCandidate(input(shopify, { dom: noNumber }));
    const b = scoreCandidate(input('https://shop.example.com/checkouts/cn/QmFzZTY0T3RoZXJPcmRlcg/thank-you', { dom: noNumber }));
    expect(a?.orderId).not.toBe(b?.orderId);
  });

  it('keep one id per day on a confirmation path with no order token, so repeat purchases on later days are kept', () => {
    const magento = 'https://shop.example.com/checkout/onepage/success';
    const morning = scoreCandidate(input(magento, { dom: noNumber, now: DAY_1 }));
    const evening = scoreCandidate(input(magento, { dom: noNumber, now: new Date('2026-09-09T20:00:00.000Z') }));
    const nextDay = scoreCandidate(input(magento, { dom: noNumber, now: DAY_2 }));
    expect(morning?.orderId).toMatch(/^h_[0-9a-f]{8}$/);
    expect(evening?.orderId).toBe(morning?.orderId);
    expect(nextDay?.orderId).not.toBe(morning?.orderId);
  });

  it('treat a numeric order id in the path as an order token', () => {
    const woo = 'https://shop.example.com/checkout/order-received/5521/';
    const first = scoreCandidate(input(woo, { dom: noNumber, now: DAY_1 }));
    const revisit = scoreCandidate(input(woo, { dom: noNumber, now: DAY_2 }));
    expect(revisit?.orderId).toBe(first?.orderId);
  });

  it('ignore the query string and fragment when building the id', () => {
    const a = scoreCandidate(input(shopify, { dom: noNumber }));
    const b = scoreCandidate(input(`${shopify}?utm_source=email#summary`, { dom: noNumber }));
    expect(b?.orderId).toBe(a?.orderId);
  });
});
