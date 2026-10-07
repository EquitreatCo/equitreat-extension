import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { OrderCandidate } from '../../src/shared/index.js';
import { installChromeMock } from '../helpers/chrome-mock';
import { QUEUE_CAP, enqueue, flush, pushBounded, withoutFirst } from '../../src/background/queue';
import { readQueue } from '../../src/lib/storage';

const candidate = (orderId: string): OrderCandidate => ({
  merchantDomain: 'example.com',
  orderId,
  amount: 10,
  currency: 'USD',
  pageUrl: 'https://example.com/thank-you',
  detectionMethod: 'url',
  confidence: 80,
  rawSignals: {},
  detectedAt: '2026-09-09T00:00:00.000Z',
});

describe('queue pure helpers', () => {
  it('pushBounded drops the oldest item at the cap', () => {
    const q = [1, 2, 3];
    const next = pushBounded(q, 4, 3);
    expect(next).toEqual([2, 3, 4]);
    expect(q).toEqual([1, 2, 3]);
    expect(pushBounded([], 1, 3)).toEqual([1]);
  });

  it('withoutFirst returns a new array without the head', () => {
    const q = [1, 2];
    expect(withoutFirst(q)).toEqual([2]);
    expect(withoutFirst([])).toEqual([]);
    expect(q).toEqual([1, 2]);
  });
});

describe('queue storage + flush', () => {
  beforeEach(() => {
    installChromeMock();
  });

  it('enqueue persists up to the cap', async () => {
    for (let i = 0; i < QUEUE_CAP + 5; i += 1) await enqueue(candidate(`o${i}`));
    const q = await readQueue();
    expect(q).toHaveLength(QUEUE_CAP);
    expect(q[0]?.orderId).toBe('o5');
  });

  it('flush leaves the queue untouched when signed out', async () => {
    await enqueue(candidate('a'));
    const supabase = { auth: { getSession: vi.fn(async () => ({ data: { session: null } })) }, from: vi.fn() };
    const result = await flush(supabase as never);
    expect(result).toEqual({ flushed: 0, remaining: 1 });
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it('flush upserts each item and stops on the first failure', async () => {
    await enqueue(candidate('a'));
    await enqueue(candidate('b'));
    await enqueue(candidate('c'));
    const upsert = vi
      .fn()
      .mockResolvedValueOnce({ error: null })
      .mockResolvedValueOnce({ error: { message: 'network' } });
    const supabase = {
      auth: { getSession: vi.fn(async () => ({ data: { session: { user: { id: '00000000-0000-0000-0000-000000000001' } } } })) },
      from: vi.fn(() => ({ upsert })),
    };
    const result = await flush(supabase as never);
    expect(result).toEqual({ flushed: 1, remaining: 2 });
    expect(supabase.from).toHaveBeenCalledWith('orders');
    expect(upsert.mock.calls[0]?.[0]).toMatchObject({ user_id: '00000000-0000-0000-0000-000000000001', order_id: 'a' });
    expect(upsert.mock.calls[0]?.[1]).toEqual({ onConflict: 'user_id,merchant_domain,order_id', ignoreDuplicates: true });
    const q = await readQueue();
    expect(q.map((c) => c.orderId)).toEqual(['b', 'c']);
  });
});
