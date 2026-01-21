import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Session, User } from '@supabase/supabase-js';

export type UserRole = 'consulta' | 'funcionario' | 'supervisor' | 'administrador';
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
};

const AuthContext = createContext<AuthContextType>({} as any);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<any>(null);
  const [role, setRole] = useState<UserRole>('consulta');
  const [loading, setLoading] = useState(true);

  // Busca perfil em background (não bloqueia a UI)
  const fetchProfile = async (userId: string) => {
    try {
      const { data } = await supabase.from('profiles').select('*').eq('user_id', userId).maybeSingle();
      if (data) {
        setProfile(data);
        setRole((data.role as UserRole) || 'consulta');
      }
    } catch (e) {
      console.error("Erro perfil:", e);
    }
  };

  useEffect(() => {
    let mounted = true;

    const initAuth = async () => {
      try {
        // TÉCNICA DE CORRIDA:
        // O Supabase tem 2 segundos para responder. Se não responder, forçamos a liberação.
        // Isso impede que a tela fique branca/travada para sempre.
        const sessionPromise = supabase.auth.getSession();
        const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject("Timeout"), 2000));

        const result: any = await Promise.race([sessionPromise, timeoutPromise]);
        
        if (mounted && result?.data?.session) {
          const s = result.data.session;
          setSession(s);
          setUser(s.user);
          // Libera a tela IMEDIATAMENTE, perfil carrega depois
          setLoading(false);
          await fetchProfile(s.user.id);
        } else if (mounted) {
          // Se não tiver sessão ou der timeout
          setLoading(false);
        }

      } catch (error) {
        // Se der erro ou timeout, libera a tela para o usuário não ficar preso
        console.warn("Auth check demorou ou falhou, liberando UI...", error);
        if (mounted) setLoading(false);
      }
    };

    initAuth();

    // Listener para manter sincronia
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return;

      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
        if (session?.user && !profile) await fetchProfile(session.user.id);
      } 
      else if (event === 'SIGNED_OUT') {
        setUser(null);
        setSession(null);
        setProfile(null);
        setRole('consulta');
        setLoading(false);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const checkPermission = (permission: Permission): boolean => {
    if (role === 'administrador') return true;
    switch (permission) {
      case 'approve_data': return role === 'supervisor';
      case 'manage_team': return role === 'supervisor';
      default: return false;
    }
  };

  const signIn = async (e: string, p: string) => supabase.auth.signInWithPassword({ email: e, password: p });
  
  const signOut = async () => {
    try {
      setLoading(true);
      await supabase.auth.signOut();
    } finally {
      setUser(null); setSession(null); setProfile(null); setRole('consulta');
      setLoading(false);
    }
  };

  return (
    <AuthContext.Provider value={{ user, session, profile, role, loading, signIn, signOut, checkPermission }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) throw new Error('useAuth deve ser usado dentro de um AuthProvider');
  return context;
};