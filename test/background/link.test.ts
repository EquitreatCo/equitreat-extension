import { beforeEach, describe, expect, it } from 'vitest';
import { installChromeMock } from '../helpers/chrome-mock';
import { beginLink, LINK_INTENT_KEY, LINK_INTENT_TTL_MS, takeLinkIntent } from '../../src/background/link';

describe('link intent', () => {
  beforeEach(() => {
    installChromeMock();
  });

  it('allows exactly one link token within five minutes of pressing Link wallet', async () => {
    await beginLink(1_000);
    expect(await takeLinkIntent(1_000 + LINK_INTENT_TTL_MS)).toBe(true);
    expect(await takeLinkIntent(1_000 + LINK_INTENT_TTL_MS)).toBe(false);
  });

  it('refuses when Link wallet was never pressed', async () => {
    expect(await takeLinkIntent(5_000)).toBe(false);
  });

  it('refuses and forgets an expired or future-dated intent', async () => {
    const { store } = installChromeMock();
    await beginLink(0);
    expect(await takeLinkIntent(LINK_INTENT_TTL_MS + 1)).toBe(false);
    expect(store[LINK_INTENT_KEY]).toBeUndefined();
    await beginLink(10_000);
    expect(await takeLinkIntent(9_000)).toBe(false);
  });
});
