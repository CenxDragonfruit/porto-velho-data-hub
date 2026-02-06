import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useUserQuery(email: string | undefined) {
  return useQuery({
    // A chave do cache inclui o email. Se o email mudar, o cache muda.
    queryKey: ['userProfile', email],
    
    // Só executa a busca se tivermos um email (ou seja, sessão técnica do Supabase existe)
    enabled: !!email,

    // --- PERFORMANCE (O SEGREDO DO F5 INSTANTÂNEO) ---
    // staleTime: O perfil do usuário é considerado "novo" por 1 hora. 
    // Durante esse tempo, o F5 vai ler do LocalStorage e não vai ao banco.
    staleTime: 1000 * 60 * 60, 
    
    // gcTime: Mantém os dados na memória/storage por 24 horas antes de limpar.
    gcTime: 1000 * 60 * 60 * 24, 

    queryFn: async () => {
      // Busca o usuário na tabela de negócio 'usuarios'
      const { data: dbUser, error } = await supabase
        .from('usuarios')
        .select(`
          *,
          perfis (
            id,
            nome
          )
        `)
        .eq('email', email)
        .maybeSingle();

      if (error) {
        console.error("Erro ao buscar perfil:", error);
        throw error;
      }

      return dbUser;
    }
  });
}