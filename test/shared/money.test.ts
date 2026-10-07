import { describe, expect, it } from 'vitest';
import { parseAmount, symbolToCurrency, normalizeNumber } from '../../src/shared/money.js';

describe('normalizeNumber', () => {
  it.each([
    ['1,234.56', 1234.56],
    ['1.234,56', 1234.56],
    ['1 234,56', 1234.56],
    ['1 234,56', 1234.56],
    ["1'234.56", 1234.56],
    ['1,23,456.00', 123456],
    ['12.99', 12.99],
    ['12,99', 12.99],
    ['1200', 1200],
    ['1,200', 1200],
    ['1.200', 1200],
    ['0.5', 0.5],
  ])('%s → %d', (input, expected) => {
    expect(normalizeNumber(input)).toBe(expected);
  });

  it('returns null for garbage', () => {
    expect(normalizeNumber('abc')).toBeNull();
    expect(normalizeNumber('')).toBeNull();
  });
});

describe('symbolToCurrency', () => {
  it('maps unambiguous symbols', () => {
    expect(symbolToCurrency('€')).toBe('EUR');
    expect(symbolToCurrency('£')).toBe('GBP');
    expect(symbolToCurrency('₹')).toBe('INR');
  });
  it('uses hints for ambiguous $', () => {
    expect(symbolToCurrency('$', { tld: 'ca' })).toBe('CAD');
    expect(symbolToCurrency('$', { tld: 'com.au' })).toBe('AUD');
    expect(symbolToCurrency('$', { lang: 'en-NZ' })).toBe('NZD');
    expect(symbolToCurrency('$')).toBe('USD');
  });
  it('uses hints for kr', () => {
    expect(symbolToCurrency('kr', { lang: 'sv' })).toBe('SEK');
    expect(symbolToCurrency('kr', { tld: 'no' })).toBe('NOK');
    expect(symbolToCurrency('kr', { tld: 'dk' })).toBe('DKK');
  });
});

describe('parseAmount', () => {
  it.each([
    ['$1,234.56', { amount: 1234.56, currency: 'USD' }],
    ['Total: $99.00', { amount: 99, currency: 'USD' }],
    ['1.234,56 €', { amount: 1234.56, currency: 'EUR' }],
    ['€ 45,00', { amount: 45, currency: 'EUR' }],
    ['₹1,23,456.00', { amount: 123456, currency: 'INR' }],
    ['Rs. 2,499', { amount: 2499, currency: 'INR' }],
    ['£12.99', { amount: 12.99, currency: 'GBP' }],
    ['¥1,200', { amount: 1200, currency: 'JPY' }],
    ['USD 250.00', { amount: 250, currency: 'USD' }],
    ['250.00 USD', { amount: 250, currency: 'USD' }],
    ['A$ 80.50', { amount: 80.5, currency: 'AUD' }],
    ['CA$120.00', { amount: 120, currency: 'CAD' }],
    ['S$ 33.10', { amount: 33.1, currency: 'SGD' }],
    ['AED 1,500.00', { amount: 1500, currency: 'AED' }],
    ['CHF 89.90', { amount: 89.9, currency: 'CHF' }],
    ['R$ 199,90', { amount: 199.9, currency: 'BRL' }],
  ])('%s', (input, expected) => {
    expect(parseAmount(input)).toEqual(expected);
  });

  it('resolves kr with lang hint', () => {
    expect(parseAmount('1 234,56 kr', { lang: 'sv' })).toEqual({ amount: 1234.56, currency: 'SEK' });
  });

  it('prefers explicit meta currency over symbol default', () => {
    expect(parseAmount('$50.00', { metaCurrency: 'MXN' })).toEqual({ amount: 50, currency: 'MXN' });
  });

  it('uses tld hint for $', () => {
    expect(parseAmount('$50.00', { tld: 'co.uk' })).toEqual({ amount: 50, currency: 'USD' });
    expect(parseAmount('$50.00', { tld: 'ca' })).toEqual({ amount: 50, currency: 'CAD' });
  });

  it('returns null for text without an amount', () => {
    expect(parseAmount('Thank you for your order')).toBeNull();
    expect(parseAmount('Order #123-4567890-1234567')).toBeNull();
  });

  it('ignores negative and percentage-like numbers', () => {
    expect(parseAmount('Save 20%')).toBeNull();
  });
});
