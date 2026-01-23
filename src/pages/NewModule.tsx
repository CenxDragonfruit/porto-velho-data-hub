import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence, Reorder } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
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
  Table as TableIcon, Upload, ArrowRight, FileSpreadsheet, Loader2
} from 'lucide-react';
import { toast } from 'sonner';
import Papa from 'papaparse';

// --- CONFIGURAÇÃO E TIPOS ---

const QUESTION_TYPES = [
  { id: 'text', label: 'Texto Curto', icon: Type, color: 'bg-blue-100 text-blue-600', desc: 'Nome, Cidade, Cargo' },
  { id: 'textarea', label: 'Texto Longo', icon: FileText, color: 'bg-indigo-100 text-indigo-600', desc: 'Observações' },
  { id: 'number', label: 'Número', icon: Hash, color: 'bg-emerald-100 text-emerald-600', desc: 'Idade, Quantidade' },
  { id: 'date', label: 'Data', icon: Calendar, color: 'bg-orange-100 text-orange-600', desc: 'Datas' },
  { id: 'email', label: 'E-mail', icon: Mail, color: 'bg-purple-100 text-purple-600', desc: 'Contato' },
  { id: 'phone', label: 'Telefone', icon: Phone, color: 'bg-green-100 text-green-600', desc: 'Celular' },
  { id: 'cpf', label: 'CPF', icon: CheckSquare, color: 'bg-slate-100 text-slate-600', desc: 'Documento' },
  { id: 'currency', label: 'Valor (R$)', icon: DollarSign, color: 'bg-yellow-100 text-yellow-700', desc: 'Preços' },
  { id: 'select', label: 'Lista de Opções', icon: List, color: 'bg-rose-100 text-rose-600', desc: 'Seleção única' },
];

export default function NewModule() {
  const [step, setStep] = useState(1);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  
  // Estrutura das tabelas
  const [tables, setTables] = useState([
    { id: crypto.randomUUID(), name: 'Tabela Principal', fields: [] as any[], rows: [] as any[] }
  ]);
  const [activeTableId, setActiveTableId] = useState(tables[0].id);

  // --- STATES DO CSV ---
  const [csvModalOpen, setCsvModalOpen] = useState(false);
  const [csvPreview, setCsvPreview] = useState<{ headers: string[], rows: any[], fileName: string } | null>(null);
  const [columnConfig, setColumnConfig] = useState<Record<string, string>>({}); // Header -> TypeID

  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const { profile } = useAuth();
  const navigate = useNavigate();

  const activeTable = tables.find(t => t.id === activeTableId) || tables[0];

  const generateDbName = (label: string) => {
    const clean = label.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, '_');
    return clean || `campo_${Math.floor(Math.random() * 10000)}`;
  };

  // --- LÓGICA DE MANIPULAÇÃO DE TABELAS ---
  const addTable = (tableName = `Nova Tabela ${tables.length + 1}`) => {
    const newId = crypto.randomUUID();
    setTables([...tables, { id: newId, name: tableName, fields: [], rows: [] }]);
    setActiveTableId(newId);
  };

  const removeTable = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (tables.length === 1) return toast.error("Mínimo uma tabela.");
    const newTables = tables.filter(t => t.id !== id);
    setTables(newTables);
    if (activeTableId === id) setActiveTableId(newTables[0].id);
  };

  const renameActiveTable = (newName: string) => { 
    setTables(tables.map(t => t.id === activeTableId ? { ...t, name: newName } : t)); 
  };
  
  const addField = (typeId: string, label = '', options: any[] = []) => {
    const newField = { 
      id: crypto.randomUUID(), 
      type: typeId, 
      label: label, 
      required: false, 
      options: options 
    };
    setTables(prev => prev.map(t => t.id === activeTableId ? { ...t, fields: [...t.fields, newField] } : t));
    return newField;
  };

  const updateField = (id: string, key: string, value: any) => { 
    setTables(tables.map(t => t.id === activeTableId ? { ...t, fields: t.fields.map(f => f.id === id ? { ...f, [key]: value } : f) } : t)); 
  };

  const removeField = (id: string) => { 
    setTables(tables.map(t => t.id === activeTableId ? { ...t, fields: t.fields.filter(f => f.id !== id) } : t)); 
  };
  
  const handleReorder = (newOrder: any[]) => { 
    setTables(tables.map(t => t.id === activeTableId ? { ...t, fields: newOrder } : t)); 
  };

  const handleAddOption = (fieldId: string) => {
    const input = document.getElementById(`opt-${fieldId}`) as HTMLInputElement;
    if (input && input.value.trim()) {
      const val = input.value.trim();
      const slug = generateDbName(val);
      const currentField = activeTable.fields.find(f => f.id === fieldId);
      updateField(fieldId, 'options', [...(currentField?.options || []), { label: val, value: slug }]);
      input.value = '';
    }
  };

  // --- LÓGICA DE IMPORTAÇÃO CSV ---
  
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      preview: 50, // Preview inicial
      complete: (results) => {
        const headers = results.meta.fields || [];
        const rows = results.data as any[];
        
        // Auto-detectar tipos
        const initialConfig: Record<string, string> = {};
        headers.forEach(header => {
          const sampleValues = rows.slice(0, 10).map(r => r[header]);
          initialConfig[header] = detectType(header, sampleValues);
        });

        setCsvPreview({ headers, rows, fileName: file.name });
        setColumnConfig(initialConfig);
        setCsvModalOpen(true);
        if (fileInputRef.current) fileInputRef.current.value = '';
      },
      error: (err) => {
        toast.error("Erro ao ler CSV: " + err.message);
      }
    });
  };

  const detectType = (header: string, values: any[]) => {
    const headerLower = header.toLowerCase();
    if (headerLower.includes('data') || headerLower.includes('nasc')) return 'date';
    if (headerLower.includes('valor') || headerLower.includes('preco')) return 'currency';
    if (headerLower.includes('email')) return 'email';
    if (headerLower.includes('cpf')) return 'cpf';
    
    // Verificar se é lista (poucos valores únicos)
    const unique = new Set(values.filter(v => v)).size;
    if (unique > 0 && unique < 5 && values.length > 5) return 'select';
    
    // Verificar se é numérico
    const isNumeric = values.every(v => !isNaN(parseFloat(v)) && isFinite(v));
    if (isNumeric && values.length > 0) return 'number';

    return 'text'; 
  };

  const confirmImport = () => {
    if (!csvPreview) return;

    const newFields: any[] = [];
    
    csvPreview.headers.forEach(header => {
      const type = columnConfig[header] || 'text';
      let options: any[] = [];

      if (type === 'select') {
        const uniqueValues = Array.from(new Set(csvPreview.rows.map(r => r[header]).filter(Boolean)));
        options = uniqueValues.map((v: any) => ({ 
          label: v, 
          value: generateDbName(v) 
        }));
      }

      const field = {
        id: crypto.randomUUID(),
        type,
        label: header,
        required: false,
        options
      };
      
      newFields.push(field);
    });

    const mappedRows = csvPreview.rows.map(row => {
      const newRow: any = {};
      Object.keys(row).forEach(header => {
        newRow[header] = row[header]; 
      });
      return newRow;
    });

    setTables(prev => prev.map(t => t.id === activeTableId ? {
      ...t,
      fields: [...t.fields, ...newFields],
      rows: [...t.rows, ...mappedRows]
    } : t));

    setCsvModalOpen(false);
    toast.success(`${newFields.length} colunas e ${mappedRows.length} linhas importadas!`);
  };


  // --- SAVE LOGIC ---
  const handleSave = async () => {
    if (!name.trim()) return toast.error("Dê um nome ao sistema");
    setLoading(true);
    
    try {
      const systemSlug = generateDbName(name) + '-' + Math.floor(Math.random()*9000);
      
      // 1. Criar Módulo
      const { data: module, error: modError } = await supabase.from('crud_modules')
        .insert({ name, description, slug: systemSlug, created_by: profile?.id, is_active: true })
        .select().single();

      if (modError) throw new Error(modError.message);

      if (profile && profile.role !== 'administrador') {
         await supabase.from('profile_modules').insert({ profile_id: profile.id, crud_module_id: module.id });
      }

      // 2. Criar Tabelas e Campos
      for (const table of tables) {
          const dbTableName = generateDbName(table.name) + `_${Math.floor(Math.random()*1000)}`;

          const { data: dbTable, error: tableError } = await supabase.from('crud_tables')
            .insert({ crud_module_id: module.id, name: table.name, db_table_name: dbTableName })
            .select().single();
          
          if (tableError) throw new Error(tableError.message);

          const headerToDbColumn: Record<string, string> = {};

          if (table.fields.length > 0) {
            const fieldsToInsert = table.fields.map((f, i) => {
                const dbColName = generateDbName(f.label) + `_${i}`; 
                headerToDbColumn[f.label] = dbColName;

                return {
                    crud_table_id: dbTable.id, 
                    name: dbColName, 
                    label: f.label, 
                    field_type: f.type, 
                    is_required: f.required, 
                    options: f.type === 'select' ? f.options : null,
                    order_index: i
                };
            });

            const { error: fError } = await supabase.from('crud_fields').insert(fieldsToInsert);
            if (fError) throw new Error("Erro campos: " + fError.message);

            // 3. INSERIR DADOS IMPORTADOS
            if (table.rows.length > 0) {
               const rowsPayload = table.rows.map(row => {
                  const dbRow: any = {};
                  Object.keys(row).forEach(csvHeader => {
                     const dbCol = headerToDbColumn[csvHeader];
                     if (dbCol) {
                        let val = row[csvHeader];
                        if (val === "") val = null;
                        dbRow[dbCol] = val;
                     }
                  });
                  return dbRow;
               });

               if (rowsPayload.length > 0) {
                 const { error: dataError } = await supabase.from(dbTableName).insert(rowsPayload);
                 if (dataError) {
                    console.error("Erro insert dados:", dataError);
                    toast.warning("Estrutura criada, mas houve erro na importação dos dados.");
                 }
               }
            }
          }
      }
      
      toast.success("Sistema publicado com sucesso!");
      navigate('/modulos');

    } catch (e: any) { 
        console.error("ERRO FATAL:", e);
        toast.error(e.message || "Erro crítico ao salvar.");
    } finally { 
        setLoading(false); 
    }
  };

  return (
    <div className="max-w-5xl mx-auto pb-32 animate-in fade-in duration-500 relative">
       
       {/* MODAL DE IMPORTAÇÃO CSV */}
       <Dialog open={csvModalOpen} onOpenChange={setCsvModalOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-0 gap-0 overflow-hidden">
          <DialogHeader className="p-6 border-b bg-slate-50">
            <DialogTitle className="flex items-center gap-2 text-xl">
              <div className="bg-green-100 p-2 rounded-lg text-green-700">
                <FileSpreadsheet className="w-6 h-6" />
              </div>
              Configurar Importação
            </DialogTitle>
            <p className="text-slate-500 text-sm mt-1">
              Arquivo: <span className="font-mono font-medium text-slate-700">{csvPreview?.fileName}</span> 
              ({csvPreview?.rows.length} linhas)
            </p>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto p-6 bg-slate-50/30">
             <div className="rounded-xl border border-slate-200 overflow-hidden bg-white shadow-sm">
                <table className="w-full text-sm text-left">
                  <thead className="bg-slate-100 text-slate-600 font-semibold uppercase text-xs">
                    <tr>
                      <th className="px-4 py-3 w-1/3">Coluna no CSV</th>
                      <th className="px-4 py-3 w-1/3 text-center"><ArrowRight className="mx-auto w-4 h-4 text-slate-400"/></th>
                      <th className="px-4 py-3 w-1/3">Configuração (Tipo)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {csvPreview?.headers.map((header, i) => (
                      <tr key={i} className="hover:bg-slate-50 transition-colors group">
                        <td className="px-4 py-3">
                           <div className="font-medium text-slate-700">{header}</div>
                           <div className="text-xs text-slate-400 mt-0.5 truncate max-w-[200px]">
                              Ex: {csvPreview.rows[0][header]}, {csvPreview.rows[1]?.[header]}...
                           </div>
                        </td>
                        <td className="px-4 py-3 text-center">
                           <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700 border border-green-200">
                             Será criado novo campo
                           </span>
                        </td>
                        <td className="px-4 py-3">
                          <Select 
                            value={columnConfig[header]} 
                            onValueChange={(val) => setColumnConfig(prev => ({...prev, [header]: val}))}
                          >
                            <SelectTrigger className="h-9 border-slate-200 bg-slate-50 focus:bg-white transition-all">
                               <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                               {QUESTION_TYPES.map(t => (
                                 <SelectItem key={t.id} value={t.id}>
                                    <div className="flex items-center gap-2">
                                       <t.icon className="w-4 h-4 text-slate-400"/>
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

          <DialogFooter className="p-4 border-t bg-white flex justify-between items-center">
             <Button variant="ghost" onClick={() => setCsvModalOpen(false)}>Cancelar</Button>
             <Button onClick={confirmImport} className="bg-[#003B8F] hover:bg-blue-800 text-white gap-2">
                <Upload className="w-4 h-4" /> Importar Estrutura e Dados
             </Button>
          </DialogFooter>
        </DialogContent>
       </Dialog>

       {/* HEADER & NAV */}
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
              {loading ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : <CheckSquare className="mr-2 h-4 w-4" />}
              {loading ? 'Salvando...' : 'Publicar Sistema'}
            </Button>
          )}
        </div>
      </div>

       {step === 1 && (
         <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-xl mx-auto">
           <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200 space-y-6">
             <div className="space-y-2">
               <Label className="text-base font-semibold text-slate-700">Qual o nome do sistema?</Label>
               <Input value={name} onChange={e => setName(e.target.value)} placeholder="Ex: Gestão de Projetos..." className="text-lg h-12" autoFocus />
             </div>
             <div className="space-y-2">
               <Label className="text-base font-semibold text-slate-700">Descrição curta</Label>
               <Textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Objetivo do sistema..." className="resize-none" />
             </div>
             <Button onClick={() => { if(!name.trim()) return toast.error("Nome é obrigatório"); setStep(2); }} className="w-full h-12 text-lg bg-[#003B8F] hover:bg-blue-800">
               Continuar <ArrowLeft className="ml-2 h-5 w-5 rotate-180" />
             </Button>
           </div>
         </motion.div>
       )}

       {step === 2 && (
             <div className="grid lg:grid-cols-[300px_1fr] gap-8 items-start">
               
               {/* Sidebar de Componentes */}
               <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm sticky top-24">
                 <h3 className="font-bold text-slate-700 mb-4 px-2">Tipos de Coluna</h3>
                 <div className="grid grid-cols-1 gap-2">
                   {QUESTION_TYPES.map(type => (
                     <button key={type.id} onClick={() => addField(type.id)} className="flex items-center gap-3 p-3 rounded-lg hover:bg-slate-50 border border-transparent hover:border-slate-200 transition-all text-left group">
                       <div className={`p-2 rounded-md ${type.color} group-hover:scale-110 transition-transform`}><type.icon className="h-4 w-4" /></div>
                       <div><p className="text-sm font-medium text-slate-700">{type.label}</p><p className="text-[10px] text-slate-400 leading-tight">{type.desc}</p></div>
                       <Plus className="h-4 w-4 ml-auto text-slate-300 opacity-0 group-hover:opacity-100" />
                     </button>
                   ))}
                 </div>
               </div>
               
               {/* Área de Canvas */}
               <div className="space-y-6 min-h-[500px]">
                  <div className="flex flex-col gap-3 bg-white p-2 rounded-xl border border-slate-200 shadow-sm">
                      <div className="flex items-center justify-between px-2 pt-1">
                        <span className="text-xs font-bold text-slate-400 uppercase flex items-center gap-2"><TableIcon className="h-3 w-3"/> Tabelas do Módulo</span>
                        <div className="flex gap-2">
                          <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" accept=".csv" />
                          <Button size="sm" variant="outline" onClick={() => fileInputRef.current?.click()} className="h-6 text-xs border-green-200 text-green-700 hover:bg-green-50 hover:text-green-800">
                            <FileSpreadsheet className="h-3 w-3 mr-1" /> Importar CSV
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => addTable()} className="h-6 text-xs text-[#003B8F] hover:bg-blue-50"><Plus className="h-3 w-3 mr-1" /> Nova Tabela</Button>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2 px-1">
                        {tables.map(table => (
                            <div key={table.id} onClick={() => setActiveTableId(table.id)} className={`cursor-pointer px-4 py-2 rounded-lg text-sm font-medium border transition-all flex items-center gap-2 select-none ${activeTableId === table.id ? 'bg-[#003B8F] text-white border-[#003B8F] shadow-md' : 'bg-slate-50 text-slate-600 border-slate-200 hover:border-slate-300'}`}>
                                {table.name}
                                {table.rows.length > 0 && <span className="bg-white/20 px-1.5 rounded text-[10px]">{table.rows.length} dados</span>}
                                {tables.length > 1 && <div onClick={(e) => removeTable(table.id, e)} className="hover:bg-white/20 p-0.5 rounded-full ml-1"><X className="h-3 w-3" /></div>}
                            </div>
                        ))}
                      </div>
                      <div className="border-t pt-2 px-1">
                         <Input value={activeTable.name} onChange={(e) => renameActiveTable(e.target.value)} className="h-8 border-transparent hover:border-slate-200 focus:border-[#003B8F] font-bold text-slate-700 px-2" placeholder="Nome da Tabela" />
                      </div>
                  </div>
                  
                  {activeTable.fields.length === 0 ? (
                    <div className="border-2 border-dashed border-slate-300 rounded-2xl p-12 text-center bg-slate-50/50">
                        <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm"><List className="h-8 w-8 text-slate-300" /></div>
                        <h3 className="text-lg font-medium text-slate-600">Tabela Vazia</h3>
                        <p className="text-slate-400 mb-4">Adicione colunas manualmente ou importe um CSV.</p>
                        <Button variant="outline" onClick={() => fileInputRef.current?.click()} className="text-[#003B8F] border-blue-200 hover:bg-blue-50">
                          <Upload className="w-4 h-4 mr-2"/> Importar Dados
                        </Button>
                    </div>
                  ) : (
                    <Reorder.Group axis="y" values={activeTable.fields} onReorder={handleReorder} className="space-y-4">
                        <AnimatePresence>
                           {activeTable.fields.map((field) => {
                             const typeInfo = QUESTION_TYPES.find(t => t.id === field.type) || QUESTION_TYPES[0];
                             
                             return (
                              <Reorder.Item key={field.id} value={field} className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm group hover:border-blue-300 transition-colors relative">
                                 <div className="absolute left-0 top-0 bottom-0 w-1.5 rounded-l-xl bg-slate-200 group-hover:bg-[#003B8F] transition-colors" />
                                 <div className="flex items-start gap-4 pl-4">
                                    <div className="mt-3 text-slate-300 cursor-grab active:cursor-grabbing hover:text-[#003B8F]"><GripVertical className="h-5 w-5" /></div>
                                    <div className="flex-1 space-y-3">
                                       
                                       {/* IDENTIFICAÇÃO DO TIPO (Badge + Ícone) */}
                                       <div className="flex items-center justify-between">
                                           <div className={`inline-flex items-center gap-2 px-2.5 py-1 rounded-md text-xs font-bold uppercase tracking-wide ${typeInfo.color}`}>
                                              <typeInfo.icon className="w-3.5 h-3.5" />
                                              {typeInfo.label}
                                           </div>
                                           <Button variant="ghost" size="icon" onClick={() => removeField(field.id)} className="h-8 w-8 text-slate-400 hover:text-red-500 hover:bg-red-50">
                                              <Trash2 className="h-4 w-4" />
                                           </Button>
                                       </div>

                                       <div className="space-y-1">
                                          <Input value={field.label} onChange={e => updateField(field.id, 'label', e.target.value)} placeholder="Nome do campo..." className="text-lg font-medium border-0 border-b border-slate-200 rounded-none px-0 focus-visible:ring-0 focus-visible:border-[#003B8F] bg-transparent h-auto py-1" />
                                       </div>
                                       
                                       {/* Opções (Se for Select) */}
                                       {field.type === 'select' && (
                                         <div className="bg-slate-50 p-4 rounded-lg space-y-3 mt-2 border border-slate-100">
                                             <p className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-1"><List className="w-3 h-3"/> Opções Disponíveis</p>
                                             <div className="flex flex-wrap gap-2">
                                                 {field.options?.map((opt: any, i: number) => (
                                                     <span key={i} className="bg-white border px-3 py-1 rounded-full text-sm flex items-center gap-2 shadow-sm text-slate-600">{opt.label} <X className="h-3 w-3 cursor-pointer text-slate-400 hover:text-red-500" onClick={() => { const newOpts = field.options.filter((_: any, idx: number) => idx !== i); updateField(field.id, 'options', newOpts); }}/></span>
                                                 ))}
                                             </div>
                                             <div className="flex gap-2">
                                                 <Input id={`opt-${field.id}`} placeholder="Digite e Enter..." className="bg-white h-9 text-sm" onKeyDown={e => { if(e.key === 'Enter') { e.preventDefault(); handleAddOption(field.id); }}} />
                                                 <Button size="sm" variant="secondary" onClick={() => handleAddOption(field.id)}>Adicionar</Button>
                                             </div>
                                         </div>
                                       )}
                                       
                                       <div className="flex items-center gap-2 pt-1"><Switch checked={field.required} onCheckedChange={c => updateField(field.id, 'required', c)} /><span className="text-sm text-slate-500">Obrigatório?</span></div>
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
       )}
    </div>
  );
}