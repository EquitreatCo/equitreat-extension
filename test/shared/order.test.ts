import { describe, expect, it } from 'vitest';
import { OrderCandidateSchema, toOrderRowInsert } from '../../src/shared/index.js';

const valid = {
  merchantDomain: 'amazon.com',
  orderId: '123-4567890-1234567',
  amount: 100,
  currency: 'USD',
  pageUrl: 'https://www.amazon.com/gp/buy/thankyou/handlers/display.html',
  detectionMethod: 'url',
  confidence: 80,
  rawSignals: { url: true },
  detectedAt: '2026-09-09T12:00:00.000Z',
};

describe('OrderCandidateSchema', () => {
  it('accepts a valid candidate', () => {
    expect(OrderCandidateSchema.parse(valid)).toMatchObject(valid);
  });
  it('rejects lowercase currency', () => {
    expect(OrderCandidateSchema.safeParse({ ...valid, currency: 'usd' }).success).toBe(false);
  });
  it('rejects negative amount', () => {
    expect(OrderCandidateSchema.safeParse({ ...valid, amount: -1 }).success).toBe(false);
  });
  it('rejects confidence out of range', () => {
    expect(OrderCandidateSchema.safeParse({ ...valid, confidence: 101 }).success).toBe(false);
  });
});

describe('toOrderRowInsert', () => {
  it('maps to snake_case columns', () => {
    const row = toOrderRowInsert('11111111-1111-4111-8111-111111111111', OrderCandidateSchema.parse(valid));
    expect(row.user_id).toBe('11111111-1111-4111-8111-111111111111');
    expect(row.merchant_domain).toBe('amazon.com');
    expect(row.order_id).toBe('123-4567890-1234567');
    expect(row.detection_method).toBe('url');
  });
});
