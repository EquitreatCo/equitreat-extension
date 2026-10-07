import { beforeEach, describe, expect, it } from 'vitest';
import { installChromeMock } from '../helpers/chrome-mock';
import { DEDUPE_TTL_MS, dedupeKey, isDuplicate, isSeen, pruneSeen, remember, withSeen } from '../../src/background/dedupe';

const NOW = Date.UTC(2026, 8, 9);

describe('dedupe pure helpers', () => {
  it('prunes expired entries without mutating the input', () => {
    const seen = { a: NOW - 1, b: NOW + 1000 };
    const pruned = pruneSeen(seen, NOW);
    expect(pruned).toEqual({ b: NOW + 1000 });
    expect(seen).toEqual({ a: NOW - 1, b: NOW + 1000 });
  });

  it('reports seen keys only while unexpired', () => {
    const seen = withSeen({}, 'k', NOW);
    expect(seen['k']).toBe(NOW + DEDUPE_TTL_MS);
    expect(isSeen(seen, 'k', NOW)).toBe(true);
    expect(isSeen(seen, 'k', NOW + DEDUPE_TTL_MS + 1)).toBe(false);
    expect(isSeen(seen, 'other', NOW)).toBe(false);
  });

  it('derives a sha256 key from domain and order id', async () => {
    const key = await dedupeKey('example.com', 'A1');
    expect(key).toMatch(/^[0-9a-f]{64}$/);
    expect(await dedupeKey('example.com', 'A1')).toBe(key);
    expect(await dedupeKey('example.com', 'A2')).not.toBe(key);
  });
});

describe('dedupe storage wrappers', () => {
  beforeEach(() => {
    installChromeMock();
  });

  it('isDuplicate is true only after remember', async () => {
    expect(await isDuplicate('key-1')).toBe(false);
    await remember('key-1');
    expect(await isDuplicate('key-1')).toBe(true);
    expect(await isDuplicate('key-2')).toBe(false);
  });
});
