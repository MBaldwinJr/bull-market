#!/usr/bin/env python3
"""Integration checks against a disposable LOCAL Supabase Auth + PostgREST stack.

Do not set a remote Supabase URL or use production/staging credentials.
GitHub Actions creates and deletes its own local database for every run.
"""
import json
import os
import secrets
import sys
import urllib.error
import urllib.request
from pathlib import Path
from urllib.parse import urlsplit


def check(condition, message):
    if not condition:
        raise AssertionError(message)


def load_local_credentials():
    env_file = Path(os.environ["SUPABASE_LOCAL_ENV_FILE"])
    data = {}
    for line in env_file.read_text().splitlines():
        if "=" not in line or line.lstrip().startswith("#"):
            continue
        name, value = line.split("=", 1)
        data[name.strip()] = value.strip().strip('"').strip("'")
    endpoint = data.get("API_URL", "").rstrip("/")
    url = urlsplit(endpoint)
    check(url.scheme == "http" and url.hostname in ("localhost", "127.0.0.1")
          and url.port == 54321 and not url.username and not url.password,
          "Refusing to test anything except the local Supabase API on port 54321")
    anon = data.get("ANON_KEY") or data.get("PUBLISHABLE_KEY")
    service = data.get("SERVICE_ROLE_KEY") or data.get("SECRET_KEY")
    check(bool(anon and service), "Missing locally generated API keys")
    return endpoint, anon, service


BASE_URL, ANON_KEY, SERVICE_KEY = load_local_credentials()


def auth_headers(key, bearer=None):
    result = {"apikey": key, "Accept": "application/json"}
    if bearer:
        result["Authorization"] = f"Bearer {bearer}"
    elif key.startswith("eyJ"):
        result["Authorization"] = f"Bearer {key}"
    return result


def call(method, path, key, bearer=None, payload=None, extra_headers=None):
    headers = auth_headers(key, bearer)
    if extra_headers:
        headers.update(extra_headers)
    content = None
    if payload is not None:
        headers["Content-Type"] = "application/json"
        content = json.dumps(payload).encode("utf-8")
    request = urllib.request.Request(BASE_URL + path, data=content, method=method, headers=headers)
    try:
        with urllib.request.urlopen(request, timeout=20) as response:
            result = response.read()
            return json.loads(result.decode("utf-8")) if result else None
    except urllib.error.HTTPError as exc:
        # Never print request bodies, credentials, email or bearer tokens to CI logs.
        raise AssertionError(f"{method} {path.split('?')[0]} returned HTTP {exc.code}") from None


def rows(table, key, bearer=None, filter_query=""):
    path = f"/rest/v1/{table}?select=*"
    if filter_query:
        path += "&" + filter_query
    result = call("GET", path, key, bearer)
    check(isinstance(result, list), f"Unexpected REST response for {table}")
    return result


def sign_up(name):
    password = secrets.token_urlsafe(32) + "Aa1!"
    email = f"ci-{name.lower().replace(' ', '-')}-{secrets.token_hex(6)}@example.invalid"
    result = call("POST", "/auth/v1/signup", ANON_KEY, payload={
        "email": email, "password": password, "data": {"display_name": name}
    })
    user = result.get("user") or result
    user_id = user.get("id")
    check(isinstance(user_id, str) and len(user_id) == 36,
          "Supabase Auth did not create a valid user UUID")
    token = result.get("access_token")
    if not token:
        login = call("POST", "/auth/v1/token?grant_type=password", ANON_KEY,
                     payload={"email": email, "password": password})
        token = login.get("access_token")
    check(bool(token), "Supabase Auth did not issue a valid session token")
    identity = call("GET", "/auth/v1/user", ANON_KEY, bearer=token)
    check(identity.get("id") == user_id, "Auth token does not belong to newly registered user")
    return user_id, token


def assert_bootstrap_for(owner_id, name):
    for table, expected in (
        ("profiles", 1), ("bot_config", 1), ("risk_limits", 1),
        ("paper_accounts", 1), ("assets", 5), ("trading_strategies", 7)
    ):
        owner_column = "id" if table == "profiles" else "owner_id"
        entries = rows(table, SERVICE_KEY, filter_query=f"{owner_column}=eq.{owner_id}")
        check(len(entries) == expected,
              f"{table} bootstrap count mismatch: expected {expected}, got {len(entries)}")
        if table == "profiles":
            check(entries[0]["display_name"] == name, "Profile metadata not propagated")
        elif table == "paper_accounts":
            account = entries[0]
            check(float(account["cash_balance"]) == 0 and float(account["initial_balance"]) == 0
                  and account["source"] == "paper", "Unsafe opening account defaults")
        elif table == "bot_config":
            cfg = entries[0]
            check(cfg["status"] == "stopped" and cfg["trading_mode"] == "paper"
                  and cfg["live_trading_enabled"] is False
                  and cfg["allow_withdrawals"] is False
                  and cfg["binance_testnet"] is True, "Unsafe bot defaults")
        elif table == "risk_limits":
            check(entries[0]["leverage"] == 0 and entries[0]["stop_loss_required"] is True,
                  "Unsafe risk defaults")
        elif table == "assets":
            check(all(row["auto_trade_enabled"] is False for row in entries),
                  "Asset auto-trading unexpectedly enabled")
        elif table == "trading_strategies":
            check(all(row["enabled"] is False for row in entries),
                  "Trading strategy unexpectedly enabled")


def assert_isolation(owners):
    expected_counts = {
        "profiles": 1, "bot_config": 1, "risk_limits": 1, "paper_accounts": 1,
        "assets": 5, "trading_strategies": 7,
    }
    for index, (owner_id, token) in enumerate(owners):
        other_id = owners[1 - index][0]
        for table, expected in expected_counts.items():
            own = rows(table, ANON_KEY, bearer=token)
            col = "id" if table == "profiles" else "owner_id"
            check(len(own) == expected and all(r[col] == owner_id for r in own),
                  f"RLS own-row visibility failed on {table}")
            foreign = rows(table, ANON_KEY, bearer=token,
                           filter_query=f"{col}=eq.{other_id}")
            check(not foreign, f"RLS leaked another user's {table}")
        check(rows("paper_orders", ANON_KEY, bearer=token) == [], "Unexpected paper order")
        check(rows("paper_positions", ANON_KEY, bearer=token) == [], "Unexpected paper position")

    for table in expected_counts:
        check(not rows(table, ANON_KEY),
              f"Anonymous request read private data in {table}")

    # Attempt an unauthorized profile update via a REAL authenticated JWT.
    owner_id, token = owners[0]
    foreign_id = owners[1][0]
    changed = call("PATCH", f"/rest/v1/profiles?id=eq.{foreign_id}", ANON_KEY,
                   bearer=token, payload={"display_name": "UNAUTHORIZED_EDIT"},
                   extra_headers={"Prefer": "return=representation"})
    check(changed == [], "Cross-user profile update unexpectedly succeeded")
    preserved = rows("profiles", SERVICE_KEY, filter_query=f"id=eq.{foreign_id}")
    check(len(preserved) == 1 and preserved[0]["display_name"] == "CI User B",
          "Cross-user profile data was modified")


def main():
    for table in (
        "profiles", "bot_config", "risk_limits", "paper_accounts",
        "assets", "trading_strategies", "paper_orders", "paper_positions", "audit_logs"
    ):
        check(not rows(table, SERVICE_KEY), f"Non-empty disposable fixture: {table}")

    owner_a = sign_up("CI User A")
    owner_b = sign_up("CI User B")
    check(owner_a[0] != owner_b[0], "User IDs not unique")
    assert_bootstrap_for(owner_a[0], "CI User A")
    assert_bootstrap_for(owner_b[0], "CI User B")
    assert_isolation((owner_a, owner_b))

    for table in ("paper_orders", "paper_positions", "audit_logs"):
        check(not rows(table, SERVICE_KEY), f"Unexpected trade/audit writes in {table}")
    print("PASS: 2 genuine Supabase Auth signups, 16 bootstrap rows per user, "
          "JWT RLS isolation, cross-user update rejection, zero trades.")


if __name__ == "__main__":
    try:
        main()
    except (AssertionError, OSError, ValueError, KeyError) as exc:
        print(f"FAIL: {exc}", file=sys.stderr)
        raise SystemExit(1) from None
