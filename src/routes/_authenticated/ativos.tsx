import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { PageHeader, Panel } from "@/components/trading/panel";
import { QueryView } from "@/components/trading/state-views";
import { accountKeys, useAccountMutation, useAssets } from "@/features/account/hooks/use-account";
import { accountService, type Asset } from "@/features/account/services/account-service";
import { symbolSchema } from "@/features/account/schemas";
import { useCheckSymbol } from "@/features/market/hooks/use-market";
import { pageHead } from "@/lib/seo";

export const Route = createFileRoute("/_authenticated/ativos")({
  head: () => pageHead("Ativos", "Gerencie a lista de ativos monitorados."),
  component: AssetsPage,
});

function AssetsPage() {
  const assets = useAssets();
  const check = useCheckSymbol();
  const [symbol, setSymbol] = useState("");
  const [checking, setChecking] = useState(false);
  const add = useAccountMutation(
    (a: { symbol: string; base: string; quote: string }) => accountService.addAsset(a.symbol, a.base, a.quote),
    [accountKeys.assets],
    "Ativo adicionado",
  );
  const remove = useAccountMutation((a: Asset) => accountService.removeAsset(a), [accountKeys.assets], "Ativo removido");

  const onAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = symbolSchema.safeParse(symbol);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Símbolo inválido");
      return;
    }
    setChecking(true);
    try {
      const info = await check({ data: { symbol: parsed.data } });
      if (!info) {
        toast.error("Par não disponível para negociação na Binance Spot");
        return;
      }
      add.mutate({ symbol: parsed.data, base: info.base, quote: info.quote });
      setSymbol("");
    } catch {
      toast.error("Não foi possível validar o par na Binance");
    } finally {
      setChecking(false);
    }
  };

  return (
    <>
      <PageHeader title="Ativos" description="Ativos monitorados. Monitorar não significa negociar automaticamente." />
      <Panel title="Adicionar ativo" className="mb-4">
        <form onSubmit={onAdd} className="flex gap-2">
          <Input aria-label="Símbolo" placeholder="Ex.: XRPUSDT" value={symbol} onChange={(e) => setSymbol(e.target.value)} className="max-w-xs" />
          <Button type="submit" disabled={checking || add.isPending}>
            {checking ? "Validando…" : "Adicionar"}
          </Button>
        </form>
      </Panel>
      <Panel title="Lista">
        <QueryView query={assets} isEmpty={(d) => d.length === 0}>
          {(list) => (
            <ul className="divide-y">
              {list.map((a) => (
                <li key={a.id} className="flex items-center justify-between py-2">
                  <div>
                    <span className="font-semibold">{a.symbol}</span>
                    <span className="ml-2 text-xs text-muted-foreground">
                      {a.base_asset}/{a.quote_asset} · auto-trade {a.auto_trade_enabled ? "permitido" : "desligado"}
                    </span>
                  </div>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="icon" aria-label={`Remover ${a.symbol}`}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Remover {a.symbol}?</AlertDialogTitle>
                        <AlertDialogDescription>O ativo deixa de ser monitorado. O histórico é preservado.</AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={() => remove.mutate(a)}>Remover</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </li>
              ))}
            </ul>
          )}
        </QueryView>
      </Panel>
    </>
  );
}
