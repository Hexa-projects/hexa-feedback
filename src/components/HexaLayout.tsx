import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import {
  LayoutDashboard, Home, Users, Briefcase, Wrench, FlaskConical,
  DollarSign, BarChart3, Settings, LogOut, Menu, X, Search, Bell, User,
  ChevronDown, Brain
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const NAV = [
  { to: "/home", label: "Home", icon: Home },
  { to: "/crm", label: "CRM & Vendas", icon: Users },
  { to: "/projects", label: "Projetos & Implantação", icon: Briefcase },
  { to: "/os", label: "Manutenção & OS", icon: Wrench },
  { to: "/lab", label: "Laboratório de Peças", icon: FlaskConical },
  { to: "/finance", label: "Financeiro", icon: DollarSign },
  { to: "/reports", label: "Relatórios & Dashboards", icon: BarChart3 },
  // Legacy feedback module
  { to: "/daily", label: "Feedback", icon: LayoutDashboard, roles: ["admin", "gestor", "colaborador"] },
  { to: "/focus-ai", label: "Focus AI", icon: Brain, roles: ["admin"] },
  { to: "/settings", label: "Configurações", icon: Settings, roles: ["admin"] },
];

export default function HexaLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { profile, role, signOut } = useAuth();

  const visibleNav = NAV.filter(n => !n.roles || n.roles.includes(role));
  const isActive = (path: string) => location.pathname.startsWith(path);

  const handleLogout = async () => {
    await signOut();
    navigate("/");
  };

  const SidebarContent = () => (
    <>
      {/* Logo */}
      <div className="p-5 flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center">
          <span className="text-primary-foreground font-bold text-sm">H</span>
        </div>
        <span className="text-xl font-bold text-sidebar-foreground">HexaOS</span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 space-y-0.5 overflow-y-auto">
        {visibleNav.map(n => (
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
        ))}
      </nav>

      {/* User section */}
      {profile && (
        <div className="p-3 border-t border-sidebar-border">
          <div className="flex items-center gap-2 p-2 rounded-lg">
            <div className="w-8 h-8 rounded-full bg-sidebar-accent flex items-center justify-center">
              <User className="w-4 h-4 text-sidebar-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-sidebar-foreground truncate">{profile.nome}</p>
              <p className="text-xs text-sidebar-foreground/50">{role}</p>
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
        <SidebarContent />
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
            <SidebarContent />
          </div>
          <div className="flex-1 bg-foreground/40" onClick={() => setSidebarOpen(false)} />
        </div>
      )}

      {/* Main area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top header */}
        <header className="sticky top-0 z-40 bg-card border-b px-4 lg:px-6 h-14 flex items-center gap-3">
          <button className="lg:hidden p-1.5" onClick={() => setSidebarOpen(true)}>
            <Menu className="w-5 h-5 text-muted-foreground" />
          </button>

          {/* Search */}
          <div className="flex-1 max-w-md">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="Buscar..." className="pl-9 h-9 bg-muted/50 border-0" />
            </div>
          </div>

          <div className="flex items-center gap-2 ml-auto">
            <Button variant="ghost" size="icon" className="relative">
              <Bell className="w-4 h-4" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-destructive rounded-full" />
            </Button>
            <div className="hidden sm:flex items-center gap-2 text-sm">
              <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center">
                <User className="w-3.5 h-3.5 text-primary" />
              </div>
              <span className="text-muted-foreground">{profile?.nome || "Usuário"}</span>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 p-4 lg:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
