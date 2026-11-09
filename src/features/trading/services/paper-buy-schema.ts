import { z } from "zod";

/** Ownership, price, fees and safety settings are never accepted from the browser. */
export const paperBuyRequestSchema = z.object({
  clientOrderId: z.string().regex(/^[A-Za-z0-9_-]{8,128}$/),
  symbol: z.string().regex(/^[A-Z0-9]{2,20}$/),
  strategyKey: z.string().min(1).max(128),
  quantity: z.number().finite().positive(),
  stopPrice: z.number().finite().positive(),
}).strict();

export type PaperBuyRequest = z.infer<typeof paperBuyRequestSchema>;