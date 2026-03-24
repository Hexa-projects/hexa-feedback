import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import NotificationDropdown from "@/components/NotificationDropdown";
import { useAuth } from "@/contexts/AuthContext";
import {
  Home, Users, Briefcase, Wrench, FlaskConical,
  DollarSign, BarChart3, Settings, LogOut, Menu, X, Search, User,
  ChevronDown, Brain, ClipboardList, Repeat, AlertTriangle, Lightbulb, History,
  MessageCircle, Bot, Hash, BookOpen, Zap, FileText, Target,
  Package, Calendar, TrendingDown, Wallet, LayoutDashboard, ArrowDownToLine, Boxes
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import hexaLogo from "@/assets/hexaos-logo.png";

interface NavChild {
  to: string;
  label: string;
  icon: any;
  wip?: boolean;
}

interface NavGroup {
  id: string;
  label: string;
  icon: any;
  roles?: string[];
  children: NavChild[];
}

interface NavSingle {
  id: string;
  to: string;
  label: string;
  icon: any;
  roles?: string[];
  highlight?: boolean;
}

type NavItem = NavGroup | NavSingle;

const isGroup = (item: NavItem): item is NavGroup => "children" in item;

const NAV_ITEMS: NavItem[] = [
  {
    id: "dashboard",
    label: "Dashboard",
    icon: LayoutDashboard,
    children: [
      { to: "/home", label: "Visão Geral", icon: Home },
      { to: "/reports", label: "Relatórios & BI", icon: BarChart3 },
    ],
  },
  {
    id: "comercial",
    label: "Comercial",
    icon: Target,
    roles: ["admin", "gestor", "colaborador"],
    children: [
      { to: "/crm", label: "Leads", icon: Users },
      { to: "/crm/kanban", label: "Funil Kanban", icon: BarChart3 },
      { to: "/proposals", label: "Propostas", icon: FileText, wip: true },
      { to: "/contracts", label: "Contratos", icon: Briefcase, wip: true },
    ],
  },
  {
    id: "operacoes",
    label: "Operações",
    icon: Wrench,
    children: [
      { to: "/os", label: "Ordens de Serviço", icon: ClipboardList },
      { to: "/schedule", label: "Agenda Técnica", icon: Calendar, wip: true },
      { to: "/projects", label: "Projetos & Implantação", icon: Briefcase },
    ],
  },
  {
    id: "laboratorio",
    label: "Laboratório",
    icon: FlaskConical,
    children: [
      { to: "/lab", label: "Peças em Reparo", icon: Wrench },
      { to: "/lab/stock", label: "Estoque", icon: Package, wip: true },
      { to: "/lab/new", label: "Registrar Peça", icon: FlaskConical },
    ],
  },
  {
    id: "estoque",
    label: "Estoque Inteligente",
    icon: Boxes,
    children: [
      { to: "/stock", label: "Dashboard", icon: LayoutDashboard },
      { to: "/stock/products", label: "Catálogo", icon: Package },
      { to: "/stock/movements", label: "Movimentações", icon: ArrowDownToLine },
      { to: "/stock/journey", label: "Jornada da Peça", icon: TrendingDown },
      { to: "/stock/equipment", label: "Equipamentos", icon: Wrench },
    ],
  },
  {
    id: "financeiro",
    label: "Financeiro",
    icon: DollarSign,
    roles: ["admin", "gestor"],
    children: [
      { to: "/finance", label: "Receita", icon: DollarSign },
      { to: "/finance/costs", label: "Custos", icon: TrendingDown, wip: true },
      { to: "/finance/overdue", label: "Inadimplência", icon: AlertTriangle, wip: true },
      { to: "/finance/cashflow", label: "Fluxo de Caixa", icon: Wallet, wip: true },
    ],
  },
  {
    id: "comunicacao",
    label: "Comunicação",
    icon: MessageCircle,
    children: [
      { to: "/canais", label: "Canal Corporativo", icon: Hash },
      { to: "/chat-ia", label: "Chat IA", icon: Bot },
    ],
  },
  {
    id: "feedback",
    label: "Feedback & Processos",
    icon: ClipboardList,
    children: [
      { to: "/daily", label: "Meu Dia a Dia", icon: ClipboardList },
      { to: "/processes", label: "Processos Repetitivos", icon: Repeat },
      { to: "/bottlenecks", label: "Gargalos", icon: AlertTriangle },
      { to: "/suggestions", label: "Sugestões", icon: Lightbulb },
      { to: "/tools", label: "Ferramentas & Planilhas", icon: Wrench },
      { to: "/history", label: "Histórico", icon: History },
    ],
  },
  {
    id: "ia",
    label: "IA & Automação",
    icon: Brain,
    roles: ["admin"],
    children: [
      { to: "/focus-ai", label: "Focus AI", icon: Brain },
      { to: "/agentes", label: "Agentes IA", icon: Bot },
      { to: "/automations", label: "Automações", icon: Zap, wip: true },
      { to: "/api-docs", label: "API & Webhooks", icon: BookOpen },
    ],
  },
  {
    id: "settings",
    to: "/settings",
    label: "Configurações",
    icon: Settings,
    roles: ["admin"],
  },
];

// Role-based group visibility mapping
const ROLE_GROUPS: Record<string, string[]> = {
  admin: ["dashboard", "comercial", "operacoes", "laboratorio", "estoque", "financeiro", "comunicacao", "feedback", "ia", "settings"],
  gestor: ["dashboard", "comercial", "operacoes", "laboratorio", "estoque", "financeiro", "comunicacao", "feedback"],
  colaborador: ["dashboard", "comercial", "operacoes", "laboratorio", "estoque", "comunicacao", "feedback"],
};

// Setor-specific visibility overrides
const SETOR_GROUPS: Record<string, string[]> = {
  Comercial: ["dashboard", "comercial", "comunicacao", "feedback"],
  "Técnico": ["dashboard", "operacoes", "laboratorio", "estoque", "comunicacao", "feedback"],
  "Laboratório": ["dashboard", "laboratorio", "estoque", "comunicacao", "feedback"],
  Financeiro: ["dashboard", "financeiro", "comunicacao", "feedback"],
  "Logística": ["dashboard", "operacoes", "estoque", "comunicacao", "feedback"],
  Administrativo: ["dashboard", "comercial", "operacoes", "laboratorio", "estoque", "financeiro", "comunicacao", "feedback"],
  Diretoria: ["dashboard", "comercial", "operacoes", "laboratorio", "estoque", "financeiro", "comunicacao", "feedback", "ia", "settings"],
};

export default function HexaLayout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { profile, role, signOut } = useAuth();

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => {
    // Auto-open the group that contains the current route
    const initial: Record<string, boolean> = {};
    for (const item of NAV_ITEMS) {
      if (isGroup(item) && item.children.some(c => location.pathname.startsWith(c.to))) {
        initial[item.id] = true;
      }
    }
    return initial;
  });

  const toggleGroup = (id: string) =>
    setOpenGroups(prev => ({ ...prev, [id]: !prev[id] }));

  // Filter nav items by role + setor
  const setor = profile?.setor;
  const allowedByRole = ROLE_GROUPS[role] || ROLE_GROUPS.colaborador;
  const allowedBySetor = setor ? SETOR_GROUPS[setor] : undefined;
  
  const visibleNav = NAV_ITEMS.filter(item => {
    // Admin always sees everything
    if (role === "admin") return true;
    // Check role-based groups
    if (!allowedByRole.includes(item.id)) return false;
    // For non-admin, also check setor if available
    if (allowedBySetor && !allowedBySetor.includes(item.id)) return false;
    return true;
  });

  const handleLogout = async () => {
    await signOut();
    navigate("/");
  };

  const isChildActive = (to: string) => {
    if (to === "/home") return location.pathname === "/home";
    return location.pathname.startsWith(to);
  };

  const renderNavItem = (item: NavItem) => {
    if (!isGroup(item)) {
      // Single item (e.g. Settings)
      const active = location.pathname.startsWith(item.to);
      return (
        <Link
          key={item.id}
          to={item.to}
          onClick={() => setSidebarOpen(false)}
          className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all ${
            active
              ? "bg-sidebar-accent text-sidebar-primary font-semibold"
              : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
          }`}
        >
          <item.icon className="w-4 h-4 shrink-0" />
          <span>{item.label}</span>
        </Link>
      );
    }

    // Group with children
    const isAnyChildActive = item.children.some(c => isChildActive(c.to));
    const isOpen = openGroups[item.id] ?? false;
    const isHighlighted = item.id === "ia";

    return (
      <div key={item.id}>
        <button
          onClick={() => toggleGroup(item.id)}
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all ${
            isAnyChildActive
              ? "bg-sidebar-accent text-sidebar-primary font-semibold"
              : isHighlighted
              ? "text-hexa-amber hover:bg-sidebar-accent/50"
              : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
          }`}
        >
          <item.icon className={`w-4 h-4 shrink-0 ${isHighlighted ? "text-hexa-amber" : ""}`} />
          <span className="flex-1 text-left">{item.label}</span>
          <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} />
        </button>

        {isOpen && (
          <div className="ml-3 pl-3 border-l border-sidebar-border/40 mt-0.5 space-y-0.5">
            {item.children.map(child => (
              <Link
                key={child.to}
                to={child.wip ? "#" : child.to}
                onClick={(e) => {
                  if (child.wip) { e.preventDefault(); return; }
                  setSidebarOpen(false);
                }}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs transition-all ${
                  child.wip
                    ? "text-sidebar-foreground/30 cursor-default"
                    : isChildActive(child.to)
                    ? "bg-sidebar-accent text-sidebar-primary font-medium"
                    : "text-sidebar-foreground/60 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                }`}
              >
                <child.icon className="w-3.5 h-3.5 shrink-0" />
                <span className="flex-1">{child.label}</span>
                {child.wip && (
                  <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 border-sidebar-border/40 text-sidebar-foreground/40">
                    Em breve
                  </Badge>
                )}
              </Link>
            ))}
          </div>
        )}
      </div>
    );
  };

  const SidebarInner = () => (
    <>
      {/* Logo */}
      <div className="p-5 flex items-center gap-3">
        <img src={hexaLogo} alt="HexaOS" className="w-9 h-9 object-contain" />
        <div>
          <span className="text-lg font-bold text-sidebar-foreground tracking-tight">Hexa</span>
          <span className="text-lg font-bold text-sidebar-primary tracking-tight">OS</span>
        </div>
      </div>

      <div className="mx-4 mb-2 h-px bg-sidebar-border/60" />

      {/* Navigation */}
      <nav className="flex-1 px-3 space-y-0.5 overflow-y-auto scrollbar-thin">
        {visibleNav.map(renderNavItem)}
      </nav>

      {/* User section */}
      {profile && (
        <div className="p-3 border-t border-sidebar-border">
          <div className="flex items-center gap-2 p-2 rounded-lg">
            <div className="w-8 h-8 rounded-full hexa-gradient-brand flex items-center justify-center">
              <User className="w-4 h-4 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-sidebar-foreground truncate">{profile.nome}</p>
              <p className="text-xs text-sidebar-foreground/50 capitalize">{role}</p>
            </div>
            <button onClick={handleLogout} className="p-1.5 rounded hover:bg-sidebar-accent" title="Sair">
              <LogOut className="w-4 h-4 text-sidebar-foreground/50" />
            </button>
          </div>
        </div>
      )}
    </>
  );

  return (
    <div className="min-h-screen bg-background flex">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex flex-col w-60 hexa-gradient min-h-screen sticky top-0 border-r border-sidebar-border">
        <SidebarInner />
      </aside>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div className="w-72 hexa-gradient flex flex-col animate-fade-in">
            <div className="absolute top-4 right-4">
              <button onClick={() => setSidebarOpen(false)} className="text-sidebar-foreground">
                <X className="w-5 h-5" />
              </button>
            </div>
            <SidebarInner />
          </div>
          <div className="flex-1 bg-foreground/40" onClick={() => setSidebarOpen(false)} />
        </div>
      )}

      {/* Main area */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="sticky top-0 z-40 bg-card/95 backdrop-blur-sm border-b px-4 lg:px-6 h-14 flex items-center gap-3">
          <button className="lg:hidden p-1.5" onClick={() => setSidebarOpen(true)}>
            <Menu className="w-5 h-5 text-muted-foreground" />
          </button>
          <div className="flex-1 max-w-md">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="Buscar..." className="pl-9 h-9 bg-muted/50 border-0" />
            </div>
          </div>
          <div className="flex items-center gap-2 ml-auto">
            <NotificationDropdown />
            <div className="hidden sm:flex items-center gap-2 text-sm">
              <div className="w-7 h-7 rounded-full hexa-gradient-brand flex items-center justify-center">
                <User className="w-3.5 h-3.5 text-white" />
              </div>
              <span className="text-muted-foreground font-medium">{profile?.nome || "Usuário"}</span>
            </div>
          </div>
        </header>

        <main className="flex-1 p-4 lg:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
