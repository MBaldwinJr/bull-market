import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/layout/app-shell";
import { DashboardPage } from "@/features/dashboard/components/dashboard-page";
import { pageHead } from "@/lib/seo";

export const Route = createFileRoute("/")({
  head: () => pageHead("Dashboard", "Patrimônio, resultados e risco da sua conta de Paper Trading."),
  component: Index,
});

function Index() {
  return (
    <AppShell>
      <DashboardPage />
    </AppShell>
  );
}
