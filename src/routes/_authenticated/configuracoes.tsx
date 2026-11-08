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
import { accountKeys, useAccountMutation, usePaperAccount, usePositions, useOrders } from "@/features/account/hooks/use-account";
import { accountService, type PaperAccount } from "@/features/account/services/account-service";
import { paperBalanceSchema } from "@/features/account/schemas";
import { toNumber } from "@/lib/format";
import { pageHead } from "@/lib/seo";

export const Route = createFileRoute("/_authenticated/configuracoes")({
  head: () => pageHead("Configurações", "Saldo virtual e preferências da conta simulada."),
  component: SettingsPage,
});

function BalanceForm({
  account,
  hasActivity,
  activityLoading,
}: {
  account: PaperAccount;
  hasActivity: boolean;
  activityLoading: boolean;
}) {
  const [value, setValue] = useState(String(toNumber(account.initial_balance)));
  const save = useAccountMutation(
    (n: number) => accountService.setPaperBalance(account, n),
    [accountKeys.paper],
    "Saldo virtual inicial atualizado",
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
        <Input id="balance" type="number" min={0} value={value} onChange={(e) => setValue(e.target.value)} className="max-w-xs" disabled={hasActivity || activityLoading} />
      </div>
      {activityLoading && <p className="text-xs text-muted-foreground">Verificando se a conta já realizou a primeira operação...</p>}
      {hasActivity && (
        <p className="text-xs text-warning">
          O saldo inicial fica bloqueado após a primeira ordem ou posição simulada. A partir daí, somente o motor de trading pode alterar os saldos operacionais.
        </p>
      )}
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button disabled={hasActivity || activityLoading || save.isPending}>Salvar saldo inicial</Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Definir saldo inicial virtual?</AlertDialogTitle>
            <AlertDialogDescription>
              O saldo disponível será inicializado com o mesmo valor. Essa configuração só pode ser feita antes da primeira operação simulada. Nenhum dinheiro real será movimentado.
            </AlertDialogDescription>
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
  const orders = useOrders();
  const hasActivity = (positions.data?.length ?? 0) > 0 || (orders.data?.length ?? 0) > 0;
  const activityLoading = positions.isLoading || orders.isLoading;

  return (
    <>
      <PageHeader title="Configurações" />
      <Panel title="Paper Trading">
        <QueryView query={account}>
          {(a) => <BalanceForm account={a} hasActivity={hasActivity} activityLoading={activityLoading} />}
        </QueryView>
      </Panel>
    </>
  );
}
