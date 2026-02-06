import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { 
    Plus, Trash2, Save, ArrowLeft, X, Loader2, List, Type, Hash, 
    DollarSign, Calendar, Clock, CheckSquare, Settings, PlusCircle 
} from 'lucide-react';
import { toast } from 'sonner';
import { motion } from 'framer-motion';

// --- (Mantive o FieldRow e TYPE_ICONS iguais ao seu código para economizar espaço, eles estavam corretos) ---
const TYPE_ICONS: any = {
    TEXTO: Type, TEXTO_LONGO: List, INTEIRO: Hash, DECIMAL: DollarSign,
    DATA: Calendar, HORA: Clock, CPF: CheckSquare, SELECAO_LISTA: List
};
const generateTempId = () => `temp_${Math.random().toString(36).substr(2, 9)}`;

const FieldRow = ({ field, onUpdate, onRemove }: any) => {
    // ... (Seu código do FieldRow aqui. Ele estava ótimo) ...
    const [newOption, setNewOption] = useState('');
    const Icon = TYPE_ICONS[field.tipo] || Type;

    return (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="p-4 border rounded-xl bg-white space-y-4 shadow-sm hover:border-blue-300 transition-all group">
            <div className="flex flex-col md:flex-row gap-4 items-start md:items-end">
                <div className="flex-1 w-full space-y-1.5">
                    <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Nome do Campo</Label>
                    <Input value={field.label_visual} onChange={(e) => onUpdate(field.id, { label_visual: e.target.value })} className="font-medium h-9" />
                </div>
                <div className="w-full md:w-[200px] space-y-1.5">
                    <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Tipo de Dado</Label>
                    <Select value={field.tipo} onValueChange={(v) => onUpdate(field.id, { tipo: v })}>
                        <SelectTrigger className="h-9"><div className="flex items-center gap-2"><Icon className="w-3.5 h-3.5 text-slate-500" /><SelectValue /></div></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="TEXTO">Texto Curto</SelectItem>
                            <SelectItem value="TEXTO_LONGO">Texto Longo</SelectItem>
                            <SelectItem value="INTEIRO">Número Inteiro</SelectItem>
                            <SelectItem value="DECIMAL">Valor Monetário</SelectItem>
                            <SelectItem value="DATA">Data</SelectItem>
                            <SelectItem value="HORA">Hora</SelectItem>
                            <SelectItem value="SELECAO_LISTA">Lista de Opções</SelectItem>
                            <SelectItem value="CPF">CPF</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                <div className="flex items-center gap-4 pb-2">
                    <div className="flex items-center gap-2 cursor-pointer" onClick={() => onUpdate(field.id, { obrigatorio: !field.obrigatorio })}>
                        <Switch checked={field.obrigatorio} onCheckedChange={(c) => onUpdate(field.id, { obrigatorio: c })} />
                        <span className="text-xs font-medium text-slate-600">Obrigatório</span>
                    </div>
                    <div className="h-6 w-px bg-slate-200 mx-2" />
                    <Button variant="ghost" size="icon" onClick={() => onRemove(field.id)} className="h-8 w-8 text-slate-300 hover:text-red-500 hover:bg-red-50"><Trash2 className="h-4 w-4" /></Button>
                </div>
            </div>
            {field.tipo === 'SELECAO_LISTA' && (
                <div className="bg-slate-50 p-4 rounded-lg border border-slate-100">
                    <Label className="text-xs font-bold text-slate-500 uppercase mb-2 block">Opções da Lista</Label>
                    <div className="flex flex-wrap gap-2 mb-3">
                        {field.options?.map((opt:any, i:number) => (
                            <span key={i} className="bg-white border px-2.5 py-1 rounded-full text-xs font-medium text-slate-700 flex items-center gap-1.5 shadow-sm">
                                {opt.label} <X className="h-3 w-3 cursor-pointer text-slate-400 hover:text-red-500" onClick={() => {
                                    const newOptions = field.options.filter((_:any, idx:number) => idx !== i);
                                    onUpdate(field.id, { options: newOptions });
                                }}/>
                            </span>
                        ))}
                    </div>
                    <div className="flex gap-2">
                        <Input value={newOption} onChange={e=>setNewOption(e.target.value)} placeholder="Nova opção..." className="h-8 text-sm bg-white" 
                            onKeyDown={(e) => {
                                if(e.key === 'Enter' && newOption.trim()) {
                                    e.preventDefault();
                                    const val = newOption.trim();
                                    const slug = val.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, '_');
                                    onUpdate(field.id, { options: [...(field.options||[]), { label: val, value: slug }] });
                                    setNewOption('');
                                }
                            }}
                        />
                         <Button size="sm" variant="secondary" className="h-8" onClick={() => {
                             if(newOption.trim()) {
                                 const val = newOption.trim();
                                 const slug = val.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, '_');
                                 onUpdate(field.id, { options: [...(field.options||[]), { label: val, value: slug }] });
                                 setNewOption('');
                             }
                         }}>Add</Button>
                    </div>
                </div>
            )}
        </motion.div>
    );
};
// --- FIM DO FIELD ROW ---

export default function EditModule() {
  const { id } = useParams();
  const moduleId = Number(id);
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  const [moduleData, setModuleData] = useState<any>({});
  const [siblingModules, setSiblingModules] = useState<any[]>([]);
  const [fields, setFields] = useState<any[]>([]);

  useEffect(() => { 
      if (id && !isNaN(moduleId)) {
          loadData(); 
      } else {
          toast.error("ID inválido");
          navigate('/modulos');
      }
  }, [id]);

  const loadData = async () => {
    setLoading(true);
    try {
        const { data: mod, error } = await supabase
            .from('modulos')
            .select('*, categorias_modulo(id, nome)')
            .eq('id', moduleId)
            .single();
        
        if(error || !mod) throw new Error("Módulo não encontrado");
        setModuleData(mod);

        // Carrega "irmãos" (tabelas do mesmo sistema)
        if (mod.categoria_id) {
            const { data: siblings } = await supabase
                .from('modulos')
                .select('id, nome')
                .eq('categoria_id', mod.categoria_id)
                .neq('id', moduleId);
            setSiblingModules(siblings || []);
        }

        const { data: cols } = await supabase
            .from('definicao_colunas')
            .select(`*, catalogos_dominio ( itens_catalogo ( valor_exibicao, chave ) )`)
            .eq('modulo_id', moduleId)
            .order('ordem');

        const normalizedFields = (cols || []).map(c => {
            let options: any[] = [];
            if (c.catalogos_dominio?.itens_catalogo) {
                options = c.catalogos_dominio.itens_catalogo.map((it:any) => ({
                    label: it.valor_exibicao, value: it.chave
                }));
            }
            return {
                id: c.id, 
                label_visual: c.label_visual,
                nome_tecnico: c.nome_tecnico,
                tipo: c.tipo,
                obrigatorio: c.obrigatorio,
                options: options,
                isNew: false
            };
        });
        setFields(normalizedFields);
    } catch(e) { 
        console.error(e); navigate('/modulos'); 
    } finally { setLoading(false); }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
        await supabase
            .from('modulos')
            .update({ nome: moduleData.nome, descricao: moduleData.descricao })
            .eq('id', moduleId);

        for (const [index, f] of fields.entries()) {
            const payload = {
                modulo_id: moduleId,
                label_visual: f.label_visual,
                // Mantém o nome técnico antigo se já existir para não quebrar dados, gera novo se for campo novo
                nome_tecnico: f.isNew 
                    ? f.label_visual.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, '_')
                    : f.nome_tecnico, 
                tipo: f.tipo,
                obrigatorio: f.obrigatorio,
                ordem: index
            };

            if (f.isNew) {
                await supabase.from('definicao_colunas').insert(payload);
            } else {
                await supabase.from('definicao_colunas').update(payload).eq('id', Number(f.id));
            }
        }
        toast.success("Módulo atualizado com sucesso!");
        loadData();
    } catch(e: any) { 
        toast.error("Erro ao salvar: " + e.message); 
    } finally { setSaving(false); }
  };

  const handleDeleteField = async (fieldId: string | number, isNew: boolean) => {
      if (isNew) {
          setFields(prev => prev.filter(f => f.id !== fieldId));
          return;
      }
      if (!confirm("Tem certeza? Dados dessa coluna serão perdidos.")) return;
      try {
          await supabase.from('definicao_colunas').delete().eq('id', Number(fieldId));
          setFields(prev => prev.filter(f => f.id !== fieldId));
          toast.success("Campo removido.");
      } catch (e) { toast.error("Erro ao remover campo."); }
  };

  if (loading) return <div className="h-screen flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-[#003B8F]" /></div>;

  return (
    <div className="max-w-5xl mx-auto pb-32 pt-8 px-4 animate-in fade-in">
       <div className="flex items-center justify-between mb-6">
           <Button variant="ghost" onClick={() => navigate('/modulos')} className="pl-0 text-slate-500 hover:text-[#003B8F]">
                <ArrowLeft className="mr-2 h-4 w-4" /> Voltar
           </Button>
           <Button onClick={handleSave} disabled={saving} className="bg-[#22C55E] hover:bg-green-600 text-white shadow-md">
                {saving ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : <Save className="mr-2 h-4 w-4" />}
                {saving ? 'Salvando...' : 'Salvar Alterações'}
           </Button>
       </div>

       <div className="grid gap-8 lg:grid-cols-[300px_1fr]">
           <div className="space-y-6">
               <div className="bg-white p-5 rounded-xl border shadow-sm space-y-4">
                   <h3 className="font-bold text-slate-800 text-lg border-b pb-2 flex items-center gap-2">
                       <Settings className="w-5 h-5 text-slate-400"/> Configuração
                   </h3>
                   <div className="space-y-3">
                       <div>
                           <Label className="text-xs text-slate-500">Nome da Tabela</Label>
                           <Input value={moduleData.nome || ''} onChange={e => setModuleData({...moduleData, nome: e.target.value})} className="font-semibold"/>
                       </div>
                       <div>
                           <Label className="text-xs text-slate-500">Descrição</Label>
                           <Input value={moduleData.descricao || ''} onChange={e => setModuleData({...moduleData, descricao: e.target.value})} />
                       </div>
                   </div>
               </div>

               {/* PAINEL DE TABELAS IRMÃS */}
               <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                   <div className="flex justify-between items-center mb-3">
                        <Label className="text-xs font-bold text-slate-500 uppercase">Tabelas do Sistema</Label>
                   </div>
                   <div className="space-y-2">
                       {siblingModules.map(sib => (
                           <Button key={sib.id} variant="outline" className="w-full justify-start text-slate-600 bg-white hover:bg-blue-50 hover:text-[#003B8F] border-slate-200"
                               onClick={() => { setLoading(true); navigate(`/modulos/${sib.id}/edit`); window.location.reload(); }}
                           >
                               <List className="w-4 h-4 mr-2 opacity-70" /> {sib.nome}
                           </Button>
                       ))}
                       
                       {/* BOTÃO PARA ADICIONAR NOVA TABELA AO MESMO SISTEMA */}
                       <Button 
                            variant="ghost" 
                            className="w-full justify-start text-[#003B8F] hover:bg-blue-100 mt-2"
                            onClick={() => navigate('/modulos/novo')} // Idealmente passaria o categoria_id
                        >
                            <PlusCircle className="w-4 h-4 mr-2"/> Nova Tabela
                       </Button>
                   </div>
               </div>
           </div>

           <div className="space-y-4">
               <div className="flex items-center justify-between bg-slate-100 p-3 rounded-lg border border-slate-200">
                   <h3 className="font-bold text-slate-700 flex items-center gap-2">
                       <CheckSquare className="w-5 h-5 text-[#003B8F]"/> Colunas da Tabela
                   </h3>
                   <Button size="sm" onClick={() => setFields([...fields, { 
                       id: generateTempId(), isNew: true, tipo: 'TEXTO', label_visual: 'Novo Campo', obrigatorio: false, options: [] 
                   }])}>
                       <Plus className="mr-2 h-4 w-4" /> Adicionar Campo
                   </Button>
               </div>

               <div className="space-y-3 pb-20">
                   {fields.length === 0 ? (
                       <div className="text-center py-12 border-2 border-dashed rounded-xl bg-slate-50">
                           <p className="text-slate-400">Nenhuma coluna definida.</p>
                       </div>
                   ) : (
                       fields.map((f, i) => (
                           <FieldRow key={f.id || i} field={f}
                               onUpdate={(id:any, data:any) => setFields(fields.map(field => field.id === id ? { ...field, ...data } : field))}
                               onRemove={(id:any) => handleDeleteField(id, f.isNew)}
                           />
                       ))
                   )}
               </div>
           </div>
       </div>
    </div>
  );
}