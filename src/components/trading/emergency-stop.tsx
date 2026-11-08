import { OctagonX } from "lucide-react";
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
import { Button } from "@/components/ui/button";
import { accountKeys, useAccountMutation, useBotConfig } from "@/features/account/hooks/use-account";
import { accountService } from "@/features/account/services/account-service";

/** Halts Paper Trading and blocks new simulated entries. Does not liquidate anything. */
export function EmergencyStop({ size = "sm" }: { size?: "sm" | "default" }) {
  const bot = useBotConfig();
  const mutation = useAccountMutation(
    (id: string) => accountService.setBotStatus(id, "emergency_stopped"),
    [accountKeys.bot, accountKeys.riskEvents],
    "Parada de emergência ativada",
  );
  const disabled = !bot.data || bot.data.status === "emergency_stopped" || mutation.isPending;

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="destructive" size={size} disabled={disabled}>
          <OctagonX className="mr-1 h-4 w-4" /> Parada de emergência
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Acionar parada de emergência?</AlertDialogTitle>
          <AlertDialogDescription>
            O Paper Trading será interrompido e novas entradas simuladas ficarão bloqueadas. Posições simuladas abertas não
            são encerradas automaticamente. Nenhuma ordem real existe neste sistema.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={() => bot.data && mutation.mutate(bot.data.id)}>Confirmar parada</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
