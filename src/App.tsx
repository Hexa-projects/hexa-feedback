import { lazy, Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";

// Eagerly loaded (auth flow)
import Login from "./pages/Login";
import Onboarding from "./pages/Onboarding";

// Lazy-loaded pages
const SwarmDashboard = lazy(() => import("./pages/SwarmDashboard"));
const TeamsConfig = lazy(() => import("./pages/TeamsConfig"));
const KanbanFunnel = lazy(() => import("./pages/crm/KanbanFunnel"));
const ContractsList = lazy(() => import("./pages/crm/ContractsList"));
const WorkOrdersList = lazy(() => import("./pages/os/WorkOrdersList"));
const WorkOrderForm = lazy(() => import("./pages/os/WorkOrderForm"));
const WorkOrderExecution = lazy(() => import("./pages/os/WorkOrderExecution"));
const StockEquipment = lazy(() => import("./pages/stock/StockEquipment"));
const InventoryList = lazy(() => import("./pages/stock/InventoryList"));
const TrackAndTrace = lazy(() => import("./pages/stock/TrackAndTrace"));
const KnowledgeBase = lazy(() => import("./pages/KnowledgeBase"));
const AuditDashboard = lazy(() => import("./pages/AuditDashboard"));
const DailyForm = lazy(() => import("./pages/DailyForm"));
const FinanceDashboard = lazy(() => import("./pages/finance/FinanceDashboard"));
const SettingsPage = lazy(() => import("./pages/SettingsPage"));
const NotFound = lazy(() => import("./pages/NotFound"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      staleTime: 1000 * 60 * 5,
    },
  },
});

function PageLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-muted-foreground">Carregando...</p>
      </div>
    </div>
  );
}

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { user, profile, loading } = useAuth();
  if (loading) return <PageLoader />;
  if (!user) return <Navigate to="/" replace />;
  if (profile && !profile.onboarding_completo && window.location.pathname !== "/onboarding") return <Navigate to="/onboarding" replace />;
  return <Suspense fallback={<PageLoader />}>{children}</Suspense>;
}

const AppRoutes = () => (
  <BrowserRouter>
    <Routes>
      <Route path="/" element={<Login />} />
      <Route path="/onboarding" element={<PrivateRoute><Onboarding /></PrivateRoute>} />

      {/* NÚCLEO AI */}
      <Route path="/swarm" element={<PrivateRoute><SwarmDashboard /></PrivateRoute>} />
      <Route path="/home" element={<Navigate to="/swarm" replace />} />
      <Route path="/settings/teams" element={<PrivateRoute><TeamsConfig /></PrivateRoute>} />

      {/* COMERCIAL */}
      <Route path="/crm/kanban" element={<PrivateRoute><KanbanFunnel /></PrivateRoute>} />
      <Route path="/crm/contracts" element={<PrivateRoute><ContractsList /></PrivateRoute>} />
      <Route path="/crm" element={<Navigate to="/crm/kanban" replace />} />

      {/* OPERAÇÕES */}
      <Route path="/os" element={<PrivateRoute><WorkOrdersList /></PrivateRoute>} />
      <Route path="/os/new" element={<PrivateRoute><WorkOrderForm /></PrivateRoute>} />
      <Route path="/os/:id" element={<PrivateRoute><WorkOrderExecution /></PrivateRoute>} />
      <Route path="/stock/equipment" element={<PrivateRoute><StockEquipment /></PrivateRoute>} />

      {/* LAB & ESTOQUE */}
      <Route path="/estoque" element={<PrivateRoute><InventoryList /></PrivateRoute>} />
      <Route path="/estoque/rastreio" element={<PrivateRoute><TrackAndTrace /></PrivateRoute>} />
      <Route path="/conhecimento" element={<PrivateRoute><KnowledgeBase /></PrivateRoute>} />

      {/* AUDITORIA */}
      <Route path="/auditoria" element={<PrivateRoute><AuditDashboard /></PrivateRoute>} />
      <Route path="/auditoria/gargalos" element={<PrivateRoute><AuditDashboard /></PrivateRoute>} />
      <Route path="/daily" element={<PrivateRoute><DailyForm /></PrivateRoute>} />

      {/* FINANCEIRO */}
      <Route path="/financeiro" element={<PrivateRoute><FinanceDashboard /></PrivateRoute>} />

      {/* SETTINGS */}
      <Route path="/settings" element={<PrivateRoute><SettingsPage /></PrivateRoute>} />

      {/* Legacy redirects */}
      <Route path="/dashboard" element={<Navigate to="/swarm" replace />} />
      <Route path="/reports" element={<Navigate to="/swarm" replace />} />
      <Route path="/focus-ai" element={<Navigate to="/swarm" replace />} />
      <Route path="/executive" element={<Navigate to="/swarm" replace />} />
      <Route path="/finance" element={<Navigate to="/financeiro" replace />} />
      <Route path="/stock" element={<Navigate to="/estoque" replace />} />
      <Route path="/stock/journey" element={<Navigate to="/estoque/rastreio" replace />} />

      <Route path="*" element={<Suspense fallback={<PageLoader />}><NotFound /></Suspense>} />
    </Routes>
  </BrowserRouter>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
