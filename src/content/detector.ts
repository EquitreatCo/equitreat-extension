/**
 * Isolated-world detector (document_idle). Combines structured signals from the main-world hook,
 * JSON-LD, URL rules and DOM heuristics; sends the first strong candidate to the service worker.
 */
import { SIGNAL_CHANNEL, findMerchant } from '../shared/index.js';
import { scanDom } from '../detect/dom-signals';
import { hintsFromDocument, scoreCandidate } from '../detect/score';
import { parseJsonLdOrders, parseStructuredEvent, type StructuredSignal } from '../detect/structured';
import { sendMessage } from '../lib/messages';

const DEBOUNCE_MS = 400;
/** After this many DOM-triggered scans the observer switches to the slow cadence. */
const FAST_SCAN_BUDGET = 30;
/** Slow cadence for long-lived single-page checkouts; structured signals always evaluate immediately. */
const SLOW_DEBOUNCE_MS = 5_000;

interface DetectorState {
  readonly structured: readonly StructuredSignal[];
  readonly evaluations: number;
  readonly done: boolean;
}

const navigationType = (): string => {
  const entry = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
  return entry?.type ?? 'navigate';
};

const run = (): void => {
  let state: DetectorState = { structured: parseJsonLdOrders(document), evaluations: 0, done: false };
  let timer: ReturnType<typeof setTimeout> | null = null;
  let observer: MutationObserver | null = null;

  const stop = (): void => {
    state = { ...state, done: true };
    observer?.disconnect();
    observer = null;
    if (timer) clearTimeout(timer);
    timer = null;
  };

  const emit = async (candidate: unknown): Promise<void> => {
    try {
      const outcome = await sendMessage({ type: 'order:candidate', candidate, navigationType: navigationType() });
      if (import.meta.env.DEV) console.info('[equitreat] order candidate sent to extension:', outcome, candidate);
    } catch (err) {
      if (import.meta.env.DEV) console.warn('[equitreat] order candidate rejected by extension:', err, candidate);
    }
  };

  const evaluate = (): void => {
    if (state.done) return;
    state = { ...state, evaluations: state.evaluations + 1 };
    const url = location.href;
    const dom = scanDom(document);
    const candidate = scoreCandidate({ url, dom, structured: state.structured, hints: hintsFromDocument(document, url) });
    if (!candidate) {
      if (state.structured.length > 0) {
        if (import.meta.env.DEV) console.debug('[equitreat] purchase signal seen but below threshold', { negative: dom.negative, structured: state.structured });
      }
      return;
    }
    stop();
    void emit(candidate);
  };

  /** DOM mutations are debounced; after the fast budget is spent they are sampled every few seconds. */
  const schedule = (): void => {
    if (state.done) return;
    if (timer) clearTimeout(timer);
    const delay = state.evaluations >= FAST_SCAN_BUDGET ? SLOW_DEBOUNCE_MS : DEBOUNCE_MS;
    timer = setTimeout(evaluate, delay);
  };

  window.addEventListener('message', (event: MessageEvent) => {
    if (state.done || event.source !== window) return;
    const data = event.data as { channel?: unknown } | null;
    if (!data || data.channel !== SIGNAL_CHANNEL) return;
    const signal = parseStructuredEvent(data);
    if (!signal) return;
    state = { ...state, structured: [...state.structured, signal] };
    evaluate();
  });

  window.addEventListener('pageshow', (event: PageTransitionEvent) => {
    if (event.persisted) stop(); // bfcache restore: the worker already saw this page
  });

  if (document.body) {
    observer = new MutationObserver(schedule);
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
  }
  // Ask the main-world hook to re-send signals it forwarded before this listener existed, and
  // debounce the first evaluation so those replayed signals are included in the first score.
  window.postMessage({ channel: `${SIGNAL_CHANNEL}:replay` }, location.origin);
  schedule();
};

try {
  // The manifest already limits this script to listed stores; the same list is checked here too.
  if (findMerchant(location.hostname)) run();
} catch (err) {
  console.debug('[equitreat] detector failed to start:', err);
}
