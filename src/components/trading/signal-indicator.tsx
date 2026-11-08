import { memo } from "react";
import { SCORE_BAND_LABEL, scoreBand, type ScoreBand } from "@/features/market/utils/indicators";
import { cn } from "@/lib/utils";

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
      <div className="h-1.5 w-20 overflow-hidden rounded-full bg-muted" role="meter" aria-valuenow={score} aria-valuemin={0} aria-valuemax={100} aria-label="Pontuação">
        <div className="h-full bg-primary" style={{ width: `${score}%` }} />
      </div>
      <span className="tabular w-7 text-right text-sm font-semibold">{score}</span>
      <span className={cn("rounded-sm px-1.5 py-0.5 text-[10px] font-semibold uppercase", BAND_CLASS[band])}>
        {SCORE_BAND_LABEL[band]}
      </span>
    </div>
  );
});
