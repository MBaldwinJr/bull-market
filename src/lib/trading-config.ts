/**
 * Safety locks. These mirror the backend env (TRADING_MODE, LIVE_TRADING_ENABLED,
 * BINANCE_TESTNET, ALLOW_WITHDRAWALS) and the database CHECK constraints.
 * The UI never offers a way to change them.
 */
export const TRADING_LOCKS = Object.freeze({
  TRADING_MODE: "paper",
  LIVE_TRADING_ENABLED: false,
  BINANCE_TESTNET: true,
  ALLOW_WITHDRAWALS: false,
} as const);

export type ExecutionVenue = "paper" | "testnet" | "live";

export class LiveTradingBlockedError extends Error {
  constructor() {
    super("Operações reais estão bloqueadas neste sistema.");
    this.name = "LiveTradingBlockedError";
  }
}

/** Throws for any venue other than paper/testnet. */
export function assertNonLiveVenue(venue: ExecutionVenue): void {
  if (venue === "live" || TRADING_LOCKS.LIVE_TRADING_ENABLED !== false) {
    throw new LiveTradingBlockedError();
  }
}

export const DEFAULT_WATCHLIST: readonly string[] = [
  "BTCUSDT",
  "ETHUSDT",
  "BNBUSDT",
  "SOLUSDT",
  "USDCUSDT",
];
