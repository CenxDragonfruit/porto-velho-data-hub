import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

// --- HOOK DE BUSCA (CACHE) ---
export function useModulos() {
  const { userData, role } = useAuth();

  return useQuery({
    // A chave do cache: ['modulos', id_do_usuario]
    // Se o usuário mudar, o cache reseta automaticamente.
    queryKey: ['modulos', userData?.id],

    // CONFIGURAÇÃO DE PERFORMANCE (O "Pulo do Gato"):
    // 1. staleTime: Durante 5 minutos, os dados são considerados "frescos". 
    //    Se você sair da tela e voltar nesse tempo, NÃO há nova requisição ao banco. (NF-002)
    staleTime: 1000 * 60 * 5, 
    
    // 2. gcTime: Mantém os dados na memória por 30 min antes de limpar o lixo.
    gcTime: 1000 * 60 * 30,
    
    // 3. Só executa se tivermos um usuário logado e validado
    enabled: !!userData && !!role,

    queryFn: async () => {
      if (!userData) return [];

      let data = [];
      let error = null;

      // Lógica de Permissão baseada no seu AuthContext (RF-002)
      if (role === 'ADMINISTRADOR') {
        // Admin vê tudo direto da tabela modulos
        const response = await supabase
          .from('modulos')
          .select('*, categoria_id')
          .eq('ativo', true)
          .order('criado_em', { ascending: false });
        
        data = response.data || [];
        error = response.error;
      } else {
        // Outros perfis veem via tabela de permissões (RF-003)
        const response = await supabase
          .from('permissoes_modulo')
          .select(`
            modulo_id,
            pode_visualizar,
            modulos (
              id, nome, descricao, criado_em, categoria_id, ativo
            )
          `)
          .eq('usuario_id', userData.id)
          .eq('pode_visualizar', true)
          .eq('modulos.ativo', true);

        if (response.data) {
          // Limpa a estrutura aninhada que o Supabase retorna no Join
          data = response.data
            .map((item: any) => item.modulos)
            .filter((mod: any) => mod !== null);
        }
        error = response.error;
      }

      if (error) {
        console.error("Erro ao buscar módulos:", error);
        throw new Error("Falha ao carregar sistemas.");
      }

      return data;
    }
  });
}

// --- HOOK DE DELEÇÃO (MUTAÇÃO) ---
export function useDeleteModule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, categoriaId }: { id: number, categoriaId: string | null }) => {
      // Prioridade: Apagar a Categoria (Pai) se existir, para o CASCADE do banco limpar o resto.
      if (categoriaId) {
        const { error } = await supabase
          .from('categorias_modulo')
          .delete()
          .eq('id', Number(categoriaId)); // Garante que é número
        
        if (error) throw error;
      } else {
        // Fallback: Apaga apenas o módulo se não tiver categoria vinculada (legado)
        const { error } = await supabase
          .from('modulos')
          .delete()
          .eq('id', id);
          
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Sistema excluído com sucesso.");
      
      // MÁGICA DO REACT QUERY:
      // Isso avisa: "O cache de 'modulos' está velho".
      // A lista na tela principal vai se atualizar sozinha imediatamente.
      queryClient.invalidateQueries({ queryKey: ['modulos'] });
    },
    onError: (error: any) => {
      console.error("Erro na exclusão:", error);
      toast.error("Não foi possível excluir: " + (error.message || "Erro desconhecido"));
    }
  });
}