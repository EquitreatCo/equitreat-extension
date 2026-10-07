import { describe, expect, it } from 'vitest';
import { matchConfirmationUrl } from '../../src/detect/url-rules';

describe('matchConfirmationUrl', () => {
  it('matches Amazon thank-you pages', () => {
    expect(matchConfirmationUrl('https://www.amazon.com/gp/buy/thankyou/handlers/display.html?purchaseId=123')).toEqual({ platform: 'amazon', score: 40 });
    expect(matchConfirmationUrl('https://www.amazon.co.uk/checkout/p/p-123/thankyou')).toEqual({ platform: 'amazon', score: 40 });
  });

  it('matches Shopify thank-you pages', () => {
    expect(matchConfirmationUrl('https://shop.example.com/checkouts/cn/abc123/thank-you')).toEqual({ platform: 'shopify', score: 40 });
    expect(matchConfirmationUrl('https://shop.example.com/checkouts/abc123/thank_you')?.platform).toBe('shopify');
  });

  it('matches WooCommerce order-received pages', () => {
    expect(matchConfirmationUrl('https://store.example.com/checkout/order-received/5678/?key=wc_order_abc')).toEqual({ platform: 'woocommerce', score: 40 });
  });

  it('matches Magento success pages', () => {
    expect(matchConfirmationUrl('https://store.example.com/checkout/onepage/success/')).toEqual({ platform: 'magento', score: 40 });
  });

  it('matches Walmart thank-you pages', () => {
    expect(matchConfirmationUrl('https://www.walmart.com/checkout/thankyou')).toEqual({ platform: 'walmart', score: 40 });
  });

  it('matches BigCommerce, PrestaShop and Flipkart', () => {
    expect(matchConfirmationUrl('https://store.example.com/checkout/order-confirmation')).toEqual({ platform: 'bigcommerce', score: 35 });
    expect(matchConfirmationUrl('https://store.example.com/order-confirmation?id_order=9')).toEqual({ platform: 'prestashop', score: 30 });
    expect(matchConfirmationUrl('https://www.flipkart.com/checkout/orderconfirm')).toEqual({ platform: 'flipkart', score: 30 });
  });

  it('matches generic confirmation paths', () => {
    expect(matchConfirmationUrl('https://example.com/thank-you')).toEqual({ platform: 'generic', score: 30 });
    expect(matchConfirmationUrl('https://example.com/orders/receipt')).toEqual({ platform: 'generic', score: 30 });
    expect(matchConfirmationUrl('https://example.com/purchase-complete')?.platform).toBe('generic');
  });

  it('returns null for cart, payment, login and product pages', () => {
    expect(matchConfirmationUrl('https://example.com/cart')).toBeNull();
    expect(matchConfirmationUrl('https://example.com/basket/thank-you-later')).toBeNull();
    expect(matchConfirmationUrl('https://example.com/checkout/payment')).toBeNull();
    expect(matchConfirmationUrl('https://example.com/login?next=/thank-you')).toBeNull();
    expect(matchConfirmationUrl('https://example.com/products/blue-widget')).toBeNull();
    expect(matchConfirmationUrl('not a url')).toBeNull();
  });

  it('lets a strong platform match override a negative path', () => {
    expect(matchConfirmationUrl('https://www.amazon.com/checkout/cart/thankyou')?.platform).toBe('amazon');
  });
});
