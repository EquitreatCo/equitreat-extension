import { sha256Hex } from '../lib/hash';
import { readSeen, writeSeen, type SeenMap } from '../lib/storage';

const DAY_MS = 24 * 60 * 60 * 1000;
export const DEDUPE_TTL_MS = 90 * DAY_MS;

/** Stable key for an order: sha256("domain|orderId"). */
export const dedupeKey = (merchantDomain: string, orderId: string): Promise<string> => sha256Hex(`${merchantDomain}|${orderId}`);

/** Return a copy of the map without expired entries. */
export const pruneSeen = (seen: SeenMap, now: number): SeenMap =>
  Object.fromEntries(Object.entries(seen).filter(([, expiresAt]) => expiresAt > now));

export const isSeen = (seen: SeenMap, key: string, now: number): boolean => (seen[key] ?? 0) > now;

/** Return a pruned copy of the map with `key` remembered until now + TTL. */
export const withSeen = (seen: SeenMap, key: string, now: number): SeenMap => ({ ...pruneSeen(seen, now), [key]: now + DEDUPE_TTL_MS });

export const isDuplicate = async (key: string, now = Date.now()): Promise<boolean> => isSeen(await readSeen(), key, now);

export const remember = async (key: string, now = Date.now()): Promise<void> => {
  await writeSeen(withSeen(await readSeen(), key, now));
};
