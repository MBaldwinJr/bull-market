import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const sql = readFileSync('drizzle/migrations/0001_paper_account_integrity.sql','utf8');
const journal = JSON.parse(readFileSync('drizzle/migrations/meta/_journal.json','utf8'));
const required = [
  /ADD COLUMN IF NOT EXISTS first_trade_at/i,
  /FOR UPDATE;/i,
  /CREATE TRIGGER trg_lock_paper_account_before_order/i,
  /CREATE TRIGGER trg_lock_paper_account_before_position/i,
  /CREATE TRIGGER trg_guard_paper_account_initial_balance/i,
  /REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public\.paper_accounts/i,
  /GRANT UPDATE \(initial_balance\) ON public\.paper_accounts TO authenticated/i,
  /DROP POLICY IF EXISTS "own audit insert"/i,
  /DROP POLICY IF EXISTS "own risk events insert"/i,
];
for (const pattern of required) assert.match(sql, pattern, 'Missing safety invariant: ' + pattern);
assert.equal(journal.entries.filter(e => e.tag === '0001_paper_account_integrity').length, 1, 'Expected exactly one 0001 journal entry');
assert.doesNotMatch(sql, /\b(?:INSERT|UPDATE|DELETE|TRUNCATE)\s+ON\s+public\.(?:paper_orders|paper_positions|audit_logs|risk_events|portfolio_snapshots)\s+TO\s+authenticated/i);
const executableSql = sql.replace(/--[^\r\n]*/g, '');
assert.doesNotMatch(executableSql, /REVOKE[^;]*\bMAINTAIN\b/i, 'MAINTAIN requires PostgreSQL 17+');
console.log('Static migration checks passed. Database runtime, RLS, concurrency and deployment remain unverified.');
