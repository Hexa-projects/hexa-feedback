import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { store } from "@/lib/store";
import {
  LayoutDashboard, ClipboardList, Repeat, AlertTriangle,
  Lightbulb, History, LogOut, Menu, X, User
} from "lucide-react";
import logo from "@/assets/logo.png";

const NAV = [
  { to: "/daily", label: "Meu Dia a Dia", icon: ClipboardList },
  { to: "/processes", label: "Processos Repetitivos", icon: Repeat },
  { to: "/bottlenecks", label: "Gargalos", icon: AlertTriangle },
  { to: "/suggestions", label: "Sugestões", icon: Lightbulb },
  { to: "/history", label: "Histórico", icon: History },
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard, roles: ["admin", "gestor"] },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const user = store.getCurrentUser();

  const visibleNav = NAV.filter(n => !n.roles || (user && n.roles.includes(user.role)));

  const handleLogout = () => {
    store.setCurrentUser(null);
    navigate("/");
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Mobile header */}
      <header className="lg:hidden hexa-gradient text-primary-foreground p-4 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-2">
          <img src={logo} alt="Hexamedical" className="w-8 h-8 object-contain" />
          <span className="font-bold text-lg">Hexamedical</span>
        </div>
        <button onClick={() => setOpen(!open)} className="p-1">
          {open ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </header>

      {/* Mobile nav overlay */}
      {open && (
        <div className="lg:hidden fixed inset-0 z-40 bg-foreground/50" onClick={() => setOpen(false)}>
          <nav className="w-72 h-full hexa-gradient text-sidebar-foreground p-6 space-y-2 animate-fade-in" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-2 mb-8">
              <img src={logo} alt="Hexamedical" className="w-8 h-8 object-contain" />
              <span className="font-bold text-xl">Hexamedical</span>
            </div>
            {user && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-sidebar-accent mb-4">
                <User className="w-4 h-4 text-sidebar-primary" />
                <div className="text-sm">
                  <p className="font-medium">{user.nome}</p>
                  <p className="text-xs opacity-70">{user.setor} · {user.role}</p>
                </div>
              </div>
            )}
            {visibleNav.map(n => (
              <Link key={n.to} to={n.to} onClick={() => setOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                  location.pathname === n.to
                    ? "bg-sidebar-accent text-sidebar-primary font-medium"
                    : "hover:bg-sidebar-accent/50"
                }`}>
                <n.icon className="w-4 h-4" />{n.label}
              </Link>
            ))}
            <button onClick={handleLogout} className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm hover:bg-sidebar-accent/50 w-full mt-4 text-hexa-red">
              <LogOut className="w-4 h-4" />Sair
            </button>
          </nav>
        </div>
      )}

      <div className="flex">
        {/* Desktop sidebar */}
        <aside className="hidden lg:flex flex-col w-64 hexa-gradient text-sidebar-foreground min-h-screen sticky top-0 p-5">
          <div className="flex items-center gap-2 mb-8">
            <Hexagon className="w-7 h-7 text-sidebar-primary" />
            <span className="font-bold text-xl">Hexamedical</span>
          </div>
          {user && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-sidebar-accent mb-6">
              <User className="w-4 h-4 text-sidebar-primary" />
              <div className="text-sm">
                <p className="font-medium">{user.nome}</p>
                <p className="text-xs opacity-70">{user.setor} · {user.role}</p>
              </div>
            </div>
          )}
          <nav className="space-y-1 flex-1">
            {visibleNav.map(n => (
              <Link key={n.to} to={n.to}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                  location.pathname === n.to
                    ? "bg-sidebar-accent text-sidebar-primary font-medium"
                    : "hover:bg-sidebar-accent/50"
                }`}>
                <n.icon className="w-4 h-4" />{n.label}
              </Link>
            ))}
          </nav>
          <button onClick={handleLogout} className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm hover:bg-sidebar-accent/50 w-full text-hexa-red">
            <LogOut className="w-4 h-4" />Sair
          </button>
        </aside>

        {/* Main content */}
        <main className="flex-1 p-4 lg:p-8 max-w-4xl mx-auto w-full">
          <p className="text-xs text-muted-foreground mb-6 italic">
            ✨ Sua contribuição ajuda a construir o HexaOS.
          </p>
          {children}
        </main>
      </div>
    </div>
  );
}
