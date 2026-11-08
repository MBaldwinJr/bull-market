export interface Candle {
  readonly openTime: number;
  readonly open: number;
  readonly high: number;
  readonly low: number;
  readonly close: number;
  readonly volume: number;
  readonly closeTime: number;
}

/** Drops candles still forming at `now` to avoid look-ahead bias. */
export function closedCandles(candles: readonly Candle[], now: number): Candle[] {
  return candles.filter((c) => c.closeTime < now);
}

export function ema(values: readonly number[], period: number): number[] {
  if (period <= 0 || values.length < period) return [];
  const k = 2 / (period + 1);
  const seed = values.slice(0, period).reduce((a, b) => a + b, 0) / period;
  const out: number[] = [seed];
  for (let i = period; i < values.length; i++) {
    out.push((values[i] ?? 0) * k + (out[out.length - 1] ?? 0) * (1 - k));
  }
  return out;
}

/** Wilder RSI. Returns null when not enough data. */
export function rsi(values: readonly number[], period = 14): number | null {
  if (values.length <= period) return null;
  let gain = 0;
  let loss = 0;
  for (let i = 1; i <= period; i++) {
    const d = (values[i] ?? 0) - (values[i - 1] ?? 0);
    if (d >= 0) gain += d;
    else loss -= d;
  }
  let avgGain = gain / period;
  let avgLoss = loss / period;
  for (let i = period + 1; i < values.length; i++) {
    const d = (values[i] ?? 0) - (values[i - 1] ?? 0);
    avgGain = (avgGain * (period - 1) + Math.max(d, 0)) / period;
    avgLoss = (avgLoss * (period - 1) + Math.max(-d, 0)) / period;
  }
  if (avgLoss === 0) return 100;
  return 100 - 100 / (1 + avgGain / avgLoss);
}

export function atr(candles: readonly Candle[], period = 14): number | null {
  if (candles.length <= period) return null;
  const trs: number[] = [];
  for (let i = 1; i < candles.length; i++) {
    const c = candles[i]!;
    const prev = candles[i - 1]!.close;
    trs.push(Math.max(c.high - c.low, Math.abs(c.high - prev), Math.abs(c.low - prev)));
  }
  let value = trs.slice(0, period).reduce((a, b) => a + b, 0) / period;
  for (let i = period; i < trs.length; i++) value = (value * (period - 1) + (trs[i] ?? 0)) / period;
  return value;
}

export function vwap(candles: readonly Candle[]): number | null {
  let pv = 0;
  let vol = 0;
  for (const c of candles) {
    pv += ((c.high + c.low + c.close) / 3) * c.volume;
    vol += c.volume;
  }
  return vol > 0 ? pv / vol : null;
}

export type Trend = "alta" | "baixa" | "lateral";

export interface IndicatorSnapshot {
  readonly lastClose: number;
  readonly ema9: number | null;
  readonly ema21: number | null;
  readonly ema200: number | null;
  readonly rsi14: number | null;
  readonly atr14: number | null;
  readonly vwap: number | null;
  readonly trend: Trend;
  readonly score: number;
  readonly candlesUsed: number;
}

const last = (arr: readonly number[]): number | null => (arr.length ? arr[arr.length - 1] : null);

/**
 * Reproducible 0–100 score (trend 30, momentum 25, volume/VWAP 20, volatility 15, confirmation 10).
 * It is NOT a probability of profit.
 */
export function computeIndicators(candles: readonly Candle[]): IndicatorSnapshot | null {
  if (candles.length < 30) return null;
  const closes = candles.map((c) => c.close);
  const lastClose = closes[closes.length - 1] ?? 0;
  const e9 = last(ema(closes, 9));
  const e21 = last(ema(closes, 21));
  const e200 = last(ema(closes, 200));
  const r = rsi(closes, 14);
  const a = atr(candles, 14);
  const v = vwap(candles.slice(-24));

  let trend: Trend = "lateral";
  if (e9 !== null && e21 !== null) {
    if (e9 > e21 && (e200 === null || lastClose > e200)) trend = "alta";
    else if (e9 < e21 && (e200 === null || lastClose < e200)) trend = "baixa";
  }

  let score = 0;
  if (trend === "alta") score += 30;
  else if (trend === "lateral") score += 10;
  if (r !== null) {
    if (r >= 50 && r <= 70) score += 25;
    else if (r > 40 && r < 50) score += 12;
  }
  if (v !== null && lastClose > v) score += 20;
  if (a !== null) {
    const atrPct = (a / lastClose) * 100;
    if (atrPct >= 0.2 && atrPct <= 3) score += 15;
    else if (atrPct < 6) score += 5;
  }
  if (trend === "alta" && r !== null && r > 50 && v !== null && lastClose > v) score += 10;

  return {
    lastClose,
    ema9: e9,
    ema21: e21,
    ema200: e200,
    rsi14: r,
    atr14: a,
    vwap: v,
    trend,
    score: Math.min(100, score),
    candlesUsed: candles.length,
  };
}

export type ScoreBand = "descartada" | "observacao" | "avaliacao" | "forte" | "confluencia";

export function scoreBand(score: number): ScoreBand {
  if (score < 40) return "descartada";
  if (score < 60) return "observacao";
  if (score < 75) return "avaliacao";
  if (score < 90) return "forte";
  return "confluencia";
}

export const SCORE_BAND_LABEL: Readonly<Record<ScoreBand, string>> = {
  descartada: "Descartada",
  observacao: "Observação",
  avaliacao: "Em avaliação",
  forte: "Sinal forte",
  confluencia: "Alta confluência",
};
