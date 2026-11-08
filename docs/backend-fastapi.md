# TRADING AI — Contrato do backend FastAPI

O frontend (este projeto) cuida de interface, autenticação, configuração e leitura de dados.
O motor contínuo (workers de mercado, estratégias, risco, paper trading, testnet) roda em
Python/FastAPI numa VPS com Docker Compose. Ele **não** roda no navegador nem em funções serverless.

## Fluxo

```text
Navegador ──(JWT da sessão)──> FastAPI (VPS) ──> Banco (Lovable Cloud / Postgres)
                                           └──> Binance pública / Testnet
```

- O FastAPI valida o JWT do usuário (emitido pela autenticação do Lovable Cloud) em toda rota privada.
- Escrita de ordens, posições e snapshots é feita só pelo backend (service role). O navegador apenas lê
  `paper_orders`, `paper_positions`, `portfolio_snapshots` (RLS: somente leitura para o dono).
- O backend deve respeitar `bot_config.status`: `running` permite novas entradas simuladas;
  `stopped` e `emergency_stopped` bloqueiam novas entradas (sem liquidar posições).

## Endpoints esperados (OpenAPI em `/docs`)

| Método | Rota | Uso |
|---|---|---|
| GET | /api/v1/health | liveness |
| GET | /api/v1/dashboard | métricas agregadas |
| GET | /api/v1/market/assets · quotes · candles | dados de mercado |
| GET/POST | /api/v1/strategies | estratégias |
| GET | /api/v1/signals | sinais pontuados |
| GET | /api/v1/portfolio · positions · orders · trades | carteira simulada |
| GET | /api/v1/risk · PUT /api/v1/risk/config | Risk Engine |
| POST | /api/v1/paper/start · stop · emergency-stop | controle |
| POST | /api/v1/backtest/run | backtesting |
| GET | /api/v1/reports/performance | relatórios |
| GET | /api/v1/system/status | saúde |

Não existe, e não deve existir, rota para habilitar produção.

## .env.example (backend)

```env
TRADING_MODE=paper
LIVE_TRADING_ENABLED=false
BINANCE_TESTNET=true
ALLOW_WITHDRAWALS=false
BINANCE_TESTNET_API_KEY=
BINANCE_TESTNET_API_SECRET=
SECRETS_ENCRYPTION_KEY=
DATABASE_URL=
REDIS_URL=redis://redis:6379/0
SUPABASE_JWT_ISSUER=
```

O backend deve recusar iniciar se `LIVE_TRADING_ENABLED != false` ou `TRADING_MODE` não for `paper`/`testnet`.
O banco também rejeita essas mudanças via CHECK constraints em `bot_config` e `risk_limits`.
