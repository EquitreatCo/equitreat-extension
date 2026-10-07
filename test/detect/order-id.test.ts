import { describe, expect, it } from 'vitest';
import { findOrderId } from '../../src/detect/order-id';

describe('findOrderId', () => {
  it('finds an Amazon order id inside text', () => {
    expect(findOrderId('Order placed, thanks! Order number 112-3456789-0123456 will ship soon', 'amazon')).toBe('112-3456789-0123456');
    expect(findOrderId('Your order 112-3456789-0123456', null)).toBe('112-3456789-0123456');
  });

  it('finds a Flipkart OD id', () => {
    expect(findOrderId('Order ID OD123456789012345678 confirmed', 'flipkart')).toBe('OD123456789012345678');
  });

  it('finds a generic labelled id', () => {
    expect(findOrderId('Order number: ABC-12345', 'generic')).toBe('ABC-12345');
    expect(findOrderId('Confirmation # 7Y8Z9K12', null)).toBe('7Y8Z9K12');
    expect(findOrderId('order id ab12cd34', null)).toBe('ab12cd34');
  });

  it('finds Shopify/WooCommerce hash ids', () => {
    expect(findOrderId('Thank you, Jane! Order #1001', 'shopify')).toBe('1001');
    expect(findOrderId('Order #5678 has been received', 'woocommerce')).toBe('5678');
  });

  it('returns null for label-only or word tokens', () => {
    expect(findOrderId('Order number', 'generic')).toBeNull();
    expect(findOrderId('Order number: CONFIRMED', 'generic')).toBeNull();
    expect(findOrderId('Order details will follow', null)).toBeNull();
    expect(findOrderId('', null)).toBeNull();
  });
});
