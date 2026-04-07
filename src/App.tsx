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
const HomePage = lazy(() => import("./pages/HomePage"));
const LeadsList = lazy(() => import("./pages/crm/LeadsList"));
const LeadForm = lazy(() => import("./pages/crm/LeadForm"));
const LeadDetail = lazy(() => import("./pages/crm/LeadDetail"));
const KanbanFunnel = lazy(() => import("./pages/crm/KanbanFunnel"));
const ProposalsList = lazy(() => import("./pages/crm/ProposalsList"));
const ContractsList = lazy(() => import("./pages/crm/ContractsList"));
const WorkOrdersList = lazy(() => import("./pages/os/WorkOrdersList"));
const WorkOrderForm = lazy(() => import("./pages/os/WorkOrderForm"));
const WorkOrderDetail = lazy(() => import("./pages/os/WorkOrderDetail"));
const LabPartsList = lazy(() => import("./pages/lab/LabPartsList"));
const LabPartForm = lazy(() => import("./pages/lab/LabPartForm"));
const DataImporter = lazy(() => import("./pages/lab/DataImporter"));
const StockDashboard = lazy(() => import("./pages/stock/StockDashboard"));
const StockProducts = lazy(() => import("./pages/stock/StockProducts"));
const StockProductForm = lazy(() => import("./pages/stock/StockProductForm"));
const StockMovements = lazy(() => import("./pages/stock/StockMovements"));
const StockJourney = lazy(() => import("./pages/stock/StockJourney"));
const StockEquipment = lazy(() => import("./pages/stock/StockEquipment"));
const ProjectsList = lazy(() => import("./pages/projects/ProjectsList"));
const ProjectForm = lazy(() => import("./pages/projects/ProjectForm"));
const ProjectDetail = lazy(() => import("./pages/projects/ProjectDetail"));
const FinanceDashboard = lazy(() => import("./pages/finance/FinanceDashboard"));
const DailyForm = lazy(() => import("./pages/DailyForm"));
const RepetitiveProcesses = lazy(() => import("./pages/RepetitiveProcesses"));
const ToolsMapping = lazy(() => import("./pages/ToolsMapping"));
const Bottlenecks = lazy(() => import("./pages/Bottlenecks"));
const Suggestions = lazy(() => import("./pages/Suggestions"));
const HistoryPage = lazy(() => import("./pages/HistoryPage"));
const FocusAI = lazy(() => import("./pages/FocusAI"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const AIChat = lazy(() => import("./pages/AIChat"));
const CorporateChannels = lazy(() => import("./pages/CorporateChannels"));
const AgentsDashboard = lazy(() => import("./pages/AgentsDashboard"));
const SettingsPage = lazy(() => import("./pages/SettingsPage"));
const ApiDocsPage = lazy(() => import("./pages/ApiDocsPage"));
const CalendarPage = lazy(() => import("./pages/CalendarPage"));
const OpsDashboard = lazy(() => import("./pages/OpsDashboard"));
const PublicApiDocs = lazy(() => import("./pages/PublicApiDocs"));
const SDRPlaybook = lazy(() => import("./pages/SDRPlaybook"));
const OpenClawKpiDashboard = lazy(() => import("./pages/OpenClawKpiDashboard"));
const OpenClawAgentAudit = lazy(() => import("./pages/OpenClawAgentAudit"));
const OpenClawOpsConsole = lazy(() => import("./pages/OpenClawOpsConsole"));
const ExecutiveDashboard = lazy(() => import("./pages/ExecutiveDashboard"));
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
    <div className="min-h-screen flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-muted-foreground">Carregando módulo...</p>
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
      <Route path="/docs" element={<Suspense fallback={<PageLoader />}><PublicApiDocs /></Suspense>} />
      <Route path="/onboarding" element={<PrivateRoute><Onboarding /></PrivateRoute>} />

      {/* HexaOS modules */}
      <Route path="/home" element={<PrivateRoute><HomePage /></PrivateRoute>} />
      <Route path="/executive" element={<PrivateRoute><ExecutiveDashboard /></PrivateRoute>} />

      {/* CRM */}
      <Route path="/crm" element={<PrivateRoute><LeadsList /></PrivateRoute>} />
      <Route path="/crm/new" element={<PrivateRoute><LeadForm /></PrivateRoute>} />
      <Route path="/crm/kanban" element={<PrivateRoute><KanbanFunnel /></PrivateRoute>} />
      <Route path="/crm/proposals" element={<PrivateRoute><ProposalsList /></PrivateRoute>} />
      <Route path="/crm/contracts" element={<PrivateRoute><ContractsList /></PrivateRoute>} />
      <Route path="/crm/:id" element={<PrivateRoute><LeadDetail /></PrivateRoute>} />

      {/* Projetos & Implantação */}
      <Route path="/projects" element={<PrivateRoute><ProjectsList /></PrivateRoute>} />
      <Route path="/projects/new" element={<PrivateRoute><ProjectForm /></PrivateRoute>} />
      <Route path="/projects/:id" element={<PrivateRoute><ProjectDetail /></PrivateRoute>} />

      {/* Manutenção & OS */}
      <Route path="/os" element={<PrivateRoute><WorkOrdersList /></PrivateRoute>} />
      <Route path="/os/new" element={<PrivateRoute><WorkOrderForm /></PrivateRoute>} />
      <Route path="/os/:id" element={<PrivateRoute><WorkOrderDetail /></PrivateRoute>} />

      {/* Laboratório */}
      <Route path="/lab" element={<PrivateRoute><LabPartsList /></PrivateRoute>} />
      <Route path="/lab/new" element={<PrivateRoute><LabPartForm /></PrivateRoute>} />
      <Route path="/lab/import" element={<PrivateRoute><DataImporter /></PrivateRoute>} />

      {/* Estoque Inteligente */}
      <Route path="/stock" element={<PrivateRoute><StockDashboard /></PrivateRoute>} />
      <Route path="/stock/products" element={<PrivateRoute><StockProducts /></PrivateRoute>} />
      <Route path="/stock/products/new" element={<PrivateRoute><StockProductForm /></PrivateRoute>} />
      <Route path="/stock/movements" element={<PrivateRoute><StockMovements /></PrivateRoute>} />
      <Route path="/stock/journey" element={<PrivateRoute><StockJourney /></PrivateRoute>} />
      <Route path="/stock/equipment" element={<PrivateRoute><StockEquipment /></PrivateRoute>} />

      {/* Financeiro */}
      <Route path="/finance" element={<PrivateRoute><FinanceDashboard /></PrivateRoute>} />

      {/* AI & Tools */}
      <Route path="/settings" element={<PrivateRoute><SettingsPage /></PrivateRoute>} />
      <Route path="/api-docs" element={<PrivateRoute><ApiDocsPage /></PrivateRoute>} />
      <Route path="/focus-ai" element={<PrivateRoute><FocusAI /></PrivateRoute>} />
      <Route path="/chat-ia" element={<PrivateRoute><AIChat /></PrivateRoute>} />
      <Route path="/canais" element={<PrivateRoute><CorporateChannels /></PrivateRoute>} />
      <Route path="/agentes" element={<PrivateRoute><AgentsDashboard /></PrivateRoute>} />
      <Route path="/ops" element={<PrivateRoute><OpsDashboard /></PrivateRoute>} />

      {/* Calendário */}
      <Route path="/calendar" element={<PrivateRoute><CalendarPage /></PrivateRoute>} />

      {/* Playbook SDR */}
      <Route path="/playbook" element={<PrivateRoute><SDRPlaybook /></PrivateRoute>} />

      {/* OpenClaw Integration */}
      <Route path="/openclaw/kpis" element={<PrivateRoute><OpenClawKpiDashboard /></PrivateRoute>} />
      <Route path="/openclaw/audit" element={<PrivateRoute><OpenClawAgentAudit /></PrivateRoute>} />
      <Route path="/openclaw/console" element={<PrivateRoute><OpenClawOpsConsole /></PrivateRoute>} />

      {/* Reports = existing dashboard */}
      <Route path="/reports" element={<PrivateRoute><Dashboard /></PrivateRoute>} />

      {/* Legacy feedback routes */}
      <Route path="/daily" element={<PrivateRoute><DailyForm /></PrivateRoute>} />
      <Route path="/tools" element={<PrivateRoute><ToolsMapping /></PrivateRoute>} />
      <Route path="/processes" element={<PrivateRoute><RepetitiveProcesses /></PrivateRoute>} />
      <Route path="/bottlenecks" element={<PrivateRoute><Bottlenecks /></PrivateRoute>} />
      <Route path="/suggestions" element={<PrivateRoute><Suggestions /></PrivateRoute>} />
      <Route path="/history" element={<PrivateRoute><HistoryPage /></PrivateRoute>} />
      <Route path="/dashboard" element={<Navigate to="/reports" replace />} />

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
