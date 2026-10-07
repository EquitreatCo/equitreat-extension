import { parseAmount } from '../shared/index.js';
import { collapseWhitespace, isProbablyVisible, joinedText, ownText } from './dom-text';

export interface DomSignals {
  readonly headlineHit: boolean;
  readonly orderIdText: string | null;
  readonly totalText: string | null;
  readonly negative: boolean;
  readonly title: string;
  readonly bodyExcerpt: string;
}

// Spec regex plus Shopify's "Thank you, Jane!" heading and "Thanks for your order".
const HEADLINE_RE =
  /thank you for (your |the )?(order|purchase)|thank you[,!]|thanks for (your |the )?(order|purchase)|order (confirmed|placed|complete[d]?|received|successful)|your order (has been|was|is) (placed|received|confirmed|complete[d]?)|payment (successful|received|confirmed)|purchase (complete[d]?|confirmed)|we('| ha)ve received your order/i;
const HEADLINE_SELECTOR = 'h1,h2,h3,[role=heading],[class*=thank],[class*=confirm],[id*=thank],[id*=confirm]';
const HEADLINE_TEXT_LIMIT = 8000;

const ORDER_ID_LABEL_RE = /order\s*(number|no\.?|#|id)|confirmation\s*(number|#)/i;
const ORDER_ID_TEXT_CAP = 300;
const MAX_ELEMENTS_SCANNED = 6000;

const TOTAL_LABEL_RE =
  /^\s*(grand\s*total|order\s*total|total\s*(paid|amount|charged|due)?|amount\s*(paid|charged)|total\s*for\s*this\s*order)\s*[:]?\s*$/i;
const TOTAL_SELECTOR = 'tr, li, div, p, span, dt, dd, th, td';
const TOTAL_FALLBACK_MAX_LEN = 160;

const NEGATIVE_BUTTON_RE = /^(place (your )?order|pay now|buy now|complete (purchase|order)|confirm (and pay|order)|proceed to (checkout|payment))$/i;
const NEGATIVE_BUTTON_SELECTOR = 'button, input[type=submit], a[role=button]';
const CARD_INPUT_SELECTOR = 'input[autocomplete*=cc-], input[name*=card], input[name*=cvv], input[name*=cvc]';

const BODY_EXCERPT_LEN = 2000;

const limitedElements = (doc: Document, selector: string): readonly Element[] =>
  Array.from(doc.body?.querySelectorAll(selector) ?? []).slice(0, MAX_ELEMENTS_SCANNED);

const detectHeadline = (doc: Document): boolean => {
  const text = [doc.title, ...limitedElements(doc, HEADLINE_SELECTOR).map((el) => joinedText(el, 400))].join(' | ').slice(0, HEADLINE_TEXT_LIMIT);
  return HEADLINE_RE.test(text);
};

/** Deepest element whose text mentions an order-number label. */
const findOrderIdText = (doc: Document): string | null => {
  const matches = limitedElements(doc, '*').filter((el) => ORDER_ID_LABEL_RE.test(joinedText(el, 600)));
  const deepest = matches.find((el) => !matches.some((other) => other !== el && el.contains(other)));
  if (!deepest) return null;
  const text = [joinedText(deepest, 300), joinedText(deepest.nextSibling, 200), joinedText(deepest.parentElement, 400)].join(' ');
  return collapseWhitespace(text).slice(0, ORDER_ID_TEXT_CAP) || null;
};

interface TotalCandidate {
  readonly label: string;
  readonly text: string;
  readonly amount: number;
}

const candidateFromLabel = (el: Element): TotalCandidate | null => {
  const label = ownText(el);
  const texts = [joinedText(el, 300), joinedText(el.nextElementSibling, 300), joinedText(el.parentElement, 400)];
  const hit = texts.map((text) => ({ text, parsed: parseAmount(text) })).find((t) => t.parsed !== null);
  return hit?.parsed ? { label, text: hit.text, amount: hit.parsed.amount } : null;
};

const fallbackCandidates = (doc: Document): readonly TotalCandidate[] =>
  limitedElements(doc, TOTAL_SELECTOR)
    .map((el) => joinedText(el, TOTAL_FALLBACK_MAX_LEN + 1))
    .filter((text) => text.length <= TOTAL_FALLBACK_MAX_LEN && /total/i.test(text))
    .map((text) => ({ text, parsed: parseAmount(text) }))
    .flatMap((t) => (t.parsed ? [{ label: t.text, text: t.text, amount: t.parsed.amount }] : []));

const pickLargest = (list: readonly TotalCandidate[]): TotalCandidate | null =>
  list.reduce<TotalCandidate | null>((best, c) => (best === null || c.amount > best.amount ? c : best), null);

const findTotalText = (doc: Document): string | null => {
  const labelled = limitedElements(doc, TOTAL_SELECTOR)
    .filter((el) => TOTAL_LABEL_RE.test(ownText(el)))
    .flatMap((el) => {
      const c = candidateFromLabel(el);
      return c ? [c] : [];
    });
  const grand = labelled.filter((c) => /grand/i.test(c.label));
  const best = pickLargest(grand) ?? pickLargest(labelled) ?? pickLargest(fallbackCandidates(doc));
  return best ? best.text.slice(0, 200) : null;
};

const buttonText = (el: Element): string =>
  collapseWhitespace(el instanceof HTMLInputElement ? el.value : joinedText(el, 100));

const detectNegative = (doc: Document): boolean => {
  const hasActionButton = limitedElements(doc, NEGATIVE_BUTTON_SELECTOR).some((el) => isProbablyVisible(el) && NEGATIVE_BUTTON_RE.test(buttonText(el)));
  const hasCardInput = (doc.body?.querySelector(CARD_INPUT_SELECTOR) ?? null) !== null;
  return hasActionButton || hasCardInput;
};

/** Extract heuristic confirmation signals from a document. */
export const scanDom = (doc: Document): DomSignals => ({
  headlineHit: detectHeadline(doc),
  orderIdText: findOrderIdText(doc),
  totalText: findTotalText(doc),
  negative: detectNegative(doc),
  title: collapseWhitespace(doc.title ?? ''),
  bodyExcerpt: joinedText(doc.body, BODY_EXCERPT_LEN),
});
