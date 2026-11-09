<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.

## What Lovable manages

Rules outside this block are the project's own. Change the pieces below in
Lovable, not by hand. With the [Lovable MCP](https://mcp.lovable.dev)
connected, `send_message` asks Lovable to do it; otherwise ask the user to
use the editor.

- **Database.** Do not add or edit `supabase/migrations/` or `drizzle/`.
  Ask Lovable to change the schema.
- **Generated files.** Do not edit a file whose header says it is automatically
  generated.
- **AI gateway.** Keep model calls on Lovable's gateway, and keep
  `LOVABLE_API_KEY` out of browser code.
- **Connectors.** Lovable provides native connectors. `list_connectors` shows
  which are enabled; `add_connector` only returns the dashboard link. When a
  connector is enabled, calls go through the connector gateway and need
  `LOVABLE_API_KEY`. When Lovable does not provide one, users can bring their
  own key and store it in Secrets.
- **Secrets.** Lovable manages them. Do not put secret values in the repo.
<!-- LOVABLE:END -->

## Project rules
- Features live in `src/features/<feature>/{components,hooks,services,utils}`; components use hooks, hooks use services — keeps data access out of UI.
- Live trading is impossible by design: DB CHECK constraints + `src/lib/trading-config.ts`; never add a UI or route that enables production execution.
- Market data comes only from Binance public endpoints via server functions in `src/features/market/services`; no exchange keys ever reach the browser.
- Paper orders/positions/snapshots are read-only for users (RLS); only the external FastAPI engine (service role) writes them — see `docs/backend-fastapi.md`.
- The authenticated paper-buy server boundary prepares migration-0002 RPC arguments only, retains them server-side, and has no executor or UI caller; this permits security validation without enabling trades before separate migration/execution authorization.
- Modules waiting on the FastAPI engine render `ModulePending` instead of fake data.
- `vite.config.ts` carries a fallback for the public backend URL/publishable key because `.env` is git-ignored and publish builds can't read it; only public values belong there.
