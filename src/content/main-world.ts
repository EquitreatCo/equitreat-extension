/**
 * MAIN-world hook (document_start). Observes dataLayer.push, fbq and Shopify.checkout and forwards
 * sanitized copies to the isolated detector via postMessage. Must never throw into the page and
 * must not touch chrome.* APIs (unavailable in the main world).
 */
import { SIGNAL_CHANNEL, findMerchant } from '../shared/index.js';

type Kind = 'datalayer' | 'fbq' | 'shopify';
type AnyFn = (...args: unknown[]) => unknown;
interface FbqLike extends AnyFn {
  queue?: unknown[];
}

const MAX_PAYLOAD_BYTES = 20_000;
const WRAPPED = Symbol.for('era:wrapped');

const safeClone = (value: unknown): unknown => {
  try {
    const json = JSON.stringify(value);
    if (typeof json !== 'string') return null;
    return JSON.parse(json.length > MAX_PAYLOAD_BYTES ? json.slice(0, MAX_PAYLOAD_BYTES) : json);
  } catch {
    return null;
  }
};

const forward = (kind: Kind, payload: unknown): void => {
  try {
    const cloned = safeClone(payload);
    if (cloned === null || cloned === undefined) return;
    window.postMessage({ channel: SIGNAL_CHANNEL, kind, payload: cloned }, location.origin);
  } catch {
    /* never throw into the page */
  }
};

const isWrapped = (fn: unknown): boolean => typeof fn === 'function' && (fn as unknown as Record<symbol, unknown>)[WRAPPED] === true;

const wrapDataLayer = (layer: unknown): void => {
  if (!Array.isArray(layer)) return;
  const arr = layer as unknown[] & { push: AnyFn };
  arr.forEach((entry) => forward('datalayer', entry));
  if (isWrapped(arr.push)) return;
  const original = arr.push.bind(arr);
  const wrapped = ((...items: unknown[]) => {
    items.forEach((item) => forward('datalayer', item));
    return original(...items);
  }) as AnyFn & Record<symbol, unknown>;
  wrapped[WRAPPED] = true;
  Object.defineProperty(arr, 'push', { value: wrapped, configurable: true, writable: true });
};

const wrapFbq = (fbq: unknown): unknown => {
  if (typeof fbq !== 'function' || isWrapped(fbq)) return fbq;
  const original = fbq as FbqLike;
  const wrapped = ((...args: unknown[]) => {
    forward('fbq', args);
    return original(...args);
  }) as FbqLike & Record<symbol, unknown>;
  wrapped[WRAPPED] = true;
  Object.setPrototypeOf(wrapped, original);
  Object.getOwnPropertyNames(original).forEach((name) => {
    try {
      const desc = Object.getOwnPropertyDescriptor(original, name);
      if (desc && !(name in wrapped)) Object.defineProperty(wrapped, name, desc);
    } catch {
      /* ignore non-copyable props */
    }
  });
  (original.queue ?? []).forEach((call) => forward('fbq', call));
  return wrapped;
};

/** Re-wrap whenever the page assigns window[name] (GTM/Pixel loaders replace these). */
const interceptGlobal = (name: 'dataLayer' | 'fbq', onSet: (value: unknown) => unknown): void => {
  const w = window as unknown as Record<string, unknown>;
  let current = onSet(w[name]);
  Object.defineProperty(window, name, {
    configurable: true,
    enumerable: true,
    get: () => current,
    set: (value: unknown) => {
      current = onSet(value);
    },
  });
};

const probeShopify = (): void => {
  const checkout = (window as unknown as { Shopify?: { checkout?: unknown } }).Shopify?.checkout;
  if (checkout && typeof checkout === 'object') forward('shopify', checkout);
};

const drainDataLayer = (): void => wrapDataLayer((window as unknown as { dataLayer?: unknown }).dataLayer);

const drainFbqQueue = (): void => {
  const fbq = (window as unknown as { fbq?: FbqLike }).fbq;
  (fbq?.queue ?? []).forEach((call) => forward('fbq', call));
};

/** The isolated detector starts later than this hook; it asks for a replay once it is listening. */
const REPLAY_CHANNEL = `${SIGNAL_CHANNEL}:replay`;

// Listed stores only: the manifest limits injection, and this checks the same list before hooking anything.
if (findMerchant(location.hostname)) try {
  interceptGlobal('dataLayer', (value) => {
    wrapDataLayer(value);
    return value;
  });
  interceptGlobal('fbq', wrapFbq);
  const onReady = (): void => {
    drainDataLayer();
    drainFbqQueue();
    probeShopify();
  };
  document.addEventListener('DOMContentLoaded', onReady);
  window.addEventListener('load', onReady);
  window.addEventListener('message', (event: MessageEvent) => {
    if (event.source !== window) return;
    const data = event.data as { channel?: unknown } | null;
    if (data?.channel === REPLAY_CHANNEL) onReady();
  });
} catch {
  /* never throw into the page */
}
