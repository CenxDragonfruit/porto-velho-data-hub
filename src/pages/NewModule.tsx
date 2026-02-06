import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence, Reorder } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
// 1. Importar o cliente do React Query
import { useQueryClient } from '@tanstack/react-query';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Plus, Trash2, CheckSquare, ArrowLeft, Type, Calendar, Hash, Mail, 
  Phone, DollarSign, List, FileText, X, GripVertical,
  Table as TableIcon, Upload, ArrowRight, FileSpreadsheet, Loader2, CheckCircle2,
  Clock, Layers, Info
} from 'lucide-react';
import { toast } from 'sonner';
import Papa from 'papaparse';

// --- CONFIGURAÇÃO E TIPOS (Mapeamento UI -> DB ENUM) ---

const QUESTION_TYPES = [
  { id: 'TEXTO', label: 'Texto Curto', icon: Type, color: 'bg-blue-100 text-blue-600', desc: 'Nome, Cidade' },
  { id: 'TEXTO_LONGO', label: 'Texto Longo', icon: FileText, color: 'bg-indigo-100 text-indigo-600', desc: 'Observações' },
  { id: 'INTEIRO', label: 'Número Inteiro', icon: Hash, color: 'bg-emerald-100 text-emerald-600', desc: 'Idade, Qtd' },
  { id: 'DECIMAL', label: 'Valor / Decimal', icon: DollarSign, color: 'bg-yellow-100 text-yellow-700', desc: 'Preços' },
  { id: 'DATA', label: 'Data', icon: Calendar, color: 'bg-orange-100 text-orange-600', desc: 'Prazos' },
  { id: 'HORA', label: 'Hora', icon: Clock, color: 'bg-orange-50 text-orange-500', desc: 'Horários' },
  { id: 'CPF', label: 'CPF', icon: CheckSquare, color: 'bg-slate-100 text-slate-600', desc: 'Validação' },
  { id: 'SELECAO_LISTA', label: 'Lista de Opções', icon: List, color: 'bg-rose-100 text-rose-600', desc: 'Seleção única' },
];

const generateUUID = () => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

export default function NewModule() {
  const [step, setStep] = useState(1);
  const [systemName, setSystemName] = useState(''); 
  const [description, setDescription] = useState('');
  
  // 2. Instanciar o cliente para invalidar caches depois
  const queryClient = useQueryClient();

  const [tables, setTables] = useState([
    { 
      id: generateUUID(),
      name: 'Dados Principais', 
      fields: [] as any[], 
      importedData: [] as any[] 
    }
  ]);
  const [activeTableId, setActiveTableId] = useState(tables[0].id);

  // --- STATES AUXILIARES ---
  const [csvModalOpen, setCsvModalOpen] = useState(false);
  const [csvPreview, setCsvPreview] = useState<{ headers: string[], rows: any[], fileName: string } | null>(null);
  const [columnConfig, setColumnConfig] = useState<Record<string, string>>({}); 
  const [scanProgress, setScanProgress] = useState(0);
  const [isScanning, setIsScanning] = useState(false);

  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const { userData } = useAuth();
  const navigate = useNavigate();

  const activeTable = tables.find(t => t.id === activeTableId) || tables[0];

  const generateTechName = (label: string) => {
    const clean = label.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, '_');
    return clean || `col_${Math.floor(Math.random() * 10000)}`;
  };

  // --- CRUD TABELAS E CAMPOS ---
  const addTable = () => {
    const newId = generateUUID();
    setTables([...tables, { id: newId, name: `Nova Tabela ${tables.length + 1}`, fields: [], importedData: [] }]);
    setActiveTableId(newId);
  };

  const removeTable = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (tables.length === 1) return toast.error("O sistema deve ter pelo menos uma tabela.");
    const newTables = tables.filter(t => t.id !== id);
    setTables(newTables);
    if (activeTableId === id) setActiveTableId(newTables[0].id);
  };

  const renameTable = (newName: string) => {
    setTables(tables.map(t => t.id === activeTableId ? { ...t, name: newName } : t));
  };

  const addField = (typeId: string, label = '', options: any[] = []) => {
    const newField = { 
      id: generateUUID(), 
      type: typeId, 
      label: label, 
      techName: generateTechName(label),
      required: false, 
      options: options 
    };
    
    setTables(prev => prev.map(t => t.id === activeTableId ? { ...t, fields: [...t.fields, newField] } : t));
  };

  const updateField = (fieldId: string, key: string, value: any) => { 
    setTables(prev => prev.map(t => t.id === activeTableId ? {
        ...t,
        fields: t.fields.map(f => {
            if (f.id === fieldId) {
                const updated = { ...f, [key]: value };
                if (key === 'label') updated.techName = generateTechName(value);
                return updated;
            }
            return f;
        })
    } : t));
  };

  const removeField = (fieldId: string) => { 
    setTables(prev => prev.map(t => t.id === activeTableId ? {
        ...t,
        fields: t.fields.filter(f => f.id !== fieldId)
    } : t));
  };
  
  const handleReorder = (newOrder: any[]) => { 
    setTables(prev => prev.map(t => t.id === activeTableId ? { ...t, fields: newOrder } : t));
  };

  const handleAddOption = (fieldId: string) => {
    const input = document.getElementById(`opt-${fieldId}`) as HTMLInputElement;
    if (input && input.value.trim()) {
      const val = input.value.trim();
      const currentField = activeTable.fields.find(f => f.id === fieldId);
      updateField(fieldId, 'options', [...(currentField?.options || []), { label: val, value: val }]);
      input.value = '';
    }
  };

  // --- IMPORTAÇÃO CSV ---
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsScanning(true);
    setScanProgress(0);

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        const headers = results.meta.fields || [];
        const rows = results.data as any[];
        
        const finalConfig: Record<string, string> = {};
        headers.forEach(h => {
            const lowerH = h.toLowerCase();
            if (lowerH.includes('data') || lowerH.includes('nasc')) finalConfig[h] = 'DATA';
            else if (lowerH.includes('cpf')) finalConfig[h] = 'CPF';
            else if (lowerH.includes('valor') || lowerH.includes('preço')) finalConfig[h] = 'DECIMAL';
            else if (lowerH.includes('idade') || lowerH.includes('qtd')) finalConfig[h] = 'INTEIRO';
            else finalConfig[h] = 'TEXTO';
        });

        setScanProgress(100);
        setIsScanning(false);
        setCsvPreview({ headers, rows, fileName: file.name });
        setColumnConfig(finalConfig);
        setCsvModalOpen(true);
        if (fileInputRef.current) fileInputRef.current.value = '';
      },
      error: (err) => {
        setIsScanning(false);
        toast.error("Erro ao ler CSV: " + err.message);
      }
    });
  };

  const confirmImport = () => {
    if (!csvPreview) return;

    const newFields: any[] = [];
    csvPreview.headers.forEach(header => {
      const type = columnConfig[header] || 'TEXTO';
      let options: any[] = [];
      if (type === 'SELECAO_LISTA') {
        const unique = new Set(csvPreview.rows.map(r => r[header]).filter(Boolean));
        options = Array.from(unique).map(v => ({ label: String(v), value: String(v) }));
      }

      newFields.push({
        id: generateUUID(),
        type,
        label: header,
        techName: generateTechName(header),
        required: false,
        options
      });
    });

    setTables(prev => prev.map(t => t.id === activeTableId ? {
        ...t,
        fields: [...t.fields, ...newFields],
        importedData: csvPreview.rows
    } : t));

    setCsvModalOpen(false);
    toast.success(`${newFields.length} colunas importadas!`);
  };

  const getCsvExamples = (header: string) => {
    if (!csvPreview?.rows) return "";
    return csvPreview.rows
      .slice(0, 3) // Pega os 3 primeiros
      .map(r => r[header])
      .filter(v => v !== null && v !== undefined && String(v).trim() !== "")
      .join(", ");
  };

  // --- SALVAR NO BANCO ---
  const handleSave = async () => {
    if (!systemName.trim()) return toast.error("Dê um nome ao sistema");
    if (tables.some(t => t.fields.length === 0)) return toast.error("Todas as tabelas precisam ter pelo menos um campo.");
    
    setLoading(true);
    
    try {
      // 1. Criar Categoria
      const { data: categoria, error: catError } = await supabase
        .from('categorias_modulo')
        .insert({ nome: systemName, icone_referencia: 'folder' })
        .select()
        .single();

      if (catError) throw new Error("Erro ao criar sistema: " + catError.message);

      // 2. Criar Módulos (Tabelas)
      for (const table of tables) {
          const { data: modulo, error: modError } = await supabase
            .from('modulos')
            .insert({ 
                nome: table.name, 
                descricao: `Tabela do sistema ${systemName}`, 
                categoria_id: categoria.id,
                responsavel_criacao_id: userData?.id,
                ativo: true 
            })
            .select().single();

          if (modError) throw new Error(`Erro ao criar tabela ${table.name}: ` + modError.message);

          // Permissões
          if (userData?.id) {
              await supabase.from('permissoes_modulo').insert({
                  usuario_id: userData.id,
                  modulo_id: modulo.id,
                  pode_visualizar: true, pode_inserir: true, pode_editar: true, pode_aprovar: true, pode_exportar: true
              });
          }

          // Campos
          for (const [index, field] of table.fields.entries()) {
              let catalogoId = null;

              if (field.type === 'SELECAO_LISTA' && field.options.length > 0) {
                  const { data: cat } = await supabase
                    .from('catalogos_dominio')
                    .insert({ nome: `Lista: ${field.label} - ${modulo.nome}`, criado_por: userData?.id })
                    .select().single();
                  
                  if (cat) {
                      catalogoId = cat.id;
                      const itens = field.options.map((opt: any) => ({
                          catalogo_id: cat.id,
                          chave: generateTechName(opt.value),
                          valor_exibicao: opt.label
                      }));
                      await supabase.from('itens_catalogo').insert(itens);
                  }
              }

              await supabase.from('definicao_colunas').insert({
                  modulo_id: modulo.id,
                  nome_tecnico: field.techName,
                  label_visual: field.label,
                  tipo: field.type,
                  catalogo_referencia_id: catalogoId,
                  obrigatorio: field.required,
                  ordem: index
              });
          }

          // Dados CSV
          if (table.importedData.length > 0) {
              const mapHeaderToTech: Record<string, string> = {};
              table.fields.forEach((f: any) => mapHeaderToTech[f.label] = f.techName);

              const batchPromises = table.importedData.map(async (row: any) => {
                  const jsonContent: any = {};
                  Object.keys(row).forEach(header => {
                      const tech = mapHeaderToTech[header];
                      if (tech && row[header]) jsonContent[tech] = row[header];
                  });

                  if (Object.keys(jsonContent).length > 0) {
                      const { data: mestre } = await supabase.from('registros_mestre')
                        .insert({ modulo_id: modulo.id }).select().single();
                      
                      if (mestre) {
                          await supabase.from('versoes_registro').insert({
                              registro_mestre_id: mestre.id,
                              conteudo: jsonContent,
                              versao: 1,
                              status: 'OFICIAL',
                              is_atual: true,
                              criado_por_id: userData?.id
                          });
                      }
                  }
              });
              while (batchPromises.length > 0) await Promise.all(batchPromises.splice(0, 20));
          }
      }
      
      // 3. ATUALIZAÇÃO DO CACHE: AVISA A LISTAGEM QUE TEM COISA NOVA
      await queryClient.invalidateQueries({ queryKey: ['modulos'] });

      toast.success("Sistema publicado!");
      navigate('/modulos');

    } catch (e: any) { 
        console.error("ERRO FATAL:", e);
        toast.error(e.message || "Erro crítico.");
    } finally { 
        setLoading(false); 
    }
  };

  return (
    <div className="max-w-6xl mx-auto pb-32 animate-in fade-in duration-500 relative">
       
       {/* DIALOG CSV */}
       <Dialog open={csvModalOpen} onOpenChange={setCsvModalOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-0 gap-0 overflow-hidden">
          <DialogHeader className="p-6 border-b bg-slate-50">
            <DialogTitle className="flex items-center gap-2 text-xl">Importar CSV para {activeTable.name}</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto p-6 bg-slate-50/30">
             <div className="rounded-xl border border-slate-200 overflow-hidden bg-white shadow-sm">
                <table className="w-full text-sm text-left">
                  <thead className="bg-slate-100 text-slate-600 font-semibold uppercase text-xs">
                    <tr>
                      <th className="px-4 py-3">Coluna CSV / Exemplos</th>
                      <th className="px-4 py-3">Tipo de Campo</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {csvPreview?.headers.map((header, i) => (
                      <tr key={i}>
                        <td className="px-4 py-3">
                            <span className="font-bold text-slate-700 block">{header}</span>
                            <span className="text-xs text-slate-400 block mt-1 truncate max-w-[300px]">
                                Ex: {getCsvExamples(header)}
                            </span>
                        </td>
                        <td className="px-4 py-3">
                          <Select value={columnConfig[header]} onValueChange={(val) => setColumnConfig(prev => ({...prev, [header]: val}))}>
                            <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                            <SelectContent>
                               {QUESTION_TYPES.map(t => (
                                   <SelectItem key={t.id} value={t.id}>
                                       <div className="flex items-center gap-2">
                                           <div className={`p-1 rounded ${t.color}`}><t.icon className="w-3 h-3"/></div>
                                           {t.label}
                                       </div>
                                   </SelectItem>
                               ))}
                            </SelectContent>
                          </Select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
             </div>
          </div>
          <DialogFooter className="p-4 border-t bg-white">
             <Button variant="ghost" onClick={() => setCsvModalOpen(false)}>Cancelar</Button>
             <Button onClick={confirmImport} className="bg-[#003B8F] hover:bg-blue-800 text-white">Confirmar Importação</Button>
          </DialogFooter>
        </DialogContent>
       </Dialog>

       {/* HEADER */}
       <div className="sticky top-0 z-30 bg-slate-50/95 backdrop-blur border-b py-4 mb-8">
        <div className="flex items-center justify-between">
          <Button variant="ghost" onClick={() => navigate('/modulos')} className="text-slate-500 hover:text-[#003B8F]">
            <ArrowLeft className="mr-2 h-4 w-4" /> Cancelar
          </Button>
          <div className="flex gap-2">
            <div className={`h-2 w-12 rounded-full transition-colors ${step === 1 ? 'bg-[#003B8F]' : 'bg-green-500'}`} />
            <div className={`h-2 w-12 rounded-full transition-colors ${step === 2 ? 'bg-[#003B8F]' : 'bg-slate-200'}`} />
          </div>
          {step === 2 && (
            <Button onClick={handleSave} disabled={loading} className="bg-[#22C55E] hover:bg-green-600 text-white shadow-md shadow-green-200">
              {loading ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
              {loading ? 'Publicando...' : 'Publicar Sistema'}
            </Button>
          )}
        </div>
      </div>

       {/* PASSO 1 */}
       {step === 1 && (
         <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-xl mx-auto mt-20">
           <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200 space-y-6">
             <div className="space-y-2">
               <Label className="text-base font-semibold text-slate-700">Nome do Sistema</Label>
               <Input value={systemName} onChange={e => setSystemName(e.target.value)} placeholder="Ex: Gestão Escolar..." className="text-lg h-12" autoFocus />
             </div>
             <div className="space-y-2">
               <Label className="text-base font-semibold text-slate-700">Descrição</Label>
               <Textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Objetivo do sistema..." className="resize-none" />
             </div>
             <Button onClick={() => { if(!systemName.trim()) return toast.error("Nome é obrigatório"); setStep(2); }} className="w-full h-12 text-lg bg-[#003B8F] hover:bg-blue-800">
               Continuar <ArrowRight className="ml-2 h-5 w-5" />
             </Button>
           </div>
         </motion.div>
       )}

       {/* PASSO 2 */}
       {step === 2 && (
             <div className="grid lg:grid-cols-[280px_1fr_300px] gap-6 items-start h-[calc(100vh-140px)]">
               
               {/* SIDEBAR TABELAS */}
               <div className="bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col h-full overflow-hidden">
                  <div className="p-4 border-b bg-slate-50 flex justify-between items-center">
                      <span className="font-bold text-slate-700 text-sm flex items-center gap-2"><Layers className="w-4 h-4"/> Tabelas</span>
                      <Button size="icon" variant="ghost" className="h-6 w-6" onClick={addTable}><Plus className="w-4 h-4 text-[#003B8F]"/></Button>
                  </div>
                  <div className="flex-1 overflow-y-auto p-2 space-y-1">
                      {tables.map(table => (
                          <div key={table.id} onClick={() => setActiveTableId(table.id)} 
                               className={`group flex items-center justify-between px-3 py-2.5 rounded-lg text-sm cursor-pointer transition-all ${activeTableId === table.id ? 'bg-blue-50 text-[#003B8F] font-semibold border border-blue-100' : 'text-slate-600 hover:bg-slate-50'}`}>
                              <span className="truncate">{table.name}</span>
                              {tables.length > 1 && (
                                <Trash2 className="w-3.5 h-3.5 text-slate-300 opacity-0 group-hover:opacity-100 hover:text-red-500" onClick={(e) => removeTable(table.id, e)} />
                              )}
                          </div>
                      ))}
                  </div>
               </div>
               
               {/* ÁREA PRINCIPAL */}
               <div className="bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col h-full overflow-hidden">
                  <div className="p-4 border-b flex justify-between items-center bg-slate-50">
                      <Input value={activeTable.name} onChange={(e) => renameTable(e.target.value)} className="w-1/2 border-transparent bg-transparent font-bold text-lg focus:bg-white focus:border-slate-200 px-2 h-9" />
                      <div className="flex gap-2">
                          <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" accept=".csv" />
                          {isScanning ? (
                              <Button size="sm" variant="outline" disabled className="h-8 text-xs"><Loader2 className="animate-spin mr-2 h-3 w-3"/> Lendo CSV...</Button>
                          ) : (
                              <Button size="sm" variant="outline" onClick={() => fileInputRef.current?.click()} className="h-8 text-xs border-green-200 text-green-700 hover:bg-green-50">
                                  <FileSpreadsheet className="h-3 w-3 mr-1" /> Importar CSV
                              </Button>
                          )}
                      </div>
                  </div>

                  <div className="flex-1 overflow-y-auto p-6 bg-slate-50/50">
                      {activeTable.fields.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-center opacity-60">
                            <List className="w-12 h-12 text-slate-300 mb-3" />
                            <p className="text-slate-500 font-medium">Esta tabela está vazia</p>
                            <p className="text-xs text-slate-400">Arraste ou clique nos campos à direita.</p>
                        </div>
                      ) : (
                        <Reorder.Group axis="y" values={activeTable.fields} onReorder={handleReorder} className="space-y-3">
                            <AnimatePresence>
                               {activeTable.fields.map((field: any) => {
                                  const typeInfo = QUESTION_TYPES.find(t => t.id === field.type) || QUESTION_TYPES[0];
                                  return (
                                  <Reorder.Item key={field.id} value={field} className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm group hover:border-blue-300 transition-all relative">
                                      <div className="absolute left-0 top-0 bottom-0 w-1 rounded-l-lg bg-slate-200 group-hover:bg-[#003B8F] transition-colors" />
                                      <div className="flex items-start gap-3 pl-3">
                                          <div className="mt-2 text-slate-300 cursor-grab active:cursor-grabbing hover:text-[#003B8F]"><GripVertical className="h-4 w-4" /></div>
                                          <div className="flex-1 space-y-2">
                                            <div className="flex items-center justify-between">
                                               <Input value={field.label} onChange={e => updateField(field.id, 'label', e.target.value)} className="h-8 font-semibold border-transparent hover:border-slate-100 focus:bg-slate-50" />
                                               <Button variant="ghost" size="icon" onClick={() => removeField(field.id)} className="h-7 w-7 text-slate-400 hover:text-red-500"><Trash2 className="h-3.5 w-3.5" /></Button>
                                            </div>
                                            
                                            <div className="flex items-center gap-4 text-xs text-slate-500 pl-3">
                                                <Select value={field.type} onValueChange={(val) => updateField(field.id, 'type', val)}>
                                                    <SelectTrigger className={`h-6 w-auto border-0 px-2 rounded font-bold uppercase tracking-wider text-[10px] ${typeInfo.color}`}>
                                                        <div className="flex items-center gap-1">
                                                            <typeInfo.icon className="w-3 h-3" />
                                                            {typeInfo.label}
                                                        </div>
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {QUESTION_TYPES.map(t => (
                                                            <SelectItem key={t.id} value={t.id}>
                                                                <div className="flex items-center gap-2">
                                                                    <div className={`p-1 rounded ${t.color}`}><t.icon className="w-3 h-3"/></div>
                                                                    {t.label}
                                                                </div>
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>

                                                <div className="flex items-center gap-1.5 cursor-pointer" onClick={() => updateField(field.id, 'required', !field.required)}>
                                                    <Switch checked={field.required} onCheckedChange={c => updateField(field.id, 'required', c)} className="scale-75" />
                                                    <span>Obrigatório</span>
                                                </div>
                                            </div>

                                            {field.type === 'SELECAO_LISTA' && (
                                              <div className="bg-slate-50 p-3 rounded-md space-y-2 mt-2 border border-slate-100">
                                                    <div className="flex flex-wrap gap-1.5">
                                                         {field.options?.map((opt: any, i: number) => (
                                                              <span key={i} className="bg-white border px-2 py-0.5 rounded text-xs flex items-center gap-1 shadow-sm text-slate-600">{opt.label}</span>
                                                         ))}
                                                    </div>
                                                    <div className="flex gap-2">
                                                           <Input id={`opt-${field.id}`} placeholder="Nova opção..." className="bg-white h-7 text-xs" onKeyDown={e => { if(e.key === 'Enter') { e.preventDefault(); handleAddOption(field.id); }}} />
                                                           <Button size="sm" variant="secondary" className="h-7 text-xs" onClick={() => handleAddOption(field.id)}>Add</Button>
                                                    </div>
                                              </div>
                                            )}
                                          </div>
                                      </div>
                                  </Reorder.Item>
                                  );
                               })}
                            </AnimatePresence>
                        </Reorder.Group>
                      )}
                  </div>
               </div>

               {/* FERRAMENTAS */}
               <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm h-full overflow-y-auto">
                 <h3 className="font-bold text-slate-700 mb-4 px-1 text-sm uppercase tracking-wide">Adicionar Campo</h3>
                 <div className="grid grid-cols-1 gap-2">
                   {QUESTION_TYPES.map(type => (
                     <button key={type.id} onClick={() => addField(type.id)} className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-slate-50 border border-transparent hover:border-slate-200 transition-all text-left group">
                       <div className={`p-1.5 rounded-md ${type.color} group-hover:scale-110 transition-transform`}><type.icon className="h-4 w-4" /></div>
                       <div><p className="text-xs font-bold text-slate-700">{type.label}</p><p className="text-[10px] text-slate-400 leading-tight">{type.desc}</p></div>
                       <Plus className="h-3 w-3 ml-auto text-slate-300 opacity-0 group-hover:opacity-100" />
                     </button>
                   ))}
                 </div>
               </div>

             </div>
       )}
    </div>
  );
}