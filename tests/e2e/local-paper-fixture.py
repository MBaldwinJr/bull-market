#!/usr/bin/env python3
"""Prepare one genuine user in a throwaway LOCAL Supabase database.

This script intentionally never contacts a hosted Supabase project.
It enables only paper-mode *configuration* on a local fixture so the UI's
read-only preflight can be exercised. It never calls execute_paper_buy.
"""
import json
import os
import secrets
import stat
import sys
import urllib.error
import urllib.request
from pathlib import Path
from urllib.parse import urlsplit

ENV_FILE = Path(os.environ["SUPABASE_LOCAL_ENV_FILE"])
OUTPUT = Path(os.environ["E2E_FIXTURE_FILE"])


def require(value, description):
    if not value:
        raise AssertionError(description)
    return value


def get_local_env():
    items = {}
    for line in ENV_FILE.read_text().splitlines():
        if "=" in line and not line.lstrip().startswith("#"):
            key, value = line.split("=", 1)
            items[key.strip()] = value.strip().strip("'\"")
    url = require(items.get("API_URL"), "Missing Supabase local API_URL").rstrip("/")
    parsed = urlsplit(url)
    require(parsed.scheme == "http" and parsed.hostname in ("127.0.0.1", "localhost")
            and parsed.port == 54321 and not parsed.username and not parsed.password,
            "Refusing any non-local Supabase URL")
    anon = require(items.get("ANON_KEY") or items.get("PUBLISHABLE_KEY"), "Missing local anon key")
    service = require(items.get("SERVICE_ROLE_KEY") or items.get("SECRET_KEY"), "Missing local service key")
    return url, anon, service


URL, ANON, SERVICE = get_local_env()


def api(method, path, key, payload=None):
    headers = {"apikey": key, "Accept": "application/json"}
    if key.startswith("eyJ"):
        headers["Authorization"] = "Bearer " + key
    data = None
    if payload is not None:
        headers["Content-Type"] = "application/json"
        data = json.dumps(payload).encode()
    req = urllib.request.Request(URL + path, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=20) as response:
            data = response.read()
            return json.loads(data) if data else None
    except urllib.error.HTTPError as exc:
        raise AssertionError(f"Local Supabase {method} {path.split('?')[0]}: HTTP {exc.code}") from None


def update(table, user_id, body):
    result = api("PATCH", f"/rest/v1/{table}?owner_id=eq.{user_id}&select=*", SERVICE, body)
    # PostgREST defaults to no returned rows without Prefer: return=representation.
    assert result is None or isinstance(result, list)


def check_zero_trades():
    for table in ("paper_orders", "paper_positions", "audit_logs"):
        records = api("GET", f"/rest/v1/{table}?select=id", SERVICE)
        require(records == [], "Fixture unexpectedly has persisted activity in " + table)


def main():
    require(not OUTPUT.exists(), "Refusing to overwrite existing local fixture file")
    preexisting = api("GET", "/rest/v1/profiles?select=id", SERVICE)
    require(preexisting == [], "Local Supabase is not a fresh disposable database")
    check_zero_trades()

    email = f"ci-http-{secrets.token_hex(7)}@example.invalid"
    password = secrets.token_urlsafe(32) + "Aa1!"
    signup = api("POST", "/auth/v1/signup", ANON, {
        "email": email, "password": password, "data": {"display_name": "Local HTTP CI"},
    })
    user = signup.get("user") or signup
    user_id = require(user.get("id"), "Signup did not create an Auth user")

    token = signup.get("access_token")
    if not token:
        signed_in = api("POST", "/auth/v1/token?grant_type=password", ANON, {
            "email": email, "password": password,
        })
        token = signed_in.get("access_token")
    require(token, "Local Auth did not issue a session")

    # No real money, no exchange connectivity, no withdrawal permissions.
    update("paper_accounts", user_id, {"initial_balance": 100, "cash_balance": 100})
    update("bot_config", user_id, {
        "status": "running", "trading_mode": "paper",
        "live_trading_enabled": False, "allow_withdrawals": False,
        "binance_testnet": True,
    })
    api("PATCH", f"/rest/v1/assets?owner_id=eq.{user_id}&symbol=eq.BTCUSDT",
        SERVICE, {"auto_trade_enabled": True})
    api("PATCH", f"/rest/v1/trading_strategies?owner_id=eq.{user_id}&strategy_key=eq.ema",
        SERVICE, {"enabled": True})

    account = api("GET", f"/rest/v1/paper_accounts?owner_id=eq.{user_id}&select=*", SERVICE)
    bot = api("GET", f"/rest/v1/bot_config?owner_id=eq.{user_id}&select=*", SERVICE)
    asset = api("GET", f"/rest/v1/assets?owner_id=eq.{user_id}&symbol=eq.BTCUSDT&select=*", SERVICE)
    strategy = api("GET", f"/rest/v1/trading_strategies?owner_id=eq.{user_id}&strategy_key=eq.ema&select=*", SERVICE)

    require(len(account) == 1 and float(account[0]["cash_balance"]) == 100
            and float(account[0]["initial_balance"]) == 100, "Invalid paper balance")
    require(len(bot) == 1 and bot[0]["status"] == "running"
            and bot[0]["trading_mode"] == "paper"
            and bot[0]["live_trading_enabled"] is False
            and bot[0]["allow_withdrawals"] is False, "Unsafe local bot config")
    require(len(asset) == 1 and asset[0]["auto_trade_enabled"] is True, "Asset not set")
    require(len(strategy) == 1 and strategy[0]["enabled"] is True, "Strategy not set")
    check_zero_trades()

    # Credentials are written to runner temp, not stdout or GitHub artifacts.
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    fd = os.open(OUTPUT, os.O_WRONLY | os.O_CREAT | os.O_EXCL, stat.S_IRUSR | stat.S_IWUSR)
    with os.fdopen(fd, "w") as stream:
        json.dump({"email": email, "password": password, "user_id": user_id}, stream)
    print("PASS: local Auth signup and isolated paper-only read-preflight fixture (zero trades)")


if __name__ == "__main__":
    try:
        main()
    except (AssertionError, OSError, KeyError, ValueError) as exc:
        print(f"FAIL: {exc}", file=sys.stderr)
        raise SystemExit(1) from None
