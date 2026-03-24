import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import {
  Home, Users, Briefcase, Wrench, FlaskConical,
  DollarSign, BarChart3, Settings, LogOut, Menu, X, Search, Bell, User,
  ChevronDown, Brain, ClipboardList, Repeat, AlertTriangle, Lightbulb, History,
  MessageCircle, Bot, Hash, BookOpen
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import hexaLogo from "@/assets/hexaos-logo.png";

interface NavItem {
  to: string;
  label: string;
  icon: any;
  roles?: string[];
  children?: NavItem[];
}

const NAV: NavItem[] = [
  { to: "/home", label: "Home", icon: Home },
  { to: "/crm", label: "CRM & Vendas", icon: Users },
  { to: "/projects", label: "Projetos & Implantação", icon: Briefcase },
  { to: "/os", label: "Manutenção & OS", icon: Wrench },
  { to: "/lab", label: "Laboratório de Peças", icon: FlaskConical },
  { to: "/finance", label: "Financeiro", icon: DollarSign },
  { to: "/chat-ia", label: "Chat IA", icon: MessageCircle },
  { to: "/canais", label: "Canal Corporativo", icon: Hash },
  {
    to: "#feedback", label: "Relatórios & Feedback", icon: BarChart3,
    children: [
      { to: "/reports", label: "Dashboard Geral", icon: BarChart3 },
      { to: "/daily", label: "Meu Dia a Dia", icon: ClipboardList },
      { to: "/tools", label: "Ferramentas & Planilhas", icon: Wrench },
      { to: "/processes", label: "Processos Repetitivos", icon: Repeat },
      { to: "/bottlenecks", label: "Gargalos", icon: AlertTriangle },
      { to: "/suggestions", label: "Sugestões", icon: Lightbulb },
      { to: "/history", label: "Histórico", icon: History },
    ],
  },
  { to: "/focus-ai", label: "Focus AI", icon: Brain, roles: ["admin"] },
  { to: "/agentes", label: "Agentes IA", icon: Bot, roles: ["admin"] },
  { to: "/settings", label: "Configurações", icon: Settings, roles: ["admin"] },
];

const FEEDBACK_ROUTES = ["/reports", "/daily", "/tools", "/processes", "/bottlenecks", "/suggestions", "/history", "/dashboard"];

export default function HexaLayout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { profile, role, signOut } = useAuth();

  const isFeedbackRoute = FEEDBACK_ROUTES.some(r => location.pathname.startsWith(r));
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(isFeedbackRoute);

  const visibleNav = NAV.filter(n => !n.roles || n.roles.includes(role));
  const isActive = (path: string) => path !== "#feedback" && location.pathname.startsWith(path);

  const handleLogout = async () => {
    await signOut();
    navigate("/");
  };

  const renderNavItem = (n: NavItem) => {
    if (n.children) {
      const isGroupActive = n.children.some(c => location.pathname.startsWith(c.to));
      return (
        <div key={n.to}>
          <button
            onClick={() => setFeedbackOpen(!feedbackOpen)}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all ${
              isGroupActive
                ? "bg-sidebar-accent text-sidebar-primary font-medium"
                : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
            }`}
          >
            <n.icon className="w-4 h-4 shrink-0" />
            <span className="flex-1 text-left">{n.label}</span>
            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${feedbackOpen ? "rotate-180" : ""}`} />
          </button>
          {feedbackOpen && (
            <div className="ml-3 pl-3 border-l border-sidebar-border/40 mt-0.5 space-y-0.5">
              {n.children.filter(c => !c.roles || c.roles.includes(role)).map(c => (
                <Link
                  key={c.to}
                  to={c.to}
                  onClick={() => setSidebarOpen(false)}
                  className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs transition-all ${
                    location.pathname === c.to
                      ? "bg-sidebar-accent text-sidebar-primary font-medium"
                      : "text-sidebar-foreground/60 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                  }`}
                >
                  <c.icon className="w-3.5 h-3.5 shrink-0" />
                  <span>{c.label}</span>
                </Link>
              ))}
            </div>
          )}
        </div>
      );
    }

    return (
      <Link
        key={n.to}
        to={n.to}
        onClick={() => setSidebarOpen(false)}
        className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all ${
          isActive(n.to)
            ? "bg-sidebar-accent text-sidebar-primary font-medium"
            : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
        }`}
      >
        <n.icon className="w-4 h-4 shrink-0" />
        <span>{n.label}</span>
      </Link>
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

      {/* Divider */}
      <div className="mx-4 mb-2 h-px bg-sidebar-border/60" />

      {/* Navigation */}
      <nav className="flex-1 px-3 space-y-0.5 overflow-y-auto">
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
            <Button variant="ghost" size="icon" className="relative">
              <Bell className="w-4 h-4" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-primary rounded-full" />
            </Button>
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
