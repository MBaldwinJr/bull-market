#!/usr/bin/env bash
set -euo pipefail
# Runs only in disposable GitHub Actions PostgreSQL, never production.
owner='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
export PGOPTIONS='-c request.jwt.claim.role=service_role'
psql -v ON_ERROR_STOP=1 -c "UPDATE public.paper_accounts SET cash_balance=100 WHERE owner_id='$owner'; DELETE FROM public.audit_logs; DELETE FROM public.paper_orders; DELETE FROM public.paper_positions;" >/dev/null
# Two independent transactions race for the same 100 USDT balance.
psql -v ON_ERROR_STOP=1 -c "SELECT public.execute_paper_buy('$owner','race-order-0001','BTCUSDT','test_strategy',1.5,50,49.75,0.001,now());" >/tmp/paper-race-1.log 2>&1 &
p1=$!
psql -v ON_ERROR_STOP=1 -c "SELECT public.execute_paper_buy('$owner','race-order-0002','BTCUSDT','test_strategy',1.5,50,49.75,0.001,now());" >/tmp/paper-race-2.log 2>&1 &
p2=$!
set +e
wait "$p1"; r1=$?
wait "$p2"; r2=$?
set -e
if [[ $(( (r1 == 0) + (r2 == 0) )) -ne 1 ]]; then
  cat /tmp/paper-race-{1,2}.log
  echo 'Expected exactly one successful purchase' >&2; exit 1
fi
psql -v ON_ERROR_STOP=1 -At -c "SELECT CASE WHEN cash_balance=24.925 AND (SELECT count(*) FROM public.paper_orders)=1 AND (SELECT count(*) FROM public.paper_positions)=1 AND (SELECT count(*) FROM public.audit_logs)=1 THEN 'PASS' ELSE 'FAIL' END FROM public.paper_accounts WHERE owner_id='$owner';" | grep -qx PASS
echo 'Concurrent purchases serialized successfully'
