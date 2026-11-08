import { Link } from "@tanstack/react-router";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BotStatus } from "@/components/trading/bot-status";
import { useBotConfig } from "@/features/account/hooks/use-account";
import { useAuth } from "@/features/auth/use-auth";
import { NAV_GROUPS } from "./nav-items";

export function AppSidebar({ onNavigate }: { onNavigate?: () => void }) {
  const bot = useBotConfig();
  const { user, signOut } = useAuth();

  return (
    <nav aria-label="Navegação principal" className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
      <div className="flex items-center gap-2 border-b border-sidebar-border px-4 py-4">
        <div className="glow-primary flex h-7 w-7 items-center justify-center rounded-sm bg-primary text-xs font-bold text-primary-foreground">
          AI
        </div>
        <div>
          <div className="tabular text-sm font-bold tracking-widest">TRADING AI</div>
          <BotStatus status={bot.data?.status} />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto px-2 py-3">
        {NAV_GROUPS.map((g) => (
          <div key={g.title} className="mb-4">
            <div className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">{g.title}</div>
            <ul>
              {g.items.map((item) => (
                <li key={item.to}>
                  <Link
                    to={item.to}
                    onClick={onNavigate}
                    activeOptions={{ exact: item.to === "/" }}
                    className="flex items-center gap-2.5 rounded-sm px-2 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground data-[status=active]:bg-sidebar-accent data-[status=active]:text-primary"
                  >
                    <item.icon className="h-4 w-4" aria-hidden />
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-sidebar-border p-3">
        <div className="mb-2 truncate text-xs text-muted-foreground">{user?.email}</div>
        <Button variant="ghost" size="sm" className="w-full justify-start" onClick={() => void signOut()}>
          <LogOut className="mr-2 h-4 w-4" /> Sair
        </Button>
      </div>
    </nav>
  );
}
