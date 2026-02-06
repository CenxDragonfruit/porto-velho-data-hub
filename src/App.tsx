import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { Layout } from "./components/layout/Layout";

// --- NOVOS IMPORTS PARA PERFORMANCE (CACHE & PERSISTÊNCIA) ---
import { QueryClient } from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister";

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
import AuditLogs from "./pages/AuditLogs"; 
import NotFound from "./pages/NotFound";

// 1. CONFIGURAÇÃO DO CLIENTE (CACHE)
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Tempo que o dado é considerado "fresco" (não refaz fetch ao mudar de aba)
      staleTime: 1000 * 60 * 5, // 5 minutos
      // Tempo que o dado fica na memória/cache (mesmo sem uso)
      gcTime: 1000 * 60 * 60 * 24, // 24 horas
      // Evita recarregar ao focar na janela (previne "flicker")
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

// 2. CONFIGURAÇÃO DO PERSISTOR (LOCALSTORAGE)
const persister = createSyncStoragePersister({
  storage: window.localStorage,
  // Salva no máximo a cada 1 segundo para não pesar o navegador
  throttleTime: 1000, 
});

const App = () => (
  // 3. TROCA DO PROVIDER PADRÃO PELO PERSIST
  <PersistQueryClientProvider 
    client={queryClient} 
    persistOptions={{ persister }}
    onSuccess={() => {
      // Confirmação no console que o cache foi restaurado
      console.log("Cache restaurado com sucesso!");
    }}
  >
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
              
              {/* --- ROTAS DE MÓDULOS --- */}
              <Route path="/modulos" element={<Modules />} />
              <Route path="/modulos/novo" element={<NewModule />} />
              
              {/* Visualização e Edição */}
              <Route path="/modulos/:id" element={<CrudPage />} />
              <Route path="/modulos/:id/edit" element={<EditModule />} /> 
              
              {/* Outras Rotas */}
              <Route path="/aprovacoes" element={<Approvals />} />
              <Route path="/equipe" element={<Team />} />
              <Route path="/perfil" element={<Profile />} />
              <Route path="/auditoria" element={<AuditLogs />} />
            </Route>

            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </PersistQueryClientProvider>
);

export default App;