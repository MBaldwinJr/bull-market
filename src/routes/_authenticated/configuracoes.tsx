import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { accountKeys, useAccountMutation, usePaperAccount, usePositions } from "@/features/account/hooks/use-account";
import { accountService, type PaperAccount } from "@/features/account/services/account-service";
import { paperBalanceSchema } from "@/features/account/schemas";
import { toNumber } from "@/lib/format";
import { pageHead } from "@/lib/seo";

export const Route = createFileRoute("/_authenticated/configuracoes")({
  head: () => pageHead("Configurações", "Saldo virtual e preferências da conta simulada."),
  component: SettingsPage,
});

function BalanceForm({ account, hasOpen }: { account: PaperAccount; hasOpen: boolean }) {
  const [value, setValue] = useState(String(toNumber(account.initial_balance)));
  const save = useAccountMutation(
    (n: number) => accountService.setPaperBalance(account, n),
    [accountKeys.paper],
    "Saldo virtual redefinido",
  );
  const submit = () => {
    const parsed = paperBalanceSchema.safeParse({ initial_balance: Number(value) });
    if (!parsed.success) {
      toast.error("Valor inválido");
      return;
    }
    save.mutate(parsed.data.initial_balance);
  };
  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <Label htmlFor="balance">Saldo virtual inicial ({account.quote_currency})</Label>
        <Input id="balance" type="number" min={0} value={value} onChange={(e) => setValue(e.target.value)} className="max-w-xs" />
      </div>
      {hasOpen && <p className="text-xs text-warning">Feche as posições simuladas antes de redefinir o saldo.</p>}
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button disabled={hasOpen || save.isPending}>Redefinir saldo</Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Redefinir saldo virtual?</AlertDialogTitle>
            <AlertDialogDescription>O saldo disponível volta ao valor informado. Valor fictício, sem dinheiro real.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={submit}>Confirmar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function SettingsPage() {
  const account = usePaperAccount();
  const positions = usePositions();
  const hasOpen = (positions.data ?? []).some((p) => p.status === "open");
  return (
    <>
      <PageHeader title="Configurações" />
      <Panel title="Paper Trading">
        <QueryView query={account}>{(a) => <BalanceForm account={a} hasOpen={hasOpen} />}</QueryView>
      </Panel>
    </>
  );
}
