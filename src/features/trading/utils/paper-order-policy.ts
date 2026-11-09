/**
 * Internal minimum simulated order size, denominated in the quote asset USDT.
 * This is a Bull Market testing policy, NOT a claim about Kraken/Binance
 * exchange minimum lots or filters.
 *
 * Must be enforced by both server preflight and the UI; future activation
 * requires a corresponding atomic database guard before actual paper writes.
 */
export const MIN_PAPER_BUY_NOTIONAL_USDT = 5;
