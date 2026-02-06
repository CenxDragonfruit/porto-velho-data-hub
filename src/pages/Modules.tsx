import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { 
  Loader2, Search, Database, ArrowRight, ShieldAlert, 
  Plus, MoreVertical, Pencil, Trash2 
} from 'lucide-react';
import { toast } from 'sonner';

export default function Modules() {
  const navigate = useNavigate();
  const { userData, role } = useAuth();
  const [modules, setModules] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (userData) {
        loadModules();
    }
  }, [userData]);

  const loadModules = async () => {
    setLoading(true);
    try {
      let data = [];
      let error = null;

      if (role === 'ADMINISTRADOR') {
          // Alterado para buscar também o categoria_id
          const response = await supabase
            .from('modulos')
            .select('*, categoria_id')
            .eq('ativo', true)
            .order('criado_em', { ascending: false });
          data = response.data || [];
          error = response.error;
      } else {
          const response = await supabase
            .from('permissoes_modulo')
            .select(`
                modulo_id,
                pode_visualizar,
                modulos (
                    id,
                    nome,
                    descricao,
                    criado_em,
                    categoria_id
                )
            `)
            .eq('usuario_id', userData?.id)
            .eq('pode_visualizar', true)
            .eq('modulos.ativo', true);

          if (response.data) {
              data = response.data
                .map((item: any) => item.modulos)
                .filter((mod: any) => mod !== null);
          }
          error = response.error;
      }

      if (error) throw error;
      setModules(data);

    } catch (error: any) {
      console.error('Erro ao carregar módulos:', error);
      toast.error("Não foi possível carregar a lista de sistemas.");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteModule = async (id: number, nome: string, categoriaId: string | null) => {
    if (!confirm(`Tem certeza que deseja excluir o sistema "${nome}"? Todos os dados serão perdidos.`)) return;

    try {
        // Se houver uma categoria vinculada, deletamos a categoria. 
        // Com o ON DELETE CASCADE no banco, o módulo e tudo abaixo dele sumirá.
        if (categoriaId) {
            const { error: catError } = await supabase
                .from('categorias_modulo')
                .delete()
                .eq('id', Number(categoriaId));

            if (catError) throw catError;
        } else {
            // Backup caso o módulo não tenha categoria (registros antigos)
            const { error: modError } = await supabase
                .from('modulos')
                .delete()
                .eq('id', id);

            if (modError) throw modError;
        }

        toast.success("Sistema excluído com sucesso.");
        // Atualiza a lista localmente filtrando o ID do módulo removido
        setModules(prev => prev.filter(m => m.id !== id));
    } catch (err: any) {
        console.error("Erro na exclusão:", err);
        toast.error("Erro ao excluir: " + err.message);
    }
  };

  const filteredModules = modules.filter(m => 
    m.nome?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    (m.descricao || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-in fade-in pt-6 pb-20">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-[#003B8F]">Sistemas de Dados</h1>
          <p className="text-slate-500 mt-1">
            Acesse os módulos aos quais você possui permissão.
          </p>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
            <div className="relative w-full md:w-64">
                <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                <Input 
                  placeholder="Filtrar sistemas..." 
                  className="pl-10 bg-white border-slate-200 focus:border-[#003B8F] transition-colors"
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                />
            </div>

            {role === 'ADMINISTRADOR' && (
                <Button 
                    onClick={() => navigate('/modulos/novo')} 
                    className="bg-[#22C55E] hover:bg-green-600 text-white shadow-sm font-semibold whitespace-nowrap"
                >
                    <Plus className="mr-2 h-4 w-4" /> Novo Sistema
                </Button>
            )}
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center p-12 gap-4">
          <Loader2 className="h-10 w-10 animate-spin text-[#003B8F]" />
          <p className="text-sm text-slate-400 animate-pulse">Carregando permissões...</p>
        </div>
      ) : filteredModules.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 px-4 bg-slate-50 border-2 border-dashed border-slate-200 rounded-2xl text-center">
          <div className="bg-white p-4 rounded-full shadow-sm mb-4">
            {searchTerm ? <Search className="h-8 w-8 text-slate-400" /> : <ShieldAlert className="h-8 w-8 text-amber-500" />}
          </div>
          
          {searchTerm ? (
            <>
              <h3 className="text-lg font-semibold text-slate-900">Nenhum resultado para "{searchTerm}"</h3>
              <Button variant="link" onClick={() => setSearchTerm('')} className="mt-2 text-[#003B8F]">Limpar filtros</Button>
            </>
          ) : (
            <>
              <h3 className="text-lg font-semibold text-slate-900">Nenhum sistema disponível</h3>
              <p className="text-slate-500 max-w-md mt-2 leading-relaxed">
                  Você não possui acesso a nenhum módulo ou o banco está vazio.
              </p>
              {role === 'ADMINISTRADOR' && (
                <Button onClick={() => navigate('/modulos/novo')} className="mt-4 bg-[#003B8F]">
                    Criar Primeiro Módulo
                </Button>
              )}
            </>
          )}
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filteredModules.map((module) => (
            <Card key={module.id} className="hover:shadow-lg transition-all duration-300 border-slate-200 group relative overflow-hidden bg-white flex flex-col h-full">
              <div className="absolute top-0 left-0 w-1.5 h-full bg-[#003B8F] opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              
              <CardHeader className="pb-4 flex-1">
                <div className="flex justify-between items-start mb-3">
                    <div className="p-3 bg-blue-50 rounded-xl text-[#003B8F] group-hover:bg-[#003B8F] group-hover:text-white transition-colors duration-300 shadow-sm">
                        <Database className="h-6 w-6" />
                    </div>
                    
                    {role === 'ADMINISTRADOR' && (
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-[#003B8F]">
                                    <MoreVertical className="h-4 w-4" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => navigate(`/modulos/${module.id}/edit`)}>
                                    <Pencil className="mr-2 h-4 w-4" /> Editar Estrutura
                                </DropdownMenuItem>
                                <DropdownMenuItem 
                                  onClick={() => handleDeleteModule(module.id, module.nome, module.categoria_id)} 
                                  className="text-red-600 focus:text-red-600 focus:bg-red-50"
                                >
                                    <Trash2 className="mr-2 h-4 w-4" /> Excluir Sistema
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    )}
                </div>

                <CardTitle className="text-lg font-bold text-slate-800 line-clamp-1 group-hover:text-[#003B8F] transition-colors">
                    {module.nome}
                </CardTitle>
                <CardDescription className="line-clamp-2 text-sm mt-1.5 min-h-[40px]">
                  {module.descricao || "Sem descrição."}
                </CardDescription>
                
                {new Date(module.criado_em).getTime() > Date.now() - 7 * 24 * 60 * 60 * 1000 && (
                   <div className="mt-2">
                     <Badge variant="secondary" className="text-[10px] bg-green-100 text-green-700 hover:bg-green-100 border-0">NOVO</Badge>
                   </div>
                )}
              </CardHeader>
              
              <CardFooter className="pt-0 pb-6">
                <Button 
                    className="w-full bg-slate-50 text-[#003B8F] hover:bg-[#003B8F] hover:text-white border border-slate-200 font-semibold group-hover:border-[#003B8F] transition-all duration-300 shadow-sm"
                    onClick={() => navigate(`/modulos/${module.id}`)}
                >
                  ACESSAR <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}