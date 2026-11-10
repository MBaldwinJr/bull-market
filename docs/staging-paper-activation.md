# Bull Market — autorização restrita de Paper Trading na homologação

Status: **implementação preparada em branch separada; NÃO implantada**.

O operador autorizou somente Paper Trading com saldo fictício, sem operações reais e sem saques. A visualização fica no Lovable, mas o código e os testes devem ser desenvolvidos e revisados no GitHub.

## Escopo funcional

A branch adiciona exclusivamente a possibilidade de **compra simulada manual** no aplicativo da homologação, dependente de:
- login Supabase Auth verificado no servidor;
- confirmação literal "CONFIRMAR COMPRA SIMULADA" e pré-verificação recente;
- no máximo **10 USDT** por ordem, no mínimo **5 USDT**;
- capital inicial de **até 100 USDT**;
- risco por operação de no máximo **0,5%**, perda diária de no máximo **1%**, posição simultânea máxima **1**, alavancagem **0**;
- `trading_mode=paper`, `live_trading_enabled=false`, `allow_withdrawals=false` e `stop_loss_required=true`;
- verificação atômica da função `execute_paper_buy` e chave service_role usada **apenas no servidor**;
- idempotência: mesmo ID de ordem é reutilizado após uma falha ambígua; após execução confirmada, o botão bloqueia outro envio até edição.

Esta alteração **não implementa venda/fechamento de posições**, robô autônomo, saques nem execução real na corretora. Não afirmar que "trading completo" está ativo.

## Configuração que obrigatoriamente deve existir SOMENTE na implantação isolada de homologação

No servidor, as seguintes variáveis devem ser fornecidas pelo ambiente protegido:

```text
BULL_MARKET_ENVIRONMENT=homologacao
BULL_MARKET_APP_ID=a37675cf-7419-49cd-87c3-74203b93f3e7
PAPER_STAGING_APPROVED_APP_ID=a37675cf-7419-49cd-87c3-74203b93f3e7
PAPER_STAGING_APPROVED_PROJECT_REF=<ref EXATO do Supabase de homologação>
PAPER_STAGING_APPROVED_SUPABASE_URL=https://<ref EXATO>.supabase.co
PAPER_TRADING_ROUTE_ENABLED=true
PAPER_TRADING_EXECUTION_ENABLED=true
SUPABASE_URL=https://<ref EXATO>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<chave service_role EXCLUSIVA DA HOMOLOGAÇÃO; NÃO no navegador>
```

No build do frontend **somente da homologação**:

```text
VITE_BULL_MARKET_APP_ID=a37675cf-7419-49cd-87c3-74203b93f3e7
VITE_PAPER_STAGING_UI_ENABLED=true
VITE_SUPABASE_URL=https://<ref EXATO>.supabase.co
VITE_SUPABASE_PROJECT_ID=<ref EXATO do Supabase de homologação>
VITE_SUPABASE_PUBLISHABLE_KEY=<chave pública EXCLUSIVA DA HOMOLOGAÇÃO>
```

O código **rejeita** o backend principal de fallback (`dsrjwmpvauipdssopydg`) e exige igualdade entre URL/ID aprovados e URL/ID reais. O botão só pode surgir na prévia do app de homologação `a37675cf-7419-49cd-87c3-74203b93f3e7`. Variáveis ausentes ou inconsistentes mantêm tudo bloqueado. Nunca copiar essas flags para produção ou CI de desenvolvimento genérico.

## Checklist obrigatório antes de ativar as flags remotas

1. **Provar** que o GitHub da homologação aponta exclusivamente ao banco certo, sem fallback para produção. Não basta o rótulo do ambiente.
2. **Restaurar um backup real** em outro banco descartável e validar integridade. Não restaurar em cima da produção/homologação.
3. Validar com usuário descartável autenticação JWT e RLS no ambiente remoto de homologação.
4. Confirmar migrations `0001`, `0002`, `0004`, ACL só service_role para `execute_paper_buy`, gatilho de cadastro, limites e flags de segurança.
5. Confirmar acesso à prévia isolada, rollback, parada de emergência e monitoração de ordem/posição/auditoria.
6. Confirmar se é necessário desenvolver fluxo de venda/fechamento **antes de qualquer compra persistente**.
7. Após revisão e sinal verde, ativar exclusivamente o servidor e o build desta homologação. Não executar compra por script nem automaticamente. Primeira execução somente manual.

**Estado atual:** não existe automação GitHub→ambiente remoto habilitada/validada nesta branch, e as URLs/segredos de homologação não estão disponíveis aqui. Um merge no GitHub por si só não altera variáveis de runtime e não equivale a ativação.
