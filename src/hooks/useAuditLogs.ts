import { useInfiniteQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export type LogFilters = {
  searchTerm: string;
  operation: string;
  dateStart: string;
  dateEnd: string;
};

export function useAuditLogs(filters: LogFilters) {
  const { role } = useAuth(); 

  return useInfiniteQuery({
    queryKey: ['auditLogs', filters, role],
    
    initialPageParam: 0,
    
    // CORREÇÃO 1: Tipagem para evitar erro 'length' no TypeScript
    getNextPageParam: (lastPage: any[], allPages) => {
      if (!lastPage || lastPage.length < 20) return undefined;
      return allPages.length * 20; 
    },

    queryFn: async ({ pageParam = 0 }) => {
      // CORREÇÃO 2: Nome da tabela 'logs_sistema' (era audit_logs)
      let query = supabase
        .from('logs_sistema')
        .select(`
          *,
          usuarios!inner (
            nome_completo, 
            email,
            perfis!inner ( nome ) 
          )
        `)
        // CORREÇÃO 3: Ordenar por 'data_hora' (era timestamp)
        .order('data_hora', { ascending: false })
        .range(pageParam, pageParam + 19);

      if (role === 'SUPERVISOR') {
        query = query.in('usuarios.perfis.nome', ['FUNCIONARIO', 'CONSULTA']);
      }

      // CORREÇÃO 4: Filtros usando os nomes corretos das colunas
      if (filters.operation && filters.operation !== 'ALL') {
        query = query.eq('acao', filters.operation as any);
      }

      if (filters.dateStart) {
        query = query.gte('data_hora', `${filters.dateStart}T00:00:00`);
      }
      if (filters.dateEnd) {
        query = query.lte('data_hora', `${filters.dateEnd}T23:59:59`);
      }

      if (filters.searchTerm) {
        query = query.or(`tabela_alvo.ilike.%${filters.searchTerm}%,usuarios.nome_completo.ilike.%${filters.searchTerm}%`);
      }

      const { data, error } = await query;

      if (error) {
        console.error("Erro Supabase Logs:", error);
        throw new Error("Falha ao carregar histórico.");
      }

      return data as any[];
    },
    
    staleTime: 1000 * 60, 
  });
}