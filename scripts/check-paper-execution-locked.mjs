import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";

const read = (path) => readFileSync(path, "utf8");
const ui = read("src/features/trading/components/manual-paper-order-activation.ts");
const disabledGate = read("src/features/trading/server/paper-buy-execution-gate.server.ts");
const preparation = read("src/features/trading/services/paper-buy.functions.ts");
const controlled = read("src/features/trading/server/paper-buy-controlled-executor.server.ts");
const preview = read("src/features/trading/components/manual-paper-order-preview.tsx");

assert.match(ui, /export const MANUAL_PAPER_ORDER_UI_ENABLED\s*=\s*false\b/,
  "Manual purchase UI flag must stay explicitly false");
assert.match(disabledGate, /status:\s*["']execution_disabled["']/,
  "Default execution gate must return execution_disabled");
assert.match(disabledGate, /executed:\s*false/,
  "Default execution gate must explicitly refuse execution");
assert.doesNotMatch(disabledGate, /\.(?:rpc|insert|update|upsert|delete)\s*\(/,
  "Default gate must not touch the database or execute RPC");
assert.doesNotMatch(disabledGate, /\bexecutePaperBuyWithApproval\s*\(/,
  "Default gate must not call the controlled executor");

assert.match(preparation, /status:\s*["']prepared_only["']/,
  "Server preparation must return prepared_only");
assert.match(preparation, /executed:\s*false/,
  "Server preparation must state no execution took place");
assert.doesNotMatch(preparation,
  /\.(?:rpc|insert|update|upsert|delete)\s*\(|\bexecutePaperBuyWithApproval\s*\(|\bexecutePreparedPaperBuy\s*\(/,
  "Server preparation must not execute orders or write data");
assert.doesNotMatch(preparation, /SUPABASE_SERVICE_ROLE_KEY|service_role/,
  "Server preparation must not load service-role credentials");

assert.match(controlled,
  /!dependencies\.enabled\s*\|\|\s*process\.env\["PAPER_TRADING_EXECUTION_ENABLED"\]\s*!==\s*"true"/,
  "Controlled executor must require BOTH explicit independent gates");
assert.match(controlled, /dependencies\.rpc\("execute_paper_buy"/,
  "Controlled executor must be restricted to paper trading RPC");
assert.doesNotMatch(controlled, /binance.*order|withdraw/i,
  "Controlled executor must not call exchange order or withdrawal APIs");

assert.match(preview, /disabled=\{!eligible\}/,
  "Manual purchase button must be disabled when UI activation flag is false");
assert.doesNotMatch(preview, /executePaperBuyWithApproval|executePreparedPaperBuy|\.rpc\(/,
  "Preview component must never execute a trade");

// A separately gated homologation-only BUY path may be present, but must
// never weaken the existing disabled button or the two independent server switches.
const stagingServer = read("src/features/trading/server/staging-paper-activation.server.ts");
const stagingClient = read("src/features/trading/components/homologation-paper-buy-gate.ts");
const submitServer = read("src/features/trading/services/paper-buy-submit.functions.ts");
assert.match(stagingServer, /KNOWN_MAIN_SUPABASE_REF/, "Staging gate must reject the main database");
assert.match(stagingServer, /PAPER_STAGING_APPROVED_SUPABASE_URL/, "Server must require exact approved DB URL");
assert.match(stagingServer, /PAPER_TRADING_ROUTE_ENABLED/, "Server must require route switch");
assert.match(stagingServer, /PAPER_TRADING_EXECUTION_ENABLED/, "Server must require execution switch");
assert.match(stagingClient, /HOMOLOGATION_APP_ID/, "Only known staging preview may show the order button");
assert.match(preview, /canShowHomologationPaperBuy\(/, "Staging control must be hidden by default");
assert.match(submitServer, /if \(!isHomologationPaperBuyEnabled\(process\.env\)\)/,
  "Server submission must fail closed before using admin credentials");
assert.match(submitServer, /assertHomologationPaperOrder\(prepared, stageLimits\)/,
  "Server submission must independently cap each paper purchase");

for (const path of readdirSync(".github/workflows").filter((name) => /\.ya?ml$/.test(name))) {
  const body = read(".github/workflows/" + path);
  assert.doesNotMatch(body,
    /^\s*PAPER_TRADING_EXECUTION_ENABLED:\s*["']?true["']?\s*(?:#.*)?$/im,
    "Workflow " + path + " must never enable paper execution");
}
console.log("PASS: UI, server preparation, default execution gate and CI all remain fail-closed.");
