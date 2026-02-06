import { Outlet, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Sidebar } from './Sidebar';
import { Footer } from './Footer';
import { Loader2, ShieldAlert, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function Layout() {
  // ADAPTAÇÃO: Buscamos também 'userData' (dados do banco) e 'signOut'
  const { user, userData, loading, signOut } = useAuth();
  const location = useLocation();

  // 1. CARREGAMENTO
  if (loading) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-2">
          <Loader2 className="h-8 w-8 animate-spin text-[#003B8F]" />
          <p className="text-sm text-muted-foreground">Validando acesso...</p>
        </div>
      </div>
    );
  }

  // 2. SEM LOGIN TÉCNICO (Supabase Auth)
  if (!user) {
    return <Navigate to="/auth" state={{ from: location }} replace />;
  }

  // 3. HARDENING: COM LOGIN, MAS SEM PERFIL VÁLIDO NO BANCO
  // Isso acontece se o usuário foi deletado do banco 'usuarios' ou desativado (is_ativo = false)
  // mas o token de sessão do navegador ainda é válido.
  if (!userData || userData.is_ativo === false) {
    return (
      <div className="h-screen w-full flex flex-col items-center justify-center bg-slate-50 p-4">
        <div className="bg-white p-8 rounded-2xl shadow-xl border border-slate-100 max-w-md w-full text-center space-y-6">
            <div className="mx-auto w-16 h-16 bg-red-50 rounded-full flex items-center justify-center">
                <ShieldAlert className="h-8 w-8 text-red-600" />
            </div>
            
            <div className="space-y-2">
                <h1 className="text-2xl font-bold text-slate-900">Acesso Interrompido</h1>
                <p className="text-slate-500 leading-relaxed">
                    {userData?.is_ativo === false 
                        ? "Sua conta foi desativada temporariamente pelo administrador." 
                        : "Não foi possível localizar seu cadastro funcional no sistema."}
                </p>
            </div>

            <div className="pt-2">
                <Button 
                    variant="outline" 
                    onClick={() => signOut()} 
                    className="w-full border-slate-200 hover:bg-slate-50 text-slate-700"
                >
                    <LogOut className="mr-2 h-4 w-4" />
                    Encerrar Sessão
                </Button>
            </div>
            
            <p className="text-xs text-slate-400 mt-4">
                Caso acredite ser um erro, contate a SMTI: (69) 3901-3079
            </p>
        </div>
      </div>
    );
  }

  // 4. ACESSO LIBERADO (Renderiza Sidebar + Conteúdo)
  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">
      <Sidebar />
      <main className="flex-1 flex flex-col h-full overflow-auto w-full relative scrollbar-thin scrollbar-thumb-slate-200 scrollbar-track-transparent">
        <div className="flex-1 w-full max-w-[1600px] mx-auto p-4 md:p-6 lg:p-8 animate-in fade-in duration-300">
          <Outlet />
        </div>
        <Footer />
      </main>
    </div>
  );
}