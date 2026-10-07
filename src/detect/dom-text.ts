/** Small DOM text helpers shared by the detection modules. Pure; no side effects. */

const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE', 'SVG']);

export const collapseWhitespace = (text: string): string => text.replace(/\s+/g, ' ').trim();

/** Visible-ish text of a node: text nodes joined with spaces, skipping script/style subtrees. */
export const joinedText = (node: Node | null | undefined, limit = 4000): string => {
  if (!node) return '';
  const parts: string[] = [];
  let length = 0;
  const visit = (n: Node): void => {
    if (length >= limit) return;
    if (n.nodeType === Node.TEXT_NODE) {
      const t = collapseWhitespace(n.textContent ?? '');
      if (t) {
        parts.push(t);
        length += t.length + 1;
      }
      return;
    }
    if (n.nodeType !== Node.ELEMENT_NODE || SKIP_TAGS.has((n as Element).tagName)) return;
    n.childNodes.forEach(visit);
  };
  visit(node);
  return parts.join(' ').slice(0, limit);
};

/** Text from the element's direct text-node children only (label detection). */
export const ownText = (el: Element): string =>
  collapseWhitespace(
    Array.from(el.childNodes)
      .filter((n) => n.nodeType === Node.TEXT_NODE)
      .map((n) => n.textContent ?? '')
      .join(' '),
  );

/** Best-effort visibility check that works without layout (happy-dom has none). */
export const isProbablyVisible = (el: Element): boolean => {
  if (el.hasAttribute('hidden') || el.getAttribute('aria-hidden') === 'true') return false;
  const style = el.getAttribute('style') ?? '';
  if (/display\s*:\s*none|visibility\s*:\s*hidden/i.test(style)) return false;
  if (el instanceof HTMLInputElement && el.type === 'hidden') return false;
  return true;
};
