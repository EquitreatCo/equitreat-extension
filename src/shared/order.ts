import { z } from 'zod';

export const CurrencyCodeSchema = z
  .string()
  .length(3)
  .regex(/^[A-Z]{3}$/, 'ISO 4217 code expected');

export const DetectionMethodSchema = z.enum([
  'datalayer',
  'fbq',
  'jsonld',
  'shopify',
  'url',
  'dom',
  'mixed',
]);

/** An order confirmation extracted by the content script. Untrusted until validated. */
export const OrderCandidateSchema = z.object({
  merchantDomain: z.string().min(1).max(253),
  orderId: z.string().min(1).max(128),
  /** Upper bound matches numeric(14,2); the server applies the real per-order limit. */
  amount: z.number().nonnegative().finite().max(999_999_999_999),
  currency: CurrencyCodeSchema,
  pageUrl: z.string().url().max(2048),
  detectionMethod: DetectionMethodSchema,
  confidence: z.number().int().min(0).max(100),
  rawSignals: z.record(z.string(), z.unknown()).default({}),
  detectedAt: z.string().datetime(),
});

export type OrderCandidate = z.infer<typeof OrderCandidateSchema>;
export type DetectionMethod = z.infer<typeof DetectionMethodSchema>;

/** Shape of a row inserted into public.orders (snake_case, DB column names). */
export const OrderRowInsertSchema = z.object({
  user_id: z.string().uuid(),
  merchant_domain: z.string(),
  order_id: z.string(),
  amount: z.number(),
  currency: CurrencyCodeSchema,
  detected_at: z.string().datetime(),
  page_url: z.string(),
  detection_method: DetectionMethodSchema,
  confidence: z.number().int(),
  raw_signals: z.record(z.string(), z.unknown()),
});

export type OrderRowInsert = z.infer<typeof OrderRowInsertSchema>;

export const toOrderRowInsert = (userId: string, c: OrderCandidate): OrderRowInsert => ({
  user_id: userId,
  merchant_domain: c.merchantDomain,
  order_id: c.orderId,
  amount: c.amount,
  currency: c.currency,
  detected_at: c.detectedAt,
  page_url: c.pageUrl,
  detection_method: c.detectionMethod,
  confidence: c.confidence,
  raw_signals: c.rawSignals,
});
