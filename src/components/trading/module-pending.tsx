import { Construction } from "lucide-react";

/** Honest placeholder for modules that depend on the FastAPI engine (not yet connected). */
export function ModulePending({
  phase,
  dependsOn,
  features,
}: {
  phase: string;
  dependsOn: string;
  features: readonly string[];
}) {
  return (
    <div className="rounded-md border border-dashed bg-card p-6">
      <div className="mb-3 flex items-center gap-2">
        <Construction className="h-5 w-5 text-warning" aria-hidden />
        <span className="rounded-sm bg-warning px-1.5 py-0.5 text-[10px] font-bold text-warning-foreground">{phase}</span>
        <span className="text-sm font-medium">Módulo ainda não disponível</span>
      </div>
      <p className="text-sm text-muted-foreground">
        Depende de: <span className="text-foreground">{dependsOn}</span>. Nenhum dado é simulado nesta tela até a integração existir.
      </p>
      <ul className="mt-3 grid gap-1 text-sm text-muted-foreground sm:grid-cols-2">
        {features.map((f) => (
          <li key={f} className="before:mr-2 before:text-primary before:content-['▸']">
            {f}
          </li>
        ))}
      </ul>
    </div>
  );
}
