import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Session, User } from '@supabase/supabase-js';
import { Database } from '@/integrations/supabase/types';
// 1. Importamos o novo hook de query
import { useUserQuery } from './useUserQuery';

// --- TIPO DE DADOS ---
export type UserRoleName = 'ADMINISTRADOR' | 'SUPERVISOR' | 'FUNCIONARIO' | 'CONSULTA';

export type UserData = Database['public']['Tables']['usuarios']['Row'] & {
  perfis: Database['public']['Tables']['perfis']['Row'] | null;
};

export type Permission = 
  | 'manage_users' 
  | 'manage_modules' 
  | 'approve_data' 
  | 'view_dashboard' 
  | 'export_data' 
  | 'view_logs';

type AuthContextType = {
  user: User | null;
  session: Session | null;
  userData: UserData | null;
  role: UserRoleName | null;
  loading: boolean;
  signIn: (e: string, p: string) => Promise<{ data: any; error: any }>;
  signOut: () => Promise<void>;
  checkPermission: (permission: Permission) => boolean;
  canWriteInModule: (moduleId: number) => Promise<boolean>;
};

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  // Estado apenas para a sessão técnica do Supabase (Token)
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  // 1. Inicializa sessão do Supabase 
  // (Isso é rápido porque o Supabase Client já tem seu próprio localstorage)
  useEffect(() => {
    const initSession = async () => {
      const { data } = await supabase.auth.getSession();
      setSession(data.session);
      setUser(data.session?.user ?? null);
      setAuthLoading(false);
    };
    initSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      setAuthLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  // 2. BUSCA DADOS DO USUÁRIO NO BANCO (VIA REACT QUERY)
  // O "pulo do gato": Se existir cache no localStorage, 'userData' já vem preenchido!
  // 'isProfileLoading' será true enquanto ele valida no fundo, mas não precisamos esperar se já temos dados.
  const { data: userData, isLoading: isProfileLoading } = useUserQuery(user?.email);

  // 3. Deriva a Role (Papel) baseado no que veio do banco/cache
  const role = (userData?.perfis?.nome?.toUpperCase() as UserRoleName) || null;

  // 4. Lógica de Loading Otimizada
  // Só mostramos o spinner se:
  // - O Auth do Supabase ainda não respondeu (authLoading)
  // - OU temos um usuário logado, mas o React Query ainda não tem dados (nem cache, nem banco)
  // Se 'userData' existir (mesmo que do cache), o loading é false e a tela abre.
  const loading = authLoading || (!!session && isProfileLoading && !userData);

  // --- PERMISSÕES (Mantidas iguais, mas agora usam as variáveis derivadas) ---
  const checkPermission = useCallback((permission: Permission): boolean => {
    if (!role) return false;
    if (role === 'ADMINISTRADOR') return true;

    switch (permission) {
      case 'manage_users': 
      case 'manage_modules': 
      case 'view_logs': 
        return false;

      case 'approve_data': 
        return role === 'SUPERVISOR';

      case 'export_data': 
      case 'view_dashboard': 
        return ['SUPERVISOR', 'FUNCIONARIO', 'CONSULTA'].includes(role);

      default: return false;
    }
  }, [role]);

  const canWriteInModule = useCallback(async (moduleId: number): Promise<boolean> => {
    if (!userData?.id || !role) return false;
    if (role === 'ADMINISTRADOR') return true;
    if (role === 'CONSULTA') return false;

    try {
      const { data, error } = await supabase
        .from('permissoes_modulo')
        .select('pode_inserir, pode_editar')
        .eq('usuario_id', userData.id)
        .eq('modulo_id', moduleId)
        .maybeSingle();

      if (error || !data) return false;
      return data.pode_inserir === true || data.pode_editar === true;
    } catch (err) { 
      console.error(`Erro permissão módulo ${moduleId}:`, err);
      return false; 
    }
  }, [role, userData]);

  // --- AÇÕES ---
  const signIn = async (e: string, p: string) => {
    return supabase.auth.signInWithPassword({ email: e, password: p });
  };

  const signOut = async () => {
    try {
      await supabase.auth.signOut();
      // Ao deslogar, o estado local limpa. 
      // O React Query limpará o cache userProfile automaticamente pois a key (email) ficará undefined.
    } catch (error) {
      console.error("Erro no logout:", error);
    }
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      session, 
      userData: userData || null, // Garante null se undefined
      role, 
      loading, 
      signIn, 
      signOut, 
      checkPermission, 
      canWriteInModule 
    }}>
      {children}
    </AuthContext.Provider> 
  );
};

export const useAuth = () => useContext(AuthContext);