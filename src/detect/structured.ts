import { z } from 'zod';

export type StructuredSource = 'datalayer' | 'fbq' | 'jsonld' | 'shopify';

export interface StructuredSignal {
  readonly source: StructuredSource;
  readonly orderId?: string;
  readonly amount?: number;
  readonly currency?: string;
}

const numberLike = z.union([z.number(), z.string()]);
const idLike = z.union([z.string(), z.number()]);

const Ga4Schema = z.object({
  event: z.string(),
  ecommerce: z.object({
    transaction_id: idLike.optional(),
    value: numberLike,
    currency: z.string().optional(),
  }),
});

const LegacySchema = z.object({
  ecommerce: z.object({
    currencyCode: z.string().optional(),
    purchase: z.object({
      actionField: z.object({ id: idLike.optional(), revenue: numberLike }),
    }),
  }),
});

const GtagParamsSchema = z.object({
  transaction_id: idLike.optional(),
  value: numberLike,
  currency: z.string().optional(),
});

const FbqParamsSchema = z.object({
  value: numberLike,
  currency: z.string().optional(),
  order_id: idLike.optional(),
});

const ShopifySchema = z.object({
  order_id: idLike.optional(),
  order_number: idLike.optional(),
  total_price: numberLike,
  currency: z.string().optional(),
});

const OfferSchema = z.object({ price: numberLike.optional(), priceCurrency: z.string().optional() });

const JsonLdOrderSchema = z.object({
  '@type': z.union([z.string(), z.array(z.string())]),
  orderNumber: idLike.optional(),
  price: numberLike.optional(),
  priceCurrency: z.string().optional(),
  totalPaymentDue: OfferSchema.optional(),
  acceptedOffer: z.union([OfferSchema, z.array(OfferSchema)]).optional(),
});

const EnvelopeSchema = z.object({ kind: z.enum(['datalayer', 'fbq', 'shopify', 'jsonld']), payload: z.unknown() });

const toAmount = (v: unknown): number | undefined => {
  if (typeof v === 'number') return Number.isFinite(v) ? v : undefined;
  if (typeof v !== 'string') return undefined;
  const n = Number(v.replace(/[^\d.-]/g, ''));
  return Number.isFinite(n) ? n : undefined;
};

const toCurrency = (v: unknown): string | undefined => {
  const upper = typeof v === 'string' ? v.trim().toUpperCase() : '';
  return /^[A-Z]{3}$/.test(upper) ? upper : undefined;
};

const toId = (v: unknown): string | undefined => {
  const s = typeof v === 'number' ? String(v) : typeof v === 'string' ? v.trim() : '';
  return s.length > 0 && s.length <= 128 ? s : undefined;
};

const signal = (source: StructuredSource, orderId: unknown, amount: unknown, currency: unknown): StructuredSignal | null => {
  const amt = toAmount(amount);
  if (amt === undefined) return null;
  const id = toId(orderId);
  const cur = toCurrency(currency);
  return { source, ...(id ? { orderId: id } : {}), amount: amt, ...(cur ? { currency: cur } : {}) };
};

/** gtag() calls land in dataLayer as an `arguments` object; after JSON cloning it looks like {0,1,2}. */
const asArgsArray = (payload: unknown): readonly unknown[] | null => {
  if (Array.isArray(payload)) return payload;
  if (payload && typeof payload === 'object' && '0' in payload && '1' in payload) {
    const o = payload as Record<string, unknown>;
    return [o['0'], o['1'], o['2']];
  }
  return null;
};

const parseDataLayer = (payload: unknown): StructuredSignal | null => {
  const args = asArgsArray(payload);
  if (args) {
    if (args[0] !== 'event' || String(args[1]).toLowerCase() !== 'purchase') return null;
    const p = GtagParamsSchema.safeParse(args[2]);
    return p.success ? signal('datalayer', p.data.transaction_id, p.data.value, p.data.currency) : null;
  }
  const ga4 = Ga4Schema.safeParse(payload);
  if (ga4.success && ga4.data.event.toLowerCase() === 'purchase') {
    return signal('datalayer', ga4.data.ecommerce.transaction_id, ga4.data.ecommerce.value, ga4.data.ecommerce.currency);
  }
  const legacy = LegacySchema.safeParse(payload);
  if (legacy.success) {
    const { actionField } = legacy.data.ecommerce.purchase;
    return signal('datalayer', actionField.id, actionField.revenue, legacy.data.ecommerce.currencyCode);
  }
  return null;
};

const parseFbq = (payload: unknown): StructuredSignal | null => {
  const args = asArgsArray(payload);
  if (!args) return null;
  const [cmd, a, b, c] = args;
  const [eventName, params] = cmd === 'trackSingle' ? [b, c] : cmd === 'track' || cmd === 'trackCustom' ? [a, b] : [null, null];
  if (eventName !== 'Purchase') return null;
  const p = FbqParamsSchema.safeParse(params);
  return p.success ? signal('fbq', p.data.order_id, p.data.value, p.data.currency) : null;
};

const parseShopify = (payload: unknown): StructuredSignal | null => {
  const p = ShopifySchema.safeParse(payload);
  return p.success ? signal('shopify', p.data.order_number ?? p.data.order_id, p.data.total_price, p.data.currency) : null;
};

const offerTotal = (offer: z.infer<typeof OfferSchema> | readonly z.infer<typeof OfferSchema>[] | undefined): { amount?: number; currency?: string } => {
  const list = offer === undefined ? [] : Array.isArray(offer) ? offer : [offer];
  const amounts = list.map((o) => toAmount(o.price)).filter((n): n is number => n !== undefined);
  const currency = list.map((o) => o.priceCurrency).find((c) => c !== undefined);
  return { ...(amounts.length ? { amount: amounts.reduce((a, b) => a + b, 0) } : {}), ...(currency ? { currency } : {}) };
};

const isOrderType = (type: string | readonly string[]): boolean => (Array.isArray(type) ? type : [type]).includes('Order');

const parseJsonLd = (payload: unknown): StructuredSignal | null => {
  const p = JsonLdOrderSchema.safeParse(payload);
  if (!p.success || !isOrderType(p.data['@type'])) return null;
  const due = offerTotal(p.data.totalPaymentDue);
  const accepted = offerTotal(p.data.acceptedOffer);
  const amount = toAmount(p.data.price) ?? due.amount ?? accepted.amount;
  const currency = p.data.priceCurrency ?? due.currency ?? accepted.currency;
  return signal('jsonld', p.data.orderNumber, amount, currency);
};

const PARSERS: Readonly<Record<StructuredSource, (payload: unknown) => StructuredSignal | null>> = {
  datalayer: parseDataLayer,
  fbq: parseFbq,
  shopify: parseShopify,
  jsonld: parseJsonLd,
};

/** Validate an untrusted `{ kind, payload }` envelope from the main-world hook. */
export const parseStructuredEvent = (raw: unknown): StructuredSignal | null => {
  const env = EnvelopeSchema.safeParse(raw);
  if (!env.success) return null;
  try {
    return PARSERS[env.data.kind](env.data.payload);
  } catch {
    return null;
  }
};

const flattenJsonLd = (node: unknown): readonly unknown[] => {
  if (Array.isArray(node)) return node.flatMap(flattenJsonLd);
  if (node && typeof node === 'object') {
    const graph = (node as { '@graph'?: unknown })['@graph'];
    return graph !== undefined ? [node, ...flattenJsonLd(graph)] : [node];
  }
  return [];
};

const safeJson = (text: string): unknown => {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
};

/** Collect schema.org Order signals from every ld+json script in the document. */
export const parseJsonLdOrders = (doc: Document): StructuredSignal[] =>
  Array.from(doc.querySelectorAll('script[type="application/ld+json"]'))
    .flatMap((script) => flattenJsonLd(safeJson(script.textContent ?? '')))
    .flatMap((node) => {
      const s = parseJsonLd(node);
      return s ? [s] : [];
    });
