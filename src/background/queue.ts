import { toOrderRowInsert, type OrderCandidate } from '../shared/index.js';
import type { SupabaseClient } from '@supabase/supabase-js';
import { readQueue, writeQueue } from '../lib/storage';

export const QUEUE_CAP = 200;
const ORDERS_CONFLICT = 'user_id,merchant_domain,order_id';

export interface FlushResult {
  readonly flushed: number;
  readonly remaining: number;
}

/** Append an item, dropping the oldest entries beyond `cap`. Never mutates the input. */
export const pushBounded = <T>(queue: readonly T[], item: T, cap: number): readonly T[] => [...queue, item].slice(-cap);

export const withoutFirst = <T>(queue: readonly T[]): readonly T[] => queue.slice(1);

export const enqueue = async (candidate: OrderCandidate): Promise<void> => {
  await writeQueue(pushBounded(await readQueue(), candidate, QUEUE_CAP));
};

const upsertOrder = async (supabase: SupabaseClient, userId: string, candidate: OrderCandidate): Promise<string | null> => {
  const { error } = await supabase.from('orders').upsert(toOrderRowInsert(userId, candidate), { onConflict: ORDERS_CONFLICT, ignoreDuplicates: true });
  return error ? error.message : null;
};

/**
 * Upload queued candidates in order. Stops at the first failure so the item is retried on the next alarm.
 * Items stay queued while signed out.
 */
export const flush = async (supabase: SupabaseClient): Promise<FlushResult> => {
  const initial = await readQueue();
  if (initial.length === 0) return { flushed: 0, remaining: 0 };

  const { data } = await supabase.auth.getSession();
  const userId = data.session?.user.id;
  if (!userId) return { flushed: 0, remaining: initial.length };

  const drain = async (queue: readonly OrderCandidate[], flushed: number): Promise<FlushResult> => {
    const head = queue[0];
    if (!head) return { flushed, remaining: 0 };
    const error = await upsertOrder(supabase, userId, head);
    if (error) {
      console.warn('[equitreat] order upload failed, will retry:', error);
      await writeQueue(queue);
      return { flushed, remaining: queue.length };
    }
    const rest = withoutFirst(queue);
    await writeQueue(rest);
    return drain(rest, flushed + 1);
  };

  return drain(initial, 0);
};
