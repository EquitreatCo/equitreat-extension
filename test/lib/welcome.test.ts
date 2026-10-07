import { beforeEach, describe, expect, it } from 'vitest';
import { installChromeMock } from '../helpers/chrome-mock';
import { WELCOME_KEY, WELCOME_TTL_MS, isFreshWelcome, markWelcome, takeWelcome } from '../../src/lib/welcome';

describe('welcome flag', () => {
  let store: Record<string, unknown>;
  beforeEach(() => {
    store = installChromeMock().store;
  });

  it('is fresh within the TTL and stale after it', () => {
    const at = 1_000_000;
    expect(isFreshWelcome({ at, method: 'google' }, at + 1000)).toBe(true);
    expect(isFreshWelcome({ at, method: 'google' }, at + WELCOME_TTL_MS + 1)).toBe(false);
  });

  it('rejects malformed values', () => {
    expect(isFreshWelcome(null, 0)).toBe(false);
    expect(isFreshWelcome({ at: 'x', method: 'google' }, 0)).toBe(false);
    expect(isFreshWelcome({ at: 0, method: 'wallet' }, 0)).toBe(false);
  });

  it('take returns a fresh flag once and clears it', async () => {
    await markWelcome('google', 5000);
    expect(await takeWelcome(6000)).toEqual({ at: 5000, method: 'google' });
    expect(WELCOME_KEY in store).toBe(false);
    expect(await takeWelcome(6000)).toBeNull();
  });

  it('take clears a stale flag without returning it', async () => {
    await markWelcome('email', 0);
    expect(await takeWelcome(WELCOME_TTL_MS + 10)).toBeNull();
    expect(WELCOME_KEY in store).toBe(false);
  });
});
