import { beforeEach, describe, expect, it } from 'vitest';
import { parseJsonLdOrders, parseStructuredEvent } from '../../src/detect/structured';

describe('parseStructuredEvent', () => {
  it('parses a GA4 purchase event', () => {
    expect(
      parseStructuredEvent({ kind: 'datalayer', payload: { event: 'purchase', ecommerce: { transaction_id: 'T-100', value: 42.5, currency: 'USD' } } }),
    ).toEqual({ source: 'datalayer', orderId: 'T-100', amount: 42.5, currency: 'USD' });
  });

  it('parses a legacy Universal Analytics purchase', () => {
    expect(
      parseStructuredEvent({
        kind: 'datalayer',
        payload: { event: 'eec.purchase', ecommerce: { currencyCode: 'EUR', purchase: { actionField: { id: 'UA-7', revenue: '19.99' } } } },
      }),
    ).toEqual({ source: 'datalayer', orderId: 'UA-7', amount: 19.99, currency: 'EUR' });
  });

  it('parses a gtag arguments array', () => {
    expect(parseStructuredEvent({ kind: 'datalayer', payload: ['event', 'purchase', { transaction_id: 'G-1', value: '10', currency: 'gbp' }] })).toEqual({
      source: 'datalayer',
      orderId: 'G-1',
      amount: 10,
      currency: 'GBP',
    });
  });

  it('parses an fbq Purchase', () => {
    expect(parseStructuredEvent({ kind: 'fbq', payload: ['track', 'Purchase', { value: 99, currency: 'USD', order_id: 'FB-9' }] })).toEqual({
      source: 'fbq',
      orderId: 'FB-9',
      amount: 99,
      currency: 'USD',
    });
    expect(parseStructuredEvent({ kind: 'fbq', payload: ['track', 'Purchase', { value: 99, currency: 'USD' }] })).toEqual({ source: 'fbq', amount: 99, currency: 'USD' });
  });

  it('parses a Shopify checkout object', () => {
    expect(parseStructuredEvent({ kind: 'shopify', payload: { order_id: 5551, order_number: 1234, total_price: '56.00', currency: 'CAD' } })).toEqual({
      source: 'shopify',
      orderId: '1234',
      amount: 56,
      currency: 'CAD',
    });
  });

  it('parses a JSON-LD Order with a string price', () => {
    expect(parseStructuredEvent({ kind: 'jsonld', payload: { '@type': 'Order', orderNumber: 'JL-1', price: '12.50', priceCurrency: 'USD' } })).toEqual({
      source: 'jsonld',
      orderId: 'JL-1',
      amount: 12.5,
      currency: 'USD',
    });
    expect(
      parseStructuredEvent({ kind: 'jsonld', payload: { '@type': 'Order', orderNumber: 'JL-2', totalPaymentDue: { price: 7, priceCurrency: 'EUR' } } }),
    ).toEqual({ source: 'jsonld', orderId: 'JL-2', amount: 7, currency: 'EUR' });
  });

  it('returns null for invalid input', () => {
    expect(parseStructuredEvent(null)).toBeNull();
    expect(parseStructuredEvent({ kind: 'datalayer', payload: { event: 'add_to_cart', ecommerce: { value: 5, currency: 'USD' } } })).toBeNull();
    expect(parseStructuredEvent({ kind: 'fbq', payload: ['track', 'PageView'] })).toBeNull();
    expect(parseStructuredEvent({ kind: 'jsonld', payload: { '@type': 'Product', price: '1' } })).toBeNull();
    expect(parseStructuredEvent({ kind: 'nope', payload: {} })).toBeNull();
  });
});

describe('parseJsonLdOrders', () => {
  beforeEach(() => {
    document.head.innerHTML = '';
    document.body.innerHTML = '';
  });

  it('scans ld+json scripts including arrays and @graph', () => {
    document.head.innerHTML = `
      <script type="application/ld+json">{"@context":"https://schema.org","@graph":[{"@type":"WebSite"},{"@type":"Order","orderNumber":"A1","price":"20.00","priceCurrency":"USD"}]}</script>
      <script type="application/ld+json">[{"@type":"Order","orderNumber":"B2","totalPaymentDue":{"price":30,"priceCurrency":"EUR"}}]</script>
      <script type="application/ld+json">not json</script>`;
    const found = parseJsonLdOrders(document);
    expect(found).toHaveLength(2);
    expect(found[0]?.orderId).toBe('A1');
    expect(found[1]?.amount).toBe(30);
  });
});
