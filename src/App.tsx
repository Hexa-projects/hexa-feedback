import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { store } from "@/lib/store";
import Login from "./pages/Login";
import Onboarding from "./pages/Onboarding";
import DailyForm from "./pages/DailyForm";
import RepetitiveProcesses from "./pages/RepetitiveProcesses";
import ToolsMapping from "./pages/ToolsMapping";
import Bottlenecks from "./pages/Bottlenecks";
import Suggestions from "./pages/Suggestions";
import HistoryPage from "./pages/HistoryPage";
import Dashboard from "./pages/Dashboard";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const user = store.getCurrentUser();
  if (!user) return <Navigate to="/" replace />;
  if (!user.onboardingCompleto && window.location.pathname !== "/onboarding") return <Navigate to="/onboarding" replace />;
  return <>{children}</>;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Login />} />
          <Route path="/onboarding" element={<Onboarding />} />
          <Route path="/daily" element={<PrivateRoute><DailyForm /></PrivateRoute>} />
          <Route path="/processes" element={<PrivateRoute><RepetitiveProcesses /></PrivateRoute>} />
          <Route path="/bottlenecks" element={<PrivateRoute><Bottlenecks /></PrivateRoute>} />
          <Route path="/suggestions" element={<PrivateRoute><Suggestions /></PrivateRoute>} />
          <Route path="/history" element={<PrivateRoute><HistoryPage /></PrivateRoute>} />
          <Route path="/dashboard" element={<PrivateRoute><Dashboard /></PrivateRoute>} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
