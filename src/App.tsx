import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./hooks/useAuth";
import ProtectedRoute from "./components/auth/ProtectedRoute";
import AppLayout from "./components/layout/AppLayout";
import Index from "./pages/Index";
import Conversations from "./pages/Conversations";
import ChatView from "./pages/ChatView";
import Agents from "./pages/Agents";
import Automation from "./pages/Automation";
import PlaceholderPage from "./pages/PlaceholderPage";
import Reports from "./pages/Reports";
import Login from "./pages/Login";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
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

            {/* Protected routes */}
            <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
              <Route path="/" element={<Index />} />
              <Route path="/conversations" element={<Conversations />} />
              <Route path="/conversations/:id" element={<ChatView />} />
              <Route path="/agents" element={<Agents />} />
              <Route path="/automation" element={<Automation />} />
              <Route path="/ai" element={<PlaceholderPage title="Integração IA" subtitle="Chatbot inteligente com IA" />} />
              <Route path="/knowledge" element={<PlaceholderPage title="Base de Conhecimento" subtitle="Artigos e respostas rápidas" />} />
              <Route path="/reports" element={<Reports />} />
              <Route path="/settings" element={<PlaceholderPage title="Configurações" subtitle="Configurar conta e integrações" />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
