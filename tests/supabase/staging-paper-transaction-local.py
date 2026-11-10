#!/usr/bin/env python3
"""Prove ONE persisted paper buy on throwaway local Supabase, never on remote DB.

This script requires only Supabase CLI-generated localhost credentials. It does
not connect to exchanges, call application deployments, or read GitHub secrets.
The GitHub runner destroys the local database at the end of the job.
"""
import json
import os
import re
import secrets
import sys
import urllib.error
import urllib.request
from datetime import datetime, timezone
from decimal import Decimal
from pathlib import Path
from urllib.parse import urlsplit


def require(condition, label):
    if not condition:
        raise AssertionError(label)


def local_env():
    values = {}
    for line in Path(os.environ["SUPABASE_LOCAL_ENV_FILE"]).read_text().splitlines():
        if "=" not in line or line.lstrip().startswith("#"):
            name, value = line.split("=", 1)
            values[name.strip()] = value.strip().strip("'\"")
    url = values.get("API_URL", "").rstrip("/")
    parsed = urlsplit(url)
    require(parsed.scheme == "http"
            and parsed.hostname in ("localhost", "127.0.0.1")
            and parsed.port == 54321
            and not parsed.username and not parsed.password
            and parsed.path == "" and not parsed.query and not parsed.fragment,
            "DENIED: non-local Supabase URL")
    anon = values.get("ANON_KEY") or values.get("PUBLISHABLE_KEY")
    service = values.get("SERVICE_ROLE_KEY") or values.get("SECRET_KEY")
    require(anon and service and anon != service, "Missing distinct local Supabase keys")
    return url, anon, service


BASE, ANON, SERVICE = local_env()


def request(method, path, key, payload=None, bearer=None, *, return_rows=False):
    # Strictly relative localhost paths: never accept a full URL or redirect to
    # an exchange or external project.
    require(path.startswith("/") and not path.startswith("//")
            and "://" not in path, "Refusing non-local request")
    headers = {"apikey": key, "Accept": "application/json"}
    token = bearer or (key if key.startswith("eyJ") else None)
    if token:
        headers["Authorization"] = "Bearer " + token
    if return_rows:
        headers["Prefer"] = "return=representation"
    body = None
    if payload is not None:
        headers["Content-Type"] = "application/json"
        body = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(BASE + path, headers=headers, data=body, method=method)
    try:
        with urllib.request.urlopen(req, timeout=25) as response:
            raw = response.read()
            return response.status, json.loads(raw.decode()) if raw else None
    except urllib.error.HTTPError as exc:
        raw = exc.read(2048)
        try:
            response = json.loads(raw)
        except (ValueError, UnicodeDecodeError):
            response = {}
        # Response is not logged, as it may carry details from the DB.
        return exc.code, response


def succeeded(result, label):
    status, data = result
    require(200 <= status < 300, f"{label}: unexpected HTTP {status}")
    return data


def rows(table, key, bearer=None, query=""):
    path = f"/rest/v1/{table}?select=*"
    if query:
        path += "&" + query
    data = succeeded(request("GET", path, key, bearer=bearer), f"{table} SELECT")
    require(isinstance(data, list), f"{table}: non-array response")
    return data


def update(table, owner, fields, query=""):
    path = f"/rest/v1/{table}?owner_id=eq.{owner}"
    if query:
        path += "&" + query
    path += "&select=*"
    data = succeeded(request("PATCH", path, SERVICE, fields, return_rows=True),
                     f"{table} PATCH")
    require(isinstance(data, list) and len(data) == 1, f"{table}: expected one update")
    return data[0]


def signup(label):
    email = f"paper-local-{label}-{secrets.token_hex(6)}@example.invalid"
    password = secrets.token_urlsafe(30) + "Aa1!"
    result = succeeded(request("POST", "/auth/v1/signup", ANON, {
        "email": email, "password": password, "data": {"display_name": f"CI Paper {label}"},
    }), "local Auth signup")
    user = result.get("user") or result
    owner = user.get("id")
    require(isinstance(owner, str) and re.fullmatch(
        r"[0-9a-f]{8}-[0-9a-f-]{27}", owner), "Invalid Auth ID")
    token = result.get("access_token")
    if not token:
        login = succeeded(request("POST", "/auth/v1/token?grant_type=password", ANON, {
            "email": email, "password": password,
        }), "local Auth token")
        token = login.get("access_token")
    require(isinstance(token, str) and token.count(".") == 2, "Missing signed local JWT")
    verified = succeeded(request("GET", "/auth/v1/user", ANON, bearer=token), "Auth /user")
    require(verified.get("id") == owner, "JWT subject differs from Auth user")
    return owner, token


def paper_counts(owner):
    return {
        name: len(rows(name, SERVICE, query=f"owner_id=eq.{owner}"))
        for name in ("paper_orders", "paper_positions", "audit_logs")
    }


def account(owner):
    data = rows("paper_accounts", SERVICE, query=f"owner_id=eq.{owner}")
    require(len(data) == 1, "Expected one owner paper account")
    return data[0]


def attempted_buy(owner, client_order_id, quantity, key=SERVICE, bearer=None):
    return request("POST", "/rest/v1/rpc/execute_paper_buy", key, bearer=bearer, payload={
        "p_owner_id": owner,
        "p_client_order_id": client_order_id,
        "p_symbol": "BTCUSDT",
        "p_strategy_key": "ema",
        "p_quantity": quantity,
        "p_entry_price": "50",
        "p_stop_loss": "49.75",
        "p_fee_rate": "0.001",
        "p_quote_at": datetime.now(timezone.utc).isoformat(),
    })


def assert_rejected(result, message):
    status, payload = result
    require(status >= 400, "Unexpectedly accepted a prohibited paper buy")
    desc = payload.get("message", "") if isinstance(payload, dict) else ""
    require(message in desc, "Unexpected paper buy rejection reason")


def main():
    for table in ("paper_accounts", "paper_orders", "paper_positions", "audit_logs"):
        require(rows(table, SERVICE) == [], f"Local fixture not empty: {table}")

    owner_a, jwt_a = signup("a")
    owner_b, jwt_b = signup("b")
    require(owner_a != owner_b, "Duplicated Auth identity")
    require(paper_counts(owner_a) == paper_counts(owner_b) == {
        "paper_orders": 0, "paper_positions": 0, "audit_logs": 0,
    }, "Unexpected activity after signup")

    updated_account = update("paper_accounts", owner_a,
                             {"initial_balance": "100", "cash_balance": "100"})
    require(Decimal(str(updated_account["cash_balance"])) == Decimal("100"),
            "Paper account not initialized")
    bot = update("bot_config", owner_a, {
        "status": "running", "trading_mode": "paper", "live_trading_enabled": False,
        "allow_withdrawals": False, "binance_testnet": True,
    })
    limits = update("risk_limits", owner_a, {
        "max_risk_per_trade_pct": "0.5", "max_daily_loss_pct": "1",
        "max_open_positions": 1, "leverage": 0, "stop_loss_required": True,
    })
    update("assets", owner_a, {"auto_trade_enabled": True}, "symbol=eq.BTCUSDT")
    update("trading_strategies", owner_a, {"enabled": True}, "strategy_key=eq.ema")
    require(bot["live_trading_enabled"] is False and bot["allow_withdrawals"] is False
            and bot["trading_mode"] == "paper" and limits["max_open_positions"] == 1,
            "Unsafe fixture configuration")
    require(Decimal(str(account(owner_b)["cash_balance"])) == Decimal("0"),
            "Foreign account unexpectedly received balance")

    # An authenticated browser may NEVER execute the service_role RPC.
    unauth = attempted_buy(owner_a, "local-auth-denied-001", "0.1",
                           key=ANON, bearer=jwt_a)
    require(unauth[0] in (401, 403, 404), "Authenticated user unexpectedly has RPC privilege")
    require(paper_counts(owner_a)["paper_orders"] == 0, "Unauthorized RPC created an order")

    assert_rejected(attempted_buy(owner_a, "local-under-five-001", "0.09998"),
                    "Paper buy notional below 5 USDT")
    require(paper_counts(owner_a)["paper_orders"] == 0, "Invalid notional created an order")

    order_id = succeeded(attempted_buy(owner_a, "local-exact-five-001", "0.1"),
                         "service_role paper BUY")
    require(isinstance(order_id, str) and re.fullmatch(r"[0-9a-f-]{36}", order_id),
            "Paper RPC did not return order UUID")
    order = rows("paper_orders", SERVICE, query=f"owner_id=eq.{owner_a}")
    pos = rows("paper_positions", SERVICE, query=f"owner_id=eq.{owner_a}")
    audit = rows("audit_logs", SERVICE, query=f"owner_id=eq.{owner_a}")
    cash = account(owner_a)
    require(len(order) == len(pos) == len(audit) == 1, "Atomic BUY entries missing")
    require(order[0]["id"] == order_id and order[0]["client_order_id"] == "local-exact-five-001"
            and order[0]["side"] == "buy" and order[0]["status"] == "filled"
            and order[0]["source"] == "paper", "Paper order inconsistent")
    require(pos[0]["id"] == order[0]["position_id"]
            and pos[0]["status"] == "open" and pos[0]["source"] == "paper",
            "Paper position inconsistent")
    require(audit[0]["action"] == "paper_buy" and audit[0]["source"] == "paper",
            "Paper audit missing")
    require(Decimal(str(cash["cash_balance"])) == Decimal("94.995"),
            "Paper cash must equal 100 - 5 - 0.005")
    require(cash.get("first_trade_at") is not None, "First-trade marker missing")

    assert_rejected(attempted_buy(owner_a, "local-exact-five-001", "0.1"),
                    "Duplicate client order id")
    assert_rejected(attempted_buy(owner_a, "local-second-position-001", "0.1"),
                    "Position limit reached")

    # Row isolation with real JWTs AFTER a persisted simulated trade.
    own_orders = rows("paper_orders", ANON, bearer=jwt_a)
    foreign_orders = rows("paper_orders", ANON, bearer=jwt_b)
    require(len(own_orders) == 1 and own_orders[0]["owner_id"] == owner_a,
            "Owner cannot see their simulated order")
    require(foreign_orders == [] and rows("paper_positions", ANON, bearer=jwt_b) == [],
            "Foreign session can read another user's trade")
    require(rows("paper_orders", ANON) == [], "Anonymous order visibility")
    require(paper_counts(owner_a) == {
        "paper_orders": 1, "paper_positions": 1, "audit_logs": 1,
    }, "Repeated or rejected RPC had side effects")
    require(paper_counts(owner_b) == {
        "paper_orders": 0, "paper_positions": 0, "audit_logs": 0,
    }, "Second user's account was modified")
    require(Decimal(str(account(owner_a)["cash_balance"])) == Decimal("94.995"),
            "Invalid/duplicate RPC changed cash")
    print("PASS: genuine local Supabase Auth and JWT isolation; real persisted paper BUY "
          "of exactly 5 USDT; 94.995 virtual cash; 1 order, 1 position, 1 audit; "
          "minimum, duplication, second position and unauthorized calls rejected. "
          "No remote/exchange calls.")


if __name__ == "__main__":
    try:
        main()
    except (AssertionError, KeyError, ValueError, OSError) as exc:
        # Do not log API credentials, JWTs, request bodies, user emails or IDs.
        print(f"FAIL: isolated paper RPC test: {exc}", file=sys.stderr)
        raise SystemExit(1) from None
