#!/usr/bin/env python3
"""READ-ONLY browser inspection of the Recovery Lab preview.

Never logs in, signs up, invokes an RPC, sends a form, or permits external
fetches. An API request emitted by the page is captured by *hostname* and
aborted BEFORE it can reach Supabase. A finding is not a deployment.
"""
import json
import os
import re
import sys
from pathlib import Path
from urllib.parse import urlsplit

from playwright.sync_api import sync_playwright

PREVIEW_HOST = "id-preview--9f4c5079-0871-47c3-92ef-aa1dd05738e5.lovable.app"
PREVIEW = "https://" + PREVIEW_HOST
DENIED_REFS = {
    "dsrjwmpvauipdssopydg": "production",
    "yawdfupednxlicfogwxp": "homologation",
}
REF_PATTERN = re.compile(r"https://([a-z0-9]{20})\.supabase\.co\b")
MAX_ANALYSIS_BYTES = 8_000_000


def main():
    seen_refs = set()
    requested_refs = set()
    blocked_external = set()
    pages_ok = []
    script_responses = 0

    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True, args=["--no-sandbox"])
        context = browser.new_context(
            ignore_https_errors=False,
            service_workers="block",
        )

        def route_request(route):
            request = route.request
            parsed = urlsplit(request.url)
            if parsed.hostname == PREVIEW_HOST and parsed.scheme == "https" \
                    and request.method in ("GET", "HEAD"):
                return route.continue_()
            # Every Supabase call must be ABORTED: neither a GET nor a POST
            # reaches any real or test user's cloud database.
            if parsed.hostname and parsed.hostname.endswith(".supabase.co"):
                found = REF_PATTERN.search(parsed.scheme + "://" + parsed.hostname)
                if found:
                    requested_refs.add(found.group(1))
                return route.abort()
            if parsed.hostname:
                blocked_external.add(parsed.hostname)
            return route.abort()

        context.route("**/*", route_request)

        for path in ("/", "/auth"):
            page = context.new_page()
            try:
                def capture(response):
                    nonlocal script_responses
                    parsed = urlsplit(response.url)
                    if parsed.hostname != PREVIEW_HOST or response.status != 200:
                        return
                    content_type = response.headers.get("content-type", "")
                    if "javascript" not in content_type and "html" not in content_type \
                            and not parsed.path.endswith((".js", ".mjs")):
                        return
                    try:
                        body = response.body()
                    except Exception:
                        return
                    if len(body) > MAX_ANALYSIS_BYTES:
                        return
                    if "javascript" in content_type or parsed.path.endswith((".js", ".mjs")):
                        script_responses += 1
                    seen_refs.update(REF_PATTERN.findall(body.decode("utf-8", errors="ignore")))

                page.on("response", capture)
                response = page.goto(PREVIEW + path,
                                     wait_until="domcontentloaded",
                                     timeout=45_000)
                if response and response.status == 200:
                    pages_ok.append(path)
                page.wait_for_timeout(5_000)
            except Exception:
                pass  # Report an incomplete remote inspection as a failure.
            finally:
                page.close()

        context.close()
        browser.close()

    actual_refs = seen_refs | requested_refs
    forbidden = sorted(actual_refs.intersection(DENIED_REFS))
    report = {
        "preview": PREVIEW,
        "http_pages_ok": pages_ok,
        "javascript_assets_checked": script_responses,
        "supabase_refs_in_compiled_assets": sorted(seen_refs),
        "supabase_refs_from_aborted_requests": sorted(requested_refs),
        "external_request_hosts_blocked": sorted(blocked_external),
        "forbidden_refs_seen": forbidden,
        "inspection_is_read_only": True,
    }

    # No API keys, bearer tokens, cookies, passwords or page text in output.
    print(json.dumps(report, indent=2))
    if os.environ.get("GITHUB_STEP_SUMMARY"):
        with open(os.environ["GITHUB_STEP_SUMMARY"], "a", encoding="utf-8") as summary:
            summary.write(
                "### Recovery Lab preview — read-only check\n"
                f"- Preview HTTP 200 paths: {', '.join(pages_ok) or 'none'}\n"
                f"- JavaScript assets inspected: {script_responses}\n"
                f"- Supabase public refs observed: {', '.join(sorted(actual_refs)) or 'none'}\n"
                f"- Forbidden production/staging refs: {', '.join(forbidden) or 'none observed'}\n"
                "- External requests, including Supabase API calls, were blocked before sending.\n"
                "- **A green network check is not sufficient proof of isolated Auth/RLS or backup/restore.**\n"
            )
    if forbidden:
        raise AssertionError("Recovery Lab preview exposes a forbidden production/homologation Supabase reference")
    if not pages_ok or not script_responses or not actual_refs:
        raise AssertionError("Cannot verify effective preview origin; preview access or compiled JS is incomplete")
    if len(actual_refs) != 1:
        raise AssertionError("Recovery Lab preview loads multiple Supabase projects; isolation not proven")
    print("PASS: no forbidden Supabase reference observed in read-only browser inspection")


if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        print(f"FAIL: {type(e).__name__}: {e}", file=sys.stderr)
        sys.exit(1)
