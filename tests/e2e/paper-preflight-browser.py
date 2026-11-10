#!/usr/bin/env python3
"""Real browser HTTP smoke test against GitHub runner localhost only.

No trade submission is attempted, even via a disabled endpoint.
The server price is deterministic and mocked only by the CI preload.
"""
import json
import os
import re
import sys
import urllib.request
from pathlib import Path
from urllib.parse import urlsplit

from playwright.sync_api import sync_playwright, expect

APP = "http://127.0.0.1:4173"
PHASE = "not_started"
SAFE_UI = ""
LOCAL_API = "http://127.0.0.1:54321"


def check(value, message):
    if not value:
        raise AssertionError(message)


def read_env():
    items = {}
    for line in Path(os.environ["SUPABASE_LOCAL_ENV_FILE"]).read_text().splitlines():
        if "=" in line and not line.lstrip().startswith("#"):
            key, val = line.split("=", 1)
            items[key.strip()] = val.strip().strip("'\"")
    check(items.get("API_URL", "").rstrip("/") == LOCAL_API, "Supabase must be local")
    key = items.get("SERVICE_ROLE_KEY") or items.get("SECRET_KEY")
    check(key, "Local service role key unavailable")
    return key


def service_rows(table, service_key, owner_id):
    req = urllib.request.Request(f"{LOCAL_API}/rest/v1/{table}?owner_id=eq.{owner_id}&select=*",
                                 headers={"apikey": service_key, "Authorization": "Bearer " + service_key})
    with urllib.request.urlopen(req, timeout=20) as res:
        return json.loads(res.read())


def assert_unmodified(service_key, owner_id):
    account = service_rows("paper_accounts", service_key, owner_id)
    check(len(account) == 1 and float(account[0]["cash_balance"]) == 100,
          "Browser test unexpectedly modified the paper account")
    for table in ("paper_orders", "paper_positions", "audit_logs"):
        check(service_rows(table, service_key, owner_id) == [],
              "Browser test unexpectedly wrote " + table)


def browser_test():
    global PHASE, SAFE_UI
    PHASE = "starting_browser"
    credentials = json.loads(Path(os.environ["E2E_FIXTURE_FILE"]).read_text())
    service_key = read_env()
    owner_id = credentials["user_id"]
    assert_unmodified(service_key, owner_id)
    post_urls = []
    blocked_hosts = set()
    local_auth_statuses = []
    app_console_error_count = [0]

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True, args=["--no-sandbox"])
        context = browser.new_context(base_url=APP)
        page = context.new_page()

        def block_external(route):
            url = urlsplit(route.request.url)
            if url.hostname not in ("127.0.0.1", "localhost"):
                blocked_hosts.add(url.hostname or "unknown")
                return route.abort()
            return route.continue_()

        context.route("**/*", block_external)
        page.on("response", lambda response: local_auth_statuses.append(response.status) if
                response.url.startswith(LOCAL_API + "/auth/v1/token") else None)
        page.on("pageerror", lambda _error: app_console_error_count.__setitem__(0, app_console_error_count[0] + 1))
        PHASE = "opening_auth_page"
        page.goto("/auth", wait_until="domcontentloaded", timeout=60000)
        page.locator("#email").fill(credentials["email"])
        page.locator("#password").fill(credentials["password"])
        PHASE = "submitting_auth_login"
        page.get_by_role("button", name="Entrar", exact=True).click()

        # Auth happens through the real local Supabase GoTrue HTTP service.
        PHASE = "waiting_for_dashboard"
        try:
            expect(page.get_by_text("Compra simulada — preparação")).to_be_visible(timeout=45000)
        except Exception:
            SAFE_UI = ("current_route=" + urlsplit(page.url).path
                       + ", login_visible=" + str(page.get_by_role("button", name="Entrar", exact=True).count())
                       + ", dashboard_heading=" + str(page.get_by_text("Dashboard", exact=True).count())
                       + ", blocked_hostnames=" + str(sorted(blocked_hosts))
                       + ", local_auth_http_status=" + str(local_auth_statuses)
                       + ", page_errors=" + str(app_console_error_count[0]))
            raise
        send = page.get_by_role("button", name="Envio desabilitado")
        expect(send).to_be_disabled()

        page.get_by_label("Par", exact=True).fill("BTCUSDT")
        page.get_by_label("Quantidade simulada").fill("0.0001")
        page.get_by_label("Stop-loss", exact=False).fill("49999")
        page.get_by_label("Estratégia").fill("ema")
        page.get_by_label("Confirmação").fill("CONFIRMAR COMPRA SIMULADA")

        verify = page.get_by_role("button", name="Validar compra sem executar")
        PHASE = "waiting_for_readiness"
        try:
            expect(verify).to_be_enabled(timeout=45000)
        except Exception:
            SAFE_UI = "current_route=" + urlsplit(page.url).path + ", ready_count=" + str(page.get_by_text("Configurações básicas presentes.", exact=False).count()) + ", blocked_count=" + str(page.get_by_text("não está", exact=False).count()) + ", preflight_button=" + str(verify.count())
            raise

        def on_response(response):
            if response.request.method == "POST" and response.url.startswith(APP + "/"):
                post_urls.append(response)

        page.on("response", on_response)
        PHASE = "calling_prepared_only_http"
        verify.click()
        expect(page.get_by_text(re.compile("Preparação validada, sem execução:"))).to_be_visible(timeout=40000)
        expect(send).to_be_disabled()

        PHASE = "verifying_http_receipt"
        check(post_urls, "No same-origin HTTP POST observed from browser preflight")
        check(any("prepared_only" in response.text() for response in post_urls),
              "Server did not return a prepared_only receipt over HTTP")

        # Below-minimum order must be non-submittable before the server request.
        page.get_by_label("Quantidade simulada").fill("0.00009")
        expect(verify).to_be_disabled(timeout=15000)
        expect(send).to_be_disabled()

        context.close()
        browser.close()

    assert_unmodified(service_key, owner_id)
    print("PASS: real-browser Auth login, same-origin server HTTP prepared_only, "
          "minimum 5 USDT UI rejection, permanently disabled submit, zero trades")


if __name__ == "__main__":
    try:
        browser_test()
    except Exception as exc:
        # Test credentials and tokens are never printed.
        print("FAIL: localhost-only browser preflight: phase=" + PHASE +
              ", error_type=" + type(exc).__name__ + ", " + SAFE_UI, file=sys.stderr)
        raise SystemExit(1) from None
