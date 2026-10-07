import { describe, expect, it } from 'vitest';
import { isEvmAddress, EvmAddressSchema } from '../../src/shared/wallet.js';

describe('isEvmAddress', () => {
  it('accepts valid addresses', () => {
    expect(isEvmAddress('0x' + 'a'.repeat(40))).toBe(true);
    expect(isEvmAddress('0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045')).toBe(true);
  });
  it('rejects invalid addresses', () => {
    expect(isEvmAddress('0x123')).toBe(false);
    expect(isEvmAddress('d8dA6BF26964aF9D7eEd9e03E53415D37aA96045')).toBe(false);
    expect(isEvmAddress('0x' + 'g'.repeat(40))).toBe(false);
    expect(EvmAddressSchema.safeParse('').success).toBe(false);
  });
});
