import { describe, expect, it } from "vitest";
import {
  RECOVERY_LAB_LOVABLE_ID,
  FORBIDDEN_SUPABASE_REFS,
  assertIsolatedRecoveryBuild,
} from "./recovery-lab-build-guard";

// Fake ref and key are synthetic CI fixtures; they are NOT credentials and
// MUST NOT be treated as a deployable backend.
const FAKE_REF = "zzzzzzzzzzzzzzzzzzzz";
const safeFixture: Record<string, string> = {
  BULL_MARKET_DEPLOY_TARGET: "recovery-lab",
  VITE_BULL_MARKET_APP_ID: RECOVERY_LAB_LOVABLE_ID,
  VITE_SUPABASE_PROJECT_ID: FAKE_REF,
  RECOVERY_LAB_APPROVED_PROJECT_REF: FAKE_REF,
  VITE_SUPABASE_URL: `https://${FAKE_REF}.supabase.co`,
  VITE_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_ci_only_not_a_real_key",
  SUPABASE_URL: `https://${FAKE_REF}.supabase.co`,
  SUPABASE_PUBLISHABLE_KEY: "sb_publishable_ci_only_not_a_real_key",
  PAPER_TRADING_ROUTE_ENABLED: "false",
  PAPER_TRADING_EXECUTION_ENABLED: "false",
  VITE_PAPER_STAGING_UI_ENABLED: "false",
};

describe("Recovery Lab build must never use production or staging data", () => {
  it("denies builds without explicitly configured, isolated backend", () => {
    expect(() => assertIsolatedRecoveryBuild({})).toThrow("build denied");
    expect(() => assertIsolatedRecoveryBuild(safeFixture)).not.toThrow();
    for (const key of [
      "BULL_MARKET_DEPLOY_TARGET",
      "VITE_BULL_MARKET_APP_ID",
      "RECOVERY_LAB_APPROVED_PROJECT_REF",
      "VITE_SUPABASE_PROJECT_ID",
      "VITE_SUPABASE_URL",
      "VITE_SUPABASE_PUBLISHABLE_KEY",
    ]) {
      const without = { ...safeFixture };
      delete without[key];
      expect(() => assertIsolatedRecoveryBuild(without), `missing ${key}`).toThrow("build denied");
    }
  });

  it("categorically refuses both known business databases, even when explicitly approved", () => {
    for (const ref of FORBIDDEN_SUPABASE_REFS) {
      const candidate = {
        ...safeFixture,
        VITE_SUPABASE_PROJECT_ID: ref,
        RECOVERY_LAB_APPROVED_PROJECT_REF: ref,
        VITE_SUPABASE_URL: `https://${ref}.supabase.co`,
        SUPABASE_URL: `https://${ref}.supabase.co`,
      };
      expect(() => assertIsolatedRecoveryBuild(candidate), ref).toThrow("forbidden");
    }
  });

  it.each([
    ["wrong Lovable app", { VITE_BULL_MARKET_APP_ID: "a37675cf-7419-49cd-87c3-74203b93f3e7" }],
    ["wrong target", { BULL_MARKET_DEPLOY_TARGET: "homologacao" }],
    ["missing approval", { RECOVERY_LAB_APPROVED_PROJECT_REF: "" }],
    ["mismatched ref", { RECOVERY_LAB_APPROVED_PROJECT_REF: "aaaaaaaaaaaaaaaaaaaa" }],
    ["mismatched URL", { VITE_SUPABASE_URL: "https://unrelated.supabase.co" }],
    ["insecure URL", { VITE_SUPABASE_URL: `http://${FAKE_REF}.supabase.co` }],
    ["URL trailing slash", { VITE_SUPABASE_URL: `https://${FAKE_REF}.supabase.co/` }],
    ["server different DB", { SUPABASE_URL: "https://dsrjwmpvauipdssopydg.supabase.co" }],
    ["server different key", { SUPABASE_PUBLISHABLE_KEY: "sb_publishable_different" }],
    ["not a publishable key", { VITE_SUPABASE_PUBLISHABLE_KEY: "sb_secret_not_public" }],
    ["paper server route", { PAPER_TRADING_ROUTE_ENABLED: "true" }],
    ["paper executor", { PAPER_TRADING_EXECUTION_ENABLED: "true" }],
    ["manual paper buy", { VITE_PAPER_STAGING_UI_ENABLED: "true" }],
  ])("rejects unsafe case: %s", (_label, patch) => {
    expect(() => assertIsolatedRecoveryBuild({ ...safeFixture, ...patch })).toThrow("build denied");
  });
});
