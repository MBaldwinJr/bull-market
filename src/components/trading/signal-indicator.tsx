import { memo } from "react";
import { SCORE_BAND_LABEL, scoreBand, type ScoreBand } from "@/features/market/utils/indicators";
import { cn } from "@/lib/utils";
import { Progress } from "@/components/ui/progress";

const BAND_CLASS: Readonly<Record<ScoreBand, string>> = {
  descartada: "bg-muted text-muted-foreground",
  observacao: "bg-accent text-accent-foreground",
  avaliacao: "bg-warning/20 text-warning",
  forte: "bg-primary/20 text-primary",
  confluencia: "bg-primary text-primary-foreground",
};

export const SignalIndicator = memo(function SignalIndicator({ score }: { score: number }) {
  const band = scoreBand(score);
  return (
    <div className="flex items-center gap-2">
      <Progress value={score} className="h-1.5 w-20" aria-label="Pontuação" />
  );
});
