import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import logoHexamedical from "@/assets/logo-hexamedical.png";
import {
  Brain, Target, Wrench, Package, DollarSign, ClipboardList,
  Settings, LogOut, Menu, X, User, ChevronDown,
  BarChart3, Briefcase, FlaskConical, AlertTriangle,
  Lightbulb, History, Repeat, MessageSquare,
  LayoutDashboard, Boxes, BookOpen, Scan
} from "lucide-react";

interface NavChild { to: string; label: string; icon: any; }
interface NavGroup { id: string; label: string; icon: any; children: NavChild[]; }
interface NavSingle { id: string; to: string; label: string; icon: any; }
type NavItem = NavGroup | NavSingle;
const isGroup = (item: NavItem): item is NavGroup => "children" in item;

const NAV_ITEMS: NavItem[] = [
  {
    id: "nucleo-ai",
    label: "NÚCLEO AI",
    icon: Brain,
    children: [
      { to: "/swarm", label: "The Swarm", icon: Brain },
      { to: "/settings/teams", label: "Config. MS Teams", icon: MessageSquare },
    ],
  },
  {
    id: "comercial",
    label: "COMERCIAL (Hunter)",
    icon: Target,
    children: [
      { to: "/crm/kanban", label: "Kanban CRM", icon: BarChart3 },
      { to: "/crm/contracts", label: "Contratos", icon: Briefcase },
    ],
  },
  {
    id: "operacoes",
    label: "OPERAÇÕES (Gear)",
    icon: Wrench,
    children: [
      { to: "/os", label: "Ordens de Serviço", icon: ClipboardList },
      { to: "/stock/equipment", label: "Equipamentos Instalados", icon: Wrench },
    ],
  },
  {
    id: "lab-estoque",
    label: "LAB & ESTOQUE (Tracker)",
    icon: Package,
    children: [
      { to: "/estoque", label: "Inventário", icon: Boxes },
      { to: "/estoque/rastreio", label: "Jornada da Peça", icon: Scan },
      { to: "/conhecimento", label: "Base de Conhecimento", icon: BookOpen },
    ],
  },
  {
    id: "auditoria",
    label: "AUDITORIA (Focus)",
    icon: ClipboardList,
    children: [
      { to: "/auditoria", label: "Onboarding", icon: ClipboardList },
      { to: "/auditoria/gargalos", label: "Gargalos", icon: AlertTriangle },
      { to: "/daily", label: "Daily Forms", icon: Repeat },
    ],
  },
  {
    id: "financeiro",
    label: "FINANCEIRO (Ledger)",
    icon: DollarSign,
    children: [
      { to: "/financeiro", label: "Rentabilidade", icon: LayoutDashboard },
    ],
  },
  { id: "settings", to: "/settings", label: "Configurações", icon: Settings },
];

export default function HexaLayout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { profile, role, signOut } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => {
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

  const handleLogout = async () => { await signOut(); navigate("/"); };

  const isActive = (to: string) => {
    if (to === "/swarm") return location.pathname === "/swarm" || location.pathname === "/";
    return location.pathname.startsWith(to);
  };

  const renderNavItem = (item: NavItem) => {
    if (!isGroup(item)) {
      const active = isActive(item.to);
      return (
        <Link key={item.id} to={item.to} onClick={() => setSidebarOpen(false)}
          className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${
            active ? "bg-sidebar-accent text-sidebar-primary font-medium" : "text-sidebar-foreground/60 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
          }`}>
          <item.icon className="w-4 h-4 shrink-0" />
          <span>{item.label}</span>
        </Link>
      );
    }

    const anyActive = item.children.some(c => isActive(c.to));
    const isOpen = openGroups[item.id] ?? false;

    return (
      <div key={item.id}>
        <button onClick={() => toggleGroup(item.id)}
          className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-xs font-semibold uppercase tracking-wider transition-colors ${
            anyActive ? "text-primary" : "text-sidebar-foreground/40 hover:text-sidebar-foreground/60"
          }`}>
          <item.icon className="w-3.5 h-3.5 shrink-0" />
          <span className="flex-1 text-left">{item.label}</span>
          <ChevronDown className={`w-3 h-3 transition-transform ${isOpen ? "rotate-180" : ""}`} />
        </button>
        {isOpen && (
          <div className="ml-3 pl-3 border-l border-sidebar-border/30 mt-0.5 space-y-0.5">
            {item.children.map(child => (
              <Link key={child.to} to={child.to} onClick={() => setSidebarOpen(false)}
                className={`flex items-center gap-2.5 px-3 py-1.5 rounded-md text-sm transition-colors ${
                  isActive(child.to) ? "bg-sidebar-accent text-primary font-medium" : "text-sidebar-foreground/60 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                }`}>
                <child.icon className="w-3.5 h-3.5 shrink-0" />
                <span>{child.label}</span>
              </Link>
            ))}
          </div>
        )}
      </div>
    );
  };

  const sidebarContent = (
    <>
      <div className="p-4 flex items-center gap-3">
        <img src={logoHexamedical} alt="HexaOS" className="w-8 h-8 object-contain" />
        <div>
          <span className="text-base font-bold text-foreground tracking-tight">Hexa</span>
          <span className="text-base font-bold text-primary tracking-tight">OS</span>
          <span className="text-[10px] text-muted-foreground ml-1.5">v3</span>
        </div>
      </div>
      <div className="mx-3 h-px bg-sidebar-border/40" />
      <nav className="flex-1 px-2 py-2 space-y-1 overflow-y-auto scrollbar-thin">
        {NAV_ITEMS.map(renderNavItem)}
      </nav>
      {profile && (
        <div className="p-3 border-t border-sidebar-border/40">
          <div className="flex items-center gap-2 px-2">
            <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center">
              <User className="w-3.5 h-3.5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-foreground truncate">{profile.nome}</p>
              <p className="text-[10px] text-muted-foreground capitalize">{role}</p>
            </div>
            <button onClick={handleLogout} className="p-1.5 rounded hover:bg-sidebar-accent" title="Sair">
              <LogOut className="w-3.5 h-3.5 text-muted-foreground" />
            </button>
          </div>
        </div>
      )}
    </>
  );

  return (
    <div className="min-h-screen bg-background flex">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex flex-col w-56 bg-sidebar min-h-screen sticky top-0 border-r border-sidebar-border/40">
        {sidebarContent}
      </aside>

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div className="w-64 bg-sidebar flex flex-col animate-fade-in">
            <div className="absolute top-3 right-3">
              <button onClick={() => setSidebarOpen(false)} className="text-foreground"><X className="w-5 h-5" /></button>
            </div>
            {sidebarContent}
          </div>
          <div className="flex-1 bg-black/60" onClick={() => setSidebarOpen(false)} />
        </div>
      )}

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="sticky top-0 z-40 bg-background/90 backdrop-blur-md border-b border-border/40 px-4 lg:px-6 h-12 flex items-center gap-3">
          <button className="lg:hidden p-1.5" onClick={() => setSidebarOpen(true)}>
            <Menu className="w-5 h-5 text-muted-foreground" />
          </button>
          <div className="flex-1" />
          {/* AI Status */}
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-60"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-primary"></span>
            </span>
            <span className="hidden sm:inline">The Swarm Online</span>
          </div>
          <div className="hidden sm:flex items-center gap-2 text-xs ml-3">
            <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center">
              <User className="w-3 h-3 text-primary" />
            </div>
            <span className="text-muted-foreground">{profile?.nome || "Usuário"}</span>
          </div>
        </header>
        <main className="flex-1 p-4 lg:p-6">{children}</main>
      </div>
    </div>
  );
}
