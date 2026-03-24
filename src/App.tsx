import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import Login from "./pages/Login";
import Onboarding from "./pages/Onboarding";
import HomePage from "./pages/HomePage";
import LeadsList from "./pages/crm/LeadsList";
import LeadForm from "./pages/crm/LeadForm";
import LeadDetail from "./pages/crm/LeadDetail";
import KanbanFunnel from "./pages/crm/KanbanFunnel";
import WorkOrdersList from "./pages/os/WorkOrdersList";
import WorkOrderForm from "./pages/os/WorkOrderForm";
import WorkOrderDetail from "./pages/os/WorkOrderDetail";
import LabPartsList from "./pages/lab/LabPartsList";
import LabPartForm from "./pages/lab/LabPartForm";
import ProjectsList from "./pages/projects/ProjectsList";
import ProjectForm from "./pages/projects/ProjectForm";
import ProjectDetail from "./pages/projects/ProjectDetail";
import FinanceDashboard from "./pages/finance/FinanceDashboard";
import DailyForm from "./pages/DailyForm";
import RepetitiveProcesses from "./pages/RepetitiveProcesses";
import ToolsMapping from "./pages/ToolsMapping";
import Bottlenecks from "./pages/Bottlenecks";
import Suggestions from "./pages/Suggestions";
import HistoryPage from "./pages/HistoryPage";
import FocusAI from "./pages/FocusAI";
import Dashboard from "./pages/Dashboard";
import NotFound from "./pages/NotFound";
import AIChat from "./pages/AIChat";
import CorporateChannels from "./pages/CorporateChannels";
import AgentsDashboard from "./pages/AgentsDashboard";
import SettingsPage from "./pages/SettingsPage";
import ApiDocsPage from "./pages/ApiDocsPage";

const queryClient = new QueryClient();

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { user, profile, loading } = useAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center"><p className="text-muted-foreground">Carregando...</p></div>;
  if (!user) return <Navigate to="/" replace />;
  if (profile && !profile.onboarding_completo && window.location.pathname !== "/onboarding") return <Navigate to="/onboarding" replace />;
  return <>{children}</>;
}

const AppRoutes = () => (
  <BrowserRouter>
    <Routes>
      <Route path="/" element={<Login />} />
      <Route path="/onboarding" element={<PrivateRoute><Onboarding /></PrivateRoute>} />

      {/* HexaOS modules */}
      <Route path="/home" element={<PrivateRoute><HomePage /></PrivateRoute>} />

      {/* CRM */}
      <Route path="/crm" element={<PrivateRoute><LeadsList /></PrivateRoute>} />
      <Route path="/crm/new" element={<PrivateRoute><LeadForm /></PrivateRoute>} />
      <Route path="/crm/kanban" element={<PrivateRoute><KanbanFunnel /></PrivateRoute>} />
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

      {/* Financeiro */}
      <Route path="/finance" element={<PrivateRoute><FinanceDashboard /></PrivateRoute>} />

      {/* AI & Tools */}
      <Route path="/settings" element={<PrivateRoute><SettingsPage /></PrivateRoute>} />
      <Route path="/api-docs" element={<PrivateRoute><ApiDocsPage /></PrivateRoute>} />
      <Route path="/focus-ai" element={<PrivateRoute><FocusAI /></PrivateRoute>} />
      <Route path="/chat-ia" element={<PrivateRoute><AIChat /></PrivateRoute>} />
      <Route path="/canais" element={<PrivateRoute><CorporateChannels /></PrivateRoute>} />
      <Route path="/agentes" element={<PrivateRoute><AgentsDashboard /></PrivateRoute>} />

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

      <Route path="*" element={<NotFound />} />
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
