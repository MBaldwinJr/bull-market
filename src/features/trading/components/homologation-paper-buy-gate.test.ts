import { describe, expect, it } from "vitest";
import { canShowHomologationPaperBuy } from "./homologation-paper-buy-gate";

const appId = "a37675cf-7419-49cd-87c3-74203b93f3e7";
const projectRef = "stagingreference12345";
const approved = {
  enabled: "true",
  appId,
  projectRef,
  backendUrl: `https://${projectRef}.supabase.co`,
  hostname: `id-preview--${appId}.lovable.app`,
};

describe("paper BUY staging preview", () => {
  it("is hidden by default and cannot be displayed in production", () => {
    expect(canShowHomologationPaperBuy({ ...approved, enabled: undefined })).toBe(false);
    expect(canShowHomologationPaperBuy({ ...approved, appId: undefined })).toBe(false);
    expect(canShowHomologationPaperBuy({ ...approved, hostname: "bull-market.com" })).toBe(false);
    expect(canShowHomologationPaperBuy({ ...approved, hostname: "id-preview--53ab617e-c9fb-449d-a719-311a513d4a02.lovable.app" })).toBe(false);
    expect(canShowHomologationPaperBuy({ ...approved, projectRef: "dsrjwmpvauipdssopydg",
      backendUrl: "https://dsrjwmpvauipdssopydg.supabase.co" })).toBe(false);
    expect(canShowHomologationPaperBuy({ ...approved, backendUrl: "http://127.0.0.1:54321" })).toBe(false);
  });

  it("shows opt-in only on the dedicated homologation preview with an exact isolated backend", () => {
    expect(canShowHomologationPaperBuy(approved)).toBe(true);
    expect(canShowHomologationPaperBuy({
      ...approved, hostname: `project--${appId}.lovable.app`,
    })).toBe(true);
    expect(canShowHomologationPaperBuy({
      ...approved, backendUrl: "https://unrelated.supabase.co",
    })).toBe(false);
  });
});
