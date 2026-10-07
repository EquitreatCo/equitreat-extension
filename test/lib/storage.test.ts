import { describe, expect, it } from 'vitest';
import { installChromeMock } from '../helpers/chrome-mock';
import { restrictStorageToExtension } from '../../src/lib/storage';

describe('restrictStorageToExtension', () => {
  it('limits chrome.storage.local to extension pages and the service worker', async () => {
    const mock = installChromeMock();
    expect(mock.accessLevel()).toBeUndefined();
    await restrictStorageToExtension();
    expect(mock.accessLevel()).toBe('TRUSTED_CONTEXTS');
  });
});
