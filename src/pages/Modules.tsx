import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Loader2, Search, Database, ArrowRight, ShieldAlert } from 'lucide-react';
import { toast } from 'sonner';

export default function Modules() {
  const navigate = useNavigate();
  const { role } = useAuth();
  const [modules, setModules] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    loadModules();
  }, []);

  const loadModules = async () => {
    setLoading(true);
    try {
      // A query é simples porque a SEGURANÇA (RLS) no banco já filtra tudo.
      // Se for admin, o banco retorna tudo. Se for funcionário, retorna só os vinculados.
      const { data, error } = await supabase
        .from('crud_modules')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setModules(data || []);
    } catch (error: any) {
      console.error('Erro ao carregar módulos:', error);
      toast.error("Erro ao carregar sistemas.");
    } finally {
      setLoading(false);
    }
  };

  const filteredModules = modules.filter(m => 
    m.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (m.description || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-in fade-in pt-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-[#003B8F]">Meus Sistemas</h1>
          <p className="text-slate-500 mt-1">
            Acesse os módulos aos quais você tem permissão.
          </p>
        </div>
        
        {/* Barra de Busca (Só aparece se tiver módulos) */}
        {modules.length > 0 && (
          <div className="relative w-full md:w-72">
            <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
            <Input 
              placeholder="Filtrar sistemas..." 
              className="pl-10 bg-white border-slate-200"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center p-12">
          <Loader2 className="h-8 w-8 animate-spin text-[#003B8F]" />
        </div>
      ) : filteredModules.length === 0 ? (
        // --- ESTADO VAZIO (Onde o funcionário vai cair se não tiver vínculo) ---
        <div className="flex flex-col items-center justify-center py-16 px-4 bg-slate-50 border border-dashed border-slate-200 rounded-2xl text-center">
          <div className="bg-white p-4 rounded-full shadow-sm mb-4">
            {searchTerm ? <Search className="h-8 w-8 text-slate-400" /> : <ShieldAlert className="h-8 w-8 text-yellow-500" />}
          </div>
          
          {searchTerm ? (
            <>
              <h3 className="text-lg font-semibold text-slate-900">Nenhum resultado para "{searchTerm}"</h3>
              <p className="text-slate-500">Tente buscar por outro termo.</p>
              <Button variant="link" onClick={() => setSearchTerm('')} className="mt-2 text-[#003B8F]">Limpar busca</Button>
            </>
          ) : (
            <>
              <h3 className="text-lg font-semibold text-slate-900">Nenhum sistema vinculado</h3>
              <p className="text-slate-500 max-w-md mt-2">
                Você ainda não possui acesso a nenhum módulo. Entre em contato com seu gestor ou administrador para solicitar permissões.
              </p>
              {role === 'administrador' && (
                <Button onClick={() => navigate('/modulos/novo')} className="mt-6 bg-[#003B8F]">
                  Criar Novo Sistema
                </Button>
              )}
            </>
          )}
        </div>
      ) : (
        // --- LISTA DE CARTÕES ---
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {filteredModules.map((module) => (
            <Card key={module.id} className="hover:shadow-lg transition-all border-slate-200 group relative overflow-hidden">
              <div className="absolute top-0 left-0 w-1 h-full bg-[#003B8F] opacity-0 group-hover:opacity-100 transition-opacity" />
              
              <CardHeader>
                <div className="flex justify-between items-start mb-2">
                    <div className="p-2.5 bg-blue-50 rounded-lg text-[#003B8F]">
                        <Database className="h-5 w-5" />
                    </div>
                    {role === 'administrador' && (
                        <Badge variant="outline" className="text-[10px] bg-slate-50 text-slate-500">ADMIN</Badge>
                    )}
                </div>
                <CardTitle className="text-xl text-slate-800">{module.name}</CardTitle>
                <CardDescription className="line-clamp-2 min-h-[40px]">
                  {module.description || "Sem descrição definida."}
                </CardDescription>
              </CardHeader>
              
              <CardFooter className="pt-0">
                <Button 
                    className="w-full bg-slate-50 text-[#003B8F] hover:bg-[#003B8F] hover:text-white border border-slate-100 font-semibold group-hover:border-[#003B8F]"
                    onClick={() => navigate(`/crud/${module.slug}`)}
                >
                  ACESSAR <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}