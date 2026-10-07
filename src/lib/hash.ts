/** FNV-1a 32-bit hash, returned as 8 lowercase hex chars. Used for synthetic order ids. */
export const fnv1a32hex = (input: string): string => {
  const bytes = new TextEncoder().encode(input);
  const hash = bytes.reduce((h, b) => Math.imul(h ^ b, 0x01000193) >>> 0, 0x811c9dc5);
  return hash.toString(16).padStart(8, '0');
};

const toHex = (buffer: ArrayBuffer): string =>
  Array.from(new Uint8Array(buffer), (b) => b.toString(16).padStart(2, '0')).join('');

/** SHA-256 of a UTF-8 string via WebCrypto, as 64 lowercase hex chars. */
export const sha256Hex = async (input: string): Promise<string> => {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return toHex(digest);
};

/** Random bytes as lowercase hex (used for OAuth nonces). */
export const randomHex = (byteLength: number): string => {
  const bytes = crypto.getRandomValues(new Uint8Array(byteLength));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
};
