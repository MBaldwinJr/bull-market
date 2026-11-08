# Lovable mobile preview smoke test — 2026-11-08

Preview: https://lovable.dev/preview/F6Kv39VMYRiBVs18cd16SihtTnsve6zt

Evidence: two owner-provided Android screenshots of sidebar and dashboard, 19:59 local. Screenshots are not automated end-to-end tests.

## Observed
- Private authenticated UI is visible; left sidebar includes Dashboard, Mercado, Ativos, Estratégias, Sinais, IA, Trading Bot, Paper Trading, Backtesting, Portfólio, Histórico, Gestão de risco, Relatórios, Conexões, Configurações, Segurança, Logs.
- Header labels 'Sistema online' and 'MODO PAPER'; sidebar says 'Robô: Simulando'. These are UI labels, not proof of backend health or live strategy execution.
- Red 'Parada de emergência' status/banner visible; root cause and actual kill-switch state unknown.
- Yellow warning says simulated initial balance is undefined; displayed balances, P&L, orders and positions are zero.
- Market ticker is horizontally scrollable, with some clipped text in the captured viewport.
- Mobile drawer covers most of the viewport as expected for a modal drawer, but can be assessed for compactness and accessibility.

## Priority validation
1. **P0** Investigate whether emergency stop is active, why, and whether it blocks simulated orders. Do not auto-clear a risk stop.
2. **P0** Verify initial balance setup via Settings and server-side persistence; first-trade balance lock must not be tested as secure before migration 0001 is confirmed applied.
3. **P0** Verify database migration history and integrity triggers on Lovable Cloud. GitHub merge alone is insufficient.
4. **P1** Test private login, sign-out, page reload, sidebar navigation and responsive layout.
5. **P1** Verify ticker horizontal scroll affordance, clipping and touch behavior on narrow screens.
6. **P1** Verify simulated orders, positions, history and risk display after backend readiness is confirmed.

## Safety
Do not enable live trading, exchange withdrawals or public registration for preview tests. No Lovable AI-agent messages needed for visual checks.

## Current verdict
UI preview is available and renders on Android. Financial simulation is **not yet verified end to end**.
