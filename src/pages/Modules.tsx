import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Layout } from '@/components/layout/Layout';
import { supabase } from '@/integrations/supabase/client';
import { CrudModule } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Plus, Database, Edit, Trash2, MoreHorizontal } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';

export default function Modules() {
  const [modules, setModules] = useState<CrudModule[]>([]);
  const navigate = useNavigate();

  useEffect(() => { fetchModules(); }, []);

  const fetchModules = async () => {
    const { data } = await supabase.from('crud_modules').select('*').order('name');
    if (data) setModules(data as CrudModule[]);
  };

  const handleDelete = async (id: string) => {
    await supabase.from('crud_modules').delete().eq('id', id);
    toast.success('Módulo excluído');
    fetchModules();
  };

  return (
    <Layout>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="page-title">Módulos CRUD</h1>
          <p className="page-description">Gerencie os módulos do sistema</p>
        </div>
        <Button onClick={() => navigate('/modulos/novo')} className="btn-gradient-primary">
          <Plus className="mr-2 h-4 w-4" /> Novo Módulo
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {modules.map((module, i) => (
          <motion.div key={module.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} className="stat-card group">
            <div className="flex items-start justify-between">
              <div className="p-3 rounded-xl bg-primary/10"><Database className="h-6 w-6 text-primary" /></div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="bg-popover">
                  <DropdownMenuItem onClick={() => navigate(`/crud/${module.slug}`)}><Edit className="mr-2 h-4 w-4" />Acessar</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleDelete(module.id)} className="text-destructive"><Trash2 className="mr-2 h-4 w-4" />Excluir</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            <h3 className="font-semibold text-lg mt-4">{module.name}</h3>
            <p className="text-sm text-muted-foreground mt-1">{module.description || 'Sem descrição'}</p>
            <Button variant="outline" className="w-full mt-4" onClick={() => navigate(`/crud/${module.slug}`)}>Acessar Módulo</Button>
          </motion.div>
        ))}
        {modules.length === 0 && (
          <div className="col-span-full text-center py-12 text-muted-foreground">
            <Database className="h-12 w-12 mx-auto mb-4 opacity-30" />
            <p>Nenhum módulo criado ainda</p>
          </div>
        )}
      </div>
    </Layout>
  );
}
