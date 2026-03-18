import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./hooks/useAuth";
import { ThemeProvider } from "./hooks/useTheme";
import AppLayout from "./components/layout/AppLayout";
import Index from "./pages/Index";
import Conversations from "./pages/Conversations";
import ChatView from "./pages/ChatView";
import Agents from "./pages/Agents";
import Automation from "./pages/Automation";
import FlowEditor from "./pages/FlowEditor";
import PlaceholderPage from "./pages/PlaceholderPage";
import AiSettings from "./pages/AiSettings";
import Reports from "./pages/Reports";
import Connections from "./pages/Connections";
import UserManagement from "./pages/UserManagement";
import Login from "./pages/Login";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import PendingApproval from "./pages/PendingApproval";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { isAdmin, loading } = useAuth();
  if (loading) return null;
  if (!isAdmin) return <Navigate to="/" replace />;
  return <>{children}</>;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
            <Routes>
              {/* Public routes */}
              <Route path="/login" element={<Login />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/pending-approval" element={<PendingApproval />} />

              {/* Protected routes */}
              <Route element={<AppLayout />}>
                <Route path="/" element={<Index />} />
                <Route path="/conversations" element={<Conversations />} />
                <Route path="/conversations/:id" element={<ChatView />} />
                <Route path="/agents" element={<AdminRoute><Agents /></AdminRoute>} />
                <Route path="/automation" element={<AdminRoute><Automation /></AdminRoute>} />
                <Route path="/automation/:id" element={<AdminRoute><FlowEditor /></AdminRoute>} />
                <Route path="/ai" element={<AdminRoute><AiSettings /></AdminRoute>} />
                <Route path="/reports" element={<AdminRoute><Reports /></AdminRoute>} />
                <Route path="/connections" element={<AdminRoute><Connections /></AdminRoute>} />
                <Route path="/users" element={<AdminRoute><UserManagement /></AdminRoute>} />
                <Route path="/settings" element={<AdminRoute><PlaceholderPage title="Configurações" subtitle="Configurar conta e integrações" /></AdminRoute>} />
              </Route>
              <Route path="*" element={<NotFound />} />
            </Routes>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
