import { describe, expect, it } from "vitest";
import {
  HOMOLOGATION_APP_ID,
  KNOWN_MAIN_SUPABASE_REF,
  isHomologationPaperBuyEnabled,
  assertHomologationPaperOrder,
} from "./staging-paper-activation.server";

const REF = "stagingreference12345";
const STAGING_URL = `https://${REF}.supabase.co`;
const approved: Record<string, string> = {
  BULL_MARKET_ENVIRONMENT: "homologacao",
  BULL_MARKET_APP_ID: HOMOLOGATION_APP_ID,
  PAPER_STAGING_APPROVED_APP_ID: HOMOLOGATION_APP_ID,
  PAPER_TRADING_ROUTE_ENABLED: "true",
  PAPER_TRADING_EXECUTION_ENABLED: "true",
  PAPER_STAGING_APPROVED_PROJECT_REF: REF,
  VITE_SUPABASE_PROJECT_ID: REF,
  SUPABASE_URL: STAGING_URL,
  VITE_SUPABASE_URL: STAGING_URL,
  PAPER_STAGING_APPROVED_SUPABASE_URL: STAGING_URL,
};

describe("isolated homologation simulated-order gate", () => {
  it("fails closed with no environment", () => {
    expect(isHomologationPaperBuyEnabled({})).toBe(false);
  });
  it("requires every independent control and keeps production denied", () => {
    expect(isHomologationPaperBuyEnabled(approved)).toBe(true);
    for (const key of Object.keys(approved)) {
      const missing = { ...approved };
      delete missing[key];
      expect(isHomologationPaperBuyEnabled(missing), `missing ${key}`).toBe(false);
    }
    for (const [key, value] of [
      ["BULL_MARKET_APP_ID", "53ab617e-c9fb-449d-a719-311a513d4a02"],
      ["BULL_MARKET_ENVIRONMENT", "production"],
      ["PAPER_TRADING_ROUTE_ENABLED", "false"],
      ["PAPER_TRADING_EXECUTION_ENABLED", "false"],
      ["SUPABASE_URL", `https://${KNOWN_MAIN_SUPABASE_REF}.supabase.co`],
      ["PAPER_STAGING_APPROVED_PROJECT_REF", KNOWN_MAIN_SUPABASE_REF],
      ["VITE_SUPABASE_PROJECT_ID", KNOWN_MAIN_SUPABASE_REF],
      ["PAPER_STAGING_APPROVED_SUPABASE_URL", "http://localhost:54321"],
      ["SUPABASE_URL", "https://other.supabase.co"],
      ["VITE_SUPABASE_URL", "https://other.supabase.co"],
      ["SUPABASE_URL", STAGING_URL + "/rpc"],
      ["SUPABASE_URL", STAGING_URL + "?anything=true"],
    ]) {
      expect(isHomologationPaperBuyEnabled({ ...approved, [key]: value }), `${key}=${value}`).toBe(false);
    }
  });
  it("accepts only conservative per-order, balance and risk limits", () => {
    const prepared = { args: { p_quantity: 0.1, p_entry_price: 50 }, totalDebit: 5.005 };
    const limits = { initial_balance: 100, max_risk_per_trade_pct: 0.5, max_daily_loss_pct: 1, max_open_positions: 1 };
    expect(() => assertHomologationPaperOrder(prepared, limits)).not.toThrow();
    for (const candidate of [
      { ...prepared, args: { p_quantity: 0.099, p_entry_price: 50 } },
      { ...prepared, args: { p_quantity: 0.201, p_entry_price: 50 } },
      { ...prepared, args: { p_quantity: Infinity, p_entry_price: 50 } },
      { ...prepared, totalDebit: 11 },
    ]) {
      expect(() => assertHomologationPaperOrder(candidate, limits)).toThrow();
    }
    for (const patch of [
      { initial_balance: 101 },
      { max_risk_per_trade_pct: 0.501 },
      { max_daily_loss_pct: 1.1 },
      { max_open_positions: 2 },
      { max_open_positions: 0 },
      { initial_balance: NaN },
    ]) {
      expect(() => assertHomologationPaperOrder(prepared, { ...limits, ...patch })).toThrow();
    }
  });
});
