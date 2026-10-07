import { describe, expect, it } from 'vitest';
import { merchantInitials, isRecent, formatMultiplier, formatTokens } from '../../src/popup/format';

describe('holder level formatting', () => {
  it('renders the multiplier from basis points', () => {
    expect(formatMultiplier(10000)).toBe('1.00×');
    expect(formatMultiplier(12500)).toBe('1.25×');
    expect(formatMultiplier(20000)).toBe('2.00×');
  });
  it('groups whole token counts', () => {
    expect(formatTokens(25000)).toBe('25,000');
    expect(formatTokens(13000.4)).toBe('13,000');
  });
});

describe('helpers', () => {
  it('derives merchant initials', () => {
    expect(merchantInitials('www.amazon.com')).toBe('AM');
    expect(merchantInitials('shop.gymshark.com')).toBe('SH');
  });
  it('flags recent orders within 15 minutes', () => {
    const now = Date.parse('2026-09-09T12:00:00Z');
    expect(isRecent('2026-09-09T11:50:00Z', now)).toBe(true);
    expect(isRecent('2026-09-09T11:00:00Z', now)).toBe(false);
  });
});
