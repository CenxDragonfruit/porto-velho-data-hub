import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Session, User } from '@supabase/supabase-js';

// --- Tipos ---
export type UserRole = 'consulta' | 'funcionario' | 'supervisor' | 'administrador' | null;
export type Permission = 'approve_data' | 'manage_team' | 'create_system' | 'delete_system';

type AuthContextType = {
  user: User | null;
  session: Session | null;
  profile: any | null;
  role: UserRole;
  loading: boolean;
  signIn: (e: string, p: string) => Promise<{ data: any; error: any }>;
  signOut: () => Promise<void>;
  checkPermission: (permission: Permission) => boolean;
  canWriteInModule: (moduleId: string) => Promise<boolean>;
};

const AuthContext = createContext<AuthContextType>({} as any);

// Função auxiliar para logs
const debugLog = (msg: string, data?: any) => {
  // Descomente a linha abaixo se quiser ver os logs no console
  // console.log(`%c[AUTH_DEBUG] ${msg}`, 'color: #00bfff; font-weight: bold;', data || '');
};

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<any>(null);
  const [role, setRole] = useState<UserRole>(null);
  const [loading, setLoading] = useState(true);

  // Refs para controle de estado assíncrono
  const isFetchingRef = useRef(false); 
  const mountedRef = useRef(true);

  // --- 1. Busca Perfil com TIMEOUT (Anti-Travamento) ---
  const fetchProfile = async (userId: string) => {
    try {
      // Cria uma promessa que falha após 5 segundos
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('TIMEOUT_DB')), 5000)
      );

      // A busca real no banco
      const dbPromise = supabase
        .from('profiles')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      // Corrida: quem terminar primeiro ganha. Se o banco demorar, o timeout ganha.
      const result: any = await Promise.race([dbPromise, timeoutPromise]);

      if (result.error) {
        console.error("[AUTH_ERROR] Erro no banco ao buscar perfil:", result.error);
        return null;
      }
      return result.data;

    } catch (e: any) {
      if (e.message === 'TIMEOUT_DB') {
        console.warn("[AUTH_WARNING] O banco demorou demais. Liberando acesso básico.");
      } else {
        console.error("[AUTH_CRITICAL] Exceção ao buscar perfil:", e);
      }
      return null;
    }
  };

  // --- 2. Carrega Dados do Usuário (Central) ---
  const loadUserData = useCallback(async (currentSession: Session | null, source: string) => {
    // Se já está carregando, evita duplicidade (exceto se for logout forçado)
    if (isFetchingRef.current && source !== 'LOGOUT') return;

    debugLog(`loadUserData iniciado via [${source}]`);
    isFetchingRef.current = true;
    
    try {
      // Caso 1: Sem sessão (usuário deslogado)
      if (!currentSession?.user) {
        if (mountedRef.current) {
          setUser(null);
          setSession(null);
          setProfile(null);
          setRole(null);
        }
        return; 
      }

      // Caso 2: Com sessão
      const userId = currentSession.user.id;
      
      if (mountedRef.current) {
        setUser(currentSession.user);
        setSession(currentSession);
      }
      
      // Busca perfil (com proteção de timeout)
      const userProfile = await fetchProfile(userId);

      if (mountedRef.current) {
        if (userProfile) {
          setProfile(userProfile);
          setRole((userProfile.role as UserRole) || 'consulta');
        } else {
          // Fallback seguro: se não carregar perfil, define como consulta básica
          setProfile(null);
          setRole('consulta');
        }
      }

    } catch (error) {
      console.error("[AUTH_CRITICAL] Erro fatal no loadUserData:", error);
    } finally {
      isFetchingRef.current = false;
      if (mountedRef.current) {
        debugLog(`Finalizando loadUserData [${source}]. Loading -> FALSE.`);
        setLoading(false);
      }
    }
  }, []);

  // --- 3. Inicialização e Eventos ---
  useEffect(() => {
    mountedRef.current = true;
    debugLog("--- AuthProvider Montado ---");

    // Inicialização Manual
    const init = async () => {
      try {
        const { data: { session: initialSession }, error } = await supabase.auth.getSession();
        
        if (error) throw error;

        if (initialSession) {
          // Se tem sessão, carrega os dados
          await loadUserData(initialSession, 'MANUAL_INIT');
        } else {
          // Se não tem sessão, libera o loading imediatamente
          if (mountedRef.current) setLoading(false);
        }
      } catch (err) {
        console.error("Erro no init", err);
        if (mountedRef.current) setLoading(false);
      }
    };

    init();

    // Listener de Eventos do Supabase
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, newSession) => {
      debugLog(`EVENTO: ${event}`);
      
      if (!mountedRef.current) return;

      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        // Pequeno delay para garantir que não colida com o init manual
        if (!isFetchingRef.current) {
             await loadUserData(newSession, 'AUTH_CHANGE');
        }
      } else if (event === 'SIGNED_OUT') {
        // Limpeza imediata
        isFetchingRef.current = false; // Força reset da flag
        await loadUserData(null, 'LOGOUT');
        if (mountedRef.current) setLoading(false);
      }
    });

    return () => {
      mountedRef.current = false;
      subscription.unsubscribe();
    };
  }, [loadUserData]);

  // --- Funções Auxiliares (Mantidas) ---
  const checkPermission = (permission: Permission): boolean => {
    if (!role) return false;
    if (role === 'administrador') return true;
    switch (permission) {
      case 'approve_data': return role === 'supervisor';
      case 'manage_team': return role === 'supervisor';
      case 'create_system': return role === 'administrador';
      case 'delete_system': return role === 'administrador';
      default: return false;
    }
  };

  const canWriteInModule = async (moduleId: string): Promise<boolean> => {
    if (!role || role === 'consulta') return false;
    if (role === 'administrador') return true;
    if (!profile?.id) return false;
    const { data, error } = await supabase
      .from('profile_modules')
      .select('id')
      .eq('profile_id', profile.id)
      .eq('crud_module_id', moduleId)
      .maybeSingle();
    return !!data && !error;
  };

  const signIn = async (e: string, p: string) => {
    return supabase.auth.signInWithPassword({ email: e, password: p });
  };
  
  const signOut = async () => {
    setLoading(true);
    try {
      await supabase.auth.signOut();
    } catch(e) {
      console.error("Erro ao sair:", e);
    } 
    // O evento onAuthStateChange cuidará do resto, mas garantimos aqui:
    if (mountedRef.current) setLoading(false);
  };

  return (
    <AuthContext.Provider value={{ user, session, profile, role, loading, signIn, signOut, checkPermission, canWriteInModule }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);