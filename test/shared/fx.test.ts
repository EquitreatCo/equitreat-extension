import { describe, expect, it } from 'vitest';
import { describeCurrencyMix, formatCashbackUsd, formatUsd, toUsd, usdEquivalentLabel } from '../../src/shared/fx.js';

describe('toUsd', () => {
  it('divides by units-per-USD and rounds to cents', () => {
    expect(toUsd(64.5, 0.7392)).toBe(87.26);
    expect(toUsd(2499, 83.21)).toBe(30.03);
    expect(toUsd(100, 1)).toBe(100);
  });
  it('returns null for missing or invalid rates', () => {
    expect(toUsd(10, 0)).toBeNull();
    expect(toUsd(10, -1)).toBeNull();
    expect(toUsd(10, Number.NaN)).toBeNull();
    expect(toUsd(Number.NaN, 1)).toBeNull();
  });
});

describe('formatUsd', () => {
  it('renders a fixed US$ prefix regardless of locale', () => {
    expect(formatUsd(1234.5)).toBe('US$1,234.50');
    expect(formatUsd(0)).toBe('US$0.00');
  });
});

describe('formatCashbackUsd', () => {
  it('keeps two decimals for whole cents', () => {
    expect(formatCashbackUsd(3.5)).toBe('US$3.50');
    expect(formatCashbackUsd(0)).toBe('US$0.00');
    expect(formatCashbackUsd(1234.5)).toBe('US$1,234.50');
  });
  it('rounds cashback to cents, including halves that floats hold a hair low', () => {
    expect(formatCashbackUsd(0.0575)).toBe('US$0.06');
    expect(formatCashbackUsd(2.075)).toBe('US$2.08');
    expect(formatCashbackUsd(4.775)).toBe('US$4.78');
    expect(formatCashbackUsd(17.275)).toBe('US$17.28');
    expect(formatCashbackUsd(0.100625)).toBe('US$0.10');
    expect(formatCashbackUsd(0.05)).toBe('US$0.05');
  });
  it('keeps more places only below half a cent, so nothing reads as zero', () => {
    expect(formatCashbackUsd(0.0025)).toBe('US$0.0025');
    expect(formatCashbackUsd(0.0004)).toBe('US$0.0004');
  });
  it('treats non-finite input as zero', () => {
    expect(formatCashbackUsd(Number.NaN)).toBe('US$0.00');
  });
});

describe('describeCurrencyMix', () => {
  it('is empty for USD-only or nothing', () => {
    expect(describeCurrencyMix([])).toBe('');
    expect(describeCurrencyMix(['USD'])).toBe('');
  });
  it('lists the currencies in order with "and"', () => {
    expect(describeCurrencyMix(['GBP'])).toBe('GBP');
    expect(describeCurrencyMix(['GBP', 'INR'])).toBe('GBP and INR');
    expect(describeCurrencyMix(['GBP', 'INR', 'EUR', 'USD'])).toBe('GBP, INR, EUR and USD');
  });
  it('dedupes and normalises case', () => {
    expect(describeCurrencyMix(['gbp', 'GBP', 'eur'])).toBe('GBP and EUR');
  });
});

describe('usdEquivalentLabel', () => {
  it('is empty for USD orders', () => {
    expect(usdEquivalentLabel({ currency: 'USD', amount_usd: 129.99 })).toBe('');
  });
  it('shows the converted amount for other currencies', () => {
    expect(usdEquivalentLabel({ currency: 'GBP', amount_usd: 87.26 })).toBe('≈ US$87.26');
  });
  it('says the rate is pending when not converted yet', () => {
    expect(usdEquivalentLabel({ currency: 'INR', amount_usd: null })).toBe('rate pending');
  });
});
