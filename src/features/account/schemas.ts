import { z } from "zod";

/** Risk limits accepted from the UI. Mirrors DB constraints; leverage and stop-loss are fixed. */
export const riskLimitsSchema = z.object({
  max_risk_per_trade_pct: z.number().gt(0, "Deve ser maior que 0").max(2, "Máximo de 2% por operação"),
  max_daily_loss_pct: z.number().gt(0, "Deve ser maior que 0").max(5, "Máximo de 5% ao dia"),
  max_open_positions: z.number().int().min(1).max(10),
  take_profit_pct: z.number().gt(0).max(100).nullable(),
});
export type RiskLimitsInput = z.infer<typeof riskLimitsSchema>;

export const paperBalanceSchema = z.object({
  initial_balance: z.number().min(0).max(100_000_000),
});

/** Any attempt to switch to live trading is rejected here as well as in the database. */
export const botConfigSchema = z.object({
  trading_mode: z.enum(["paper", "testnet"]),
  live_trading_enabled: z.literal(false),
  allow_withdrawals: z.literal(false),
});

export const symbolSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z0-9]{2,20}$/, "Use o formato BTCUSDT");
