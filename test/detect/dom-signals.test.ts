import { beforeEach, describe, expect, it } from 'vitest';
import { scanDom } from '../../src/detect/dom-signals';

const setPage = (title: string, html: string): Document => {
  document.title = title;
  document.body.innerHTML = html;
  return document;
};

describe('scanDom', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    document.title = '';
  });

  it('reads an Amazon-like thank-you page', () => {
    const doc = setPage(
      'Amazon.com Thanks',
      `<h1>Order placed, thanks!</h1>
       <p>Confirmation will be sent to your email.</p>
       <a href="/gp/your-account/order-details?orderID=112-3456789-0123456">Order number 112-3456789-0123456</a>
       <div><span>Grand Total:</span><span>$123.45</span></div>`,
    );
    const s = scanDom(doc);
    expect(s.headlineHit).toBe(true);
    expect(s.orderIdText).toContain('112-3456789-0123456');
    expect(s.totalText).toContain('123.45');
    expect(s.negative).toBe(false);
    expect(s.title).toBe('Amazon.com Thanks');
    expect(s.bodyExcerpt).toContain('Order placed');
  });

  it('reads a Shopify-like thank-you page', () => {
    const doc = setPage(
      'Thank you',
      `<h2 class="os-header__title">Thank you, Jane!</h2>
       <span class="os-order-number">Order #1234</span>
       <table><tr><td>Subtotal</td><td>$50.00</td></tr><tr><td>Total</td><td>$56.00</td></tr></table>`,
    );
    const s = scanDom(doc);
    expect(s.headlineHit).toBe(true);
    expect(s.totalText).toContain('56.00');
    expect(s.negative).toBe(false);
  });

  it('reads a WooCommerce-like order-received page', () => {
    const doc = setPage(
      'Checkout',
      `<h1>Thank you. Your order has been received.</h1>
       <ul><li>Order number: <strong>5678</strong></li><li>Total: <span>€45,00</span></li></ul>`,
    );
    const s = scanDom(doc);
    expect(s.headlineHit).toBe(true);
    expect(s.orderIdText).toContain('5678');
    expect(s.totalText).toContain('45,00');
  });

  it('prefers the grand total over other totals', () => {
    const doc = setPage(
      'Receipt',
      `<div><p>Shipping total</p><p>$5.00</p></div>
       <table><tr><th>Order total</th><td>$20.00</td></tr><tr><th>Grand total</th><td>$25.00</td></tr></table>`,
    );
    expect(scanDom(doc).totalText).toContain('25.00');
  });

  it('flags a cart page with a place-order button as negative', () => {
    const doc = setPage('Cart', `<h1>Your cart</h1><button>Place your order</button><p>Total: $10.00</p>`);
    const s = scanDom(doc);
    expect(s.negative).toBe(true);
    expect(s.headlineHit).toBe(false);
  });

  it('flags a checkout page with card inputs as negative', () => {
    const doc = setPage('Checkout', `<form><input autocomplete="cc-number" /><input name="cvv" /></form>`);
    expect(scanDom(doc).negative).toBe(true);
  });

  it('falls back to body text for totals', () => {
    const doc = setPage('Done', `<p>Thanks for your purchase.</p><p>Your total was 1.234,56 € today.</p>`);
    expect(scanDom(doc).totalText).toContain('1.234,56');
  });
});
