import { z } from 'zod';

const EVM_ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;

export const isEvmAddress = (value: string): boolean => EVM_ADDRESS_RE.test(value);

export const EvmAddressSchema = z
  .string()
  .regex(EVM_ADDRESS_RE, 'Must be a 0x-prefixed 40-hex-character address');

export type EvmAddress = z.infer<typeof EvmAddressSchema>;
