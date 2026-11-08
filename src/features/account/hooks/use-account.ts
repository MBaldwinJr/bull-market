import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { accountService } from "../services/account-service";

export const accountKeys = {
  bot: ["bot-config"] as const,
  risk: ["risk-limits"] as const,
  paper: ["paper-account"] as const,
  assets: ["assets"] as const,
  positions: ["positions"] as const,
  orders: ["orders"] as const,
  snapshots: ["snapshots"] as const,
  riskEvents: ["risk-events"] as const,
  audit: ["audit-logs"] as const,
  strategies: ["strategies"] as const,
};

export const useBotConfig = () => useQuery({ queryKey: accountKeys.bot, queryFn: accountService.getBotConfig });
export const useRiskLimits = () => useQuery({ queryKey: accountKeys.risk, queryFn: accountService.getRiskLimits });
export const usePaperAccount = () => useQuery({ queryKey: accountKeys.paper, queryFn: accountService.getPaperAccount });
export const useAssets = () => useQuery({ queryKey: accountKeys.assets, queryFn: accountService.listAssets });
export const usePositions = () => useQuery({ queryKey: accountKeys.positions, queryFn: accountService.listPositions });
export const useOrders = () => useQuery({ queryKey: accountKeys.orders, queryFn: accountService.listOrders });
export const useSnapshots = () => useQuery({ queryKey: accountKeys.snapshots, queryFn: accountService.listSnapshots });
export const useRiskEvents = () =>
  useQuery({ queryKey: accountKeys.riskEvents, queryFn: accountService.listRiskEvents, refetchInterval: 30_000 });
export const useAuditLogs = () => useQuery({ queryKey: accountKeys.audit, queryFn: accountService.listAuditLogs });
export const useStrategies = () => useQuery({ queryKey: accountKeys.strategies, queryFn: accountService.listStrategies });

/** Wraps a service call with toast feedback and cache invalidation. */
export function useAccountMutation<TArgs>(
  fn: (args: TArgs) => Promise<void>,
  invalidate: ReadonlyArray<readonly string[]>,
  successMessage: string,
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: async () => {
      await Promise.all([...invalidate, accountKeys.audit].map((k) => qc.invalidateQueries({ queryKey: k })));
      toast.success(successMessage);
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Falha inesperada"),
  });
}
