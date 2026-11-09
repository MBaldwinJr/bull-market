import { z } from "zod";
import { paperBuyRequestSchema } from "./paper-buy-schema";

/**
 * An explicit confirmation phrase is required before submitting a simulated
 * order. This is not a substitute for server authorization and risk checks.
 */
export const confirmedPaperBuySchema = paperBuyRequestSchema.extend({
  confirmation: z.literal("CONFIRMAR COMPRA SIMULADA"),
}).strict();

export type ConfirmedPaperBuyRequest = z.infer<typeof confirmedPaperBuySchema>;
