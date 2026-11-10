/**
 * This unlocks a distinct homologation-only button, never the default
 * manual-order control. Client checks are just UX; server independently
 * verifies staging identity and risk before any paper RPC.
 */
const HOMOLOGATION_APP_ID = "a37675cf-7419-49cd-87c3-74203b93f3e7";
const VERIFIED_HOMOLOGATION_REF = "yawdfupednxlicfogwxp";

export interface HomologationPreviewConfig {
  readonly enabled: string | undefined;
  readonly appId: string | undefined;
  readonly projectRef: string | undefined;
  readonly backendUrl: string | undefined;
  readonly hostname: string;
}

export function canShowHomologationPaperBuy(config: HomologationPreviewConfig): boolean {
  if (config.enabled !== "true" || config.appId !== HOMOLOGATION_APP_ID ||
      config.projectRef !== VERIFIED_HOMOLOGATION_REF) return false;
  try {
    const backend = new URL(config.backendUrl ?? "");
    if (backend.protocol !== "https:" || backend.hostname !== `${config.projectRef}.supabase.co` ||
        backend.username || backend.password || backend.search || backend.hash ||
        backend.port || backend.pathname !== "/") return false;
  } catch {
    return false;
  }
  // Only the dedicated Lovable homologation project's preview host can render
  // the staging control. Never render it on a production or custom domain.
  return new RegExp(
    `^(?:id-preview(?:-[a-z0-9]+)?|project)--${HOMOLOGATION_APP_ID}(-dev)?\\.(?:lovable\\.app|lovableproject\\.com|lovableproject-dev\\.com)$`,
  ).test(config.hostname);
}
