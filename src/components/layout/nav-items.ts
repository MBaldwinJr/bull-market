import {
  Activity,
  BarChart3,
  Bot,
  BrainCircuit,
  CandlestickChart,
  Coins,
  FlaskConical,
  History,
  LayoutDashboard,
  Link2,
  ListChecks,
  ScrollText,
  Settings,
  Shield,
  ShieldAlert,
  Wallet,
  Zap,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  readonly to: string;
  readonly label: string;
  readonly icon: LucideIcon;
}

export const NAV_GROUPS: ReadonlyArray<{ title: string; items: readonly NavItem[] }> = [
  {
    title: "Visão",
    items: [
      { to: "/", label: "Dashboard", icon: LayoutDashboard },
      { to: "/mercado", label: "Mercado", icon: CandlestickChart },
      { to: "/ativos", label: "Ativos", icon: Coins },
    ],
  },
  {
    title: "Inteligência",
    items: [
      { to: "/estrategias", label: "Estratégias", icon: ListChecks },
      { to: "/sinais", label: "Sinais de mercado", icon: Zap },
      { to: "/ia", label: "Inteligência Artificial", icon: BrainCircuit },
    ],
  },
  {
    title: "Operação",
    items: [
      { to: "/bot", label: "Trading Bot", icon: Bot },
      { to: "/paper", label: "Paper Trading", icon: Activity },
      { to: "/backtesting", label: "Backtesting", icon: FlaskConical },
      { to: "/portfolio", label: "Portfólio", icon: Wallet },
      { to: "/historico", label: "Histórico", icon: History },
      { to: "/risco", label: "Gestão de risco", icon: ShieldAlert },
      { to: "/relatorios", label: "Relatórios", icon: BarChart3 },
    ],
  },
  {
    title: "Sistema",
    items: [
      { to: "/conexoes", label: "Conexões", icon: Link2 },
      { to: "/configuracoes", label: "Configurações", icon: Settings },
      { to: "/seguranca", label: "Segurança", icon: Shield },
      { to: "/logs", label: "Logs do sistema", icon: ScrollText },
    ],
  },
];
