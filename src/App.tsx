import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { Layout } from "./components/layout/Layout";

// Importação das Páginas
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard"; 
import Modules from "./pages/Modules";
import NewModule from "./pages/NewModule"; 
import EditModule from "./pages/EditModule"; 
import CrudPage from "./pages/CrudPage";   
import Approvals from "./pages/Approvals"; 
import Team from "./pages/Team"; 
import Profile from "./pages/Profile";
import AuditLogs from "./pages/AuditLogs"; // IMPORTANTE: Sua página de logs já criada
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AuthProvider>
        <Toaster />
        <BrowserRouter>
          <Routes>
            {/* Rota Pública */}
            <Route path="/auth" element={<Auth />} />
            
            {/* Rotas Protegidas */}
            <Route element={<Layout />}>
              <Route path="/" element={<Dashboard />} />
              <Route path="/modulos" element={<Modules />} />
              <Route path="/modulos/novo" element={<NewModule />} />
              <Route path="/modulos/editar/:id" element={<EditModule />} /> 
              <Route path="/crud/:slug" element={<CrudPage />} />
              <Route path="/aprovacoes" element={<Approvals />} />
              <Route path="/equipe" element={<Team />} />
              <Route path="/perfil" element={<Profile />} />
              {/* Rota de Auditoria */}
              <Route path="/auditoria" element={<AuditLogs />} />
            </Route>

            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;