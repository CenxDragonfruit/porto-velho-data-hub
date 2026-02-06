import { useState, useEffect, useRef, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { 
  Plus, ArrowLeft, Search, Pencil, Trash2, Loader2, FileDown, FileUp, 
  Filter, X, Check, FileText as PdfIcon, 
  Type as IconTxt, Hash as IconNum, Calendar as IconDate, 
  Clock as IconTime, List as IconList, DollarSign as IconMoney, 
  CreditCard as IconCard, Link as IconLink, Copy, HelpCircle
} from 'lucide-react';
import { toast } from 'sonner';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator } from '@/components/ui/command';
import { cn } from '@/lib/utils';
// import jsPDF from 'jspdf'; // Descomente se for usar
// import autoTable from 'jspdf-autotable'; // Descomente se for usar

// --- UTILITÁRIOS ---
const cleanText = (txt: string) => txt ? txt.replace(/^['"]+|['"]+$/g, '').replace(/[\r\n]+/g, '').trim() : '';

const parseValueForStorage = (value: any, type: string) => {
    if (value === null || value === undefined || String(value).trim() === '') return null;
    const strValue = String(value).trim();
    switch (type) {
        case 'INTEIRO':
            const intVal = parseInt(strValue.replace(/\./g, ''), 10);
            return isNaN(intVal) ? null : intVal;
        case 'DECIMAL':
            let cleanStr = strValue;
            if (strValue.includes(',') && !strValue.includes('.')) cleanStr = strValue.replace(/\./g, '').replace(',', '.');
            else if (strValue.includes(',') && strValue.includes('.')) cleanStr = strValue.replace(/\./g, '').replace(',', '.');
            const floatVal = parseFloat(cleanStr);
            return isNaN(floatVal) ? null : floatVal;
        case 'DATA':
            if (strValue.match(/^\d{2}\/\d{2}\/\d{4}$/)) {
                const [day, month, year] = strValue.split('/');
                return `${year}-${month}-${day}`;
            }
            return strValue; 
        default: return value;
    }
};

const formatValueForDisplay = (value: any, type: string) => {
    if (value === null || value === undefined || value === '') return '-';
    switch (type) {
        case 'DATA':
            try {
                const date = new Date(value);
                const userTimezoneOffset = date.getTimezoneOffset() * 60000;
                const adjustedDate = new Date(date.getTime() + userTimezoneOffset);
                return adjustedDate.toLocaleDateString('pt-BR');
            } catch { return value; }
        case 'DECIMAL':
            return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value));
        case 'BOOLEANO': return value ? 'Sim' : 'Não';
        default: return String(value);
    }
};

const TypeIcon = ({ type }: { type: string }) => {
    switch (type) {
        case 'TEXTO': return <IconTxt className="w-3.5 h-3.5 text-blue-500" />;
        case 'TEXTO_LONGO': return <IconTxt className="w-3.5 h-3.5 text-indigo-500" />;
        case 'INTEIRO': return <IconNum className="w-3.5 h-3.5 text-emerald-500" />;
        case 'DECIMAL': return <IconMoney className="w-3.5 h-3.5 text-yellow-600" />;
        case 'DATA': return <IconDate className="w-3.5 h-3.5 text-orange-500" />;
        case 'HORA': return <IconTime className="w-3.5 h-3.5 text-orange-400" />;
        case 'CPF': case 'CNPJ': return <IconCard className="w-3.5 h-3.5 text-purple-500" />;
        case 'SELECAO_LISTA': return <IconList className="w-3.5 h-3.5 text-rose-500" />;
        default: return <HelpCircle className="w-3.5 h-3.5 text-slate-400" />;
    }
};

const TypeLabel = ({ type }: { type: string }) => {
    const labels: Record<string, string> = {
        'TEXTO': 'Texto Curto', 'TEXTO_LONGO': 'Texto Longo', 'INTEIRO': 'Número Inteiro',
        'DECIMAL': 'Moeda/Valor', 'DATA': 'Data', 'HORA': 'Hora', 'CPF': 'CPF',
        'CNPJ': 'CNPJ', 'SELECAO_LISTA': 'Lista de Opções'
    };
    return labels[type] || type;
};

function getInputType(dbType: string) {
    switch (dbType) {
        case 'INTEIRO': return 'number';
        case 'DECIMAL': return 'number';
        case 'DATA': return 'date';
        case 'HORA': return 'time';
        default: return 'text';
    }
}

// --- COMPONENTE PRINCIPAL ---

export default function CrudPage() {
  const { id: moduleId } = useParams(); 
  const navigate = useNavigate();
  const { userData, role, canWriteInModule } = useAuth();
  
  const [module, setModule] = useState<any>(null);
  const [fields, setFields] = useState<any[]>([]);
  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [canWrite, setCanWrite] = useState(false);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [columnFilters, setColumnFilters] = useState<Record<string, string[]>>({});
  
  const [dialogOpen, setDialogOpen] = useState(false);
  const [formData, setFormData] = useState<any>({});
  const [editVersionId, setEditVersionId] = useState<number | null>(null);
  const [editMestreId, setEditMestreId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [exportSelectedFields, setExportSelectedFields] = useState<string[]>([]);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [importCsvData, setImportCsvData] = useState<{headers: string[], rows: any[]} | null>(null);
  const [importMapping, setImportMapping] = useState<Record<string, string>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [biModalOpen, setBiModalOpen] = useState(false);

  useEffect(() => {
    if (moduleId) {
      loadSystem();
      checkPermissions();
    }
  }, [moduleId]);

  const checkPermissions = async () => {
    if (!moduleId) return;
    const allowed = await canWriteInModule(Number(moduleId));
    setCanWrite(allowed);
  };

  const loadSystem = async () => {
    setLoading(true);
    try {
      const { data: mod, error } = await supabase.from('modulos').select('*').eq('id', Number(moduleId)).single();
      if (error || !mod) { toast.error("Sistema não encontrado."); navigate('/modulos'); return; }
      setModule(mod);

      const { data: flds, error: fldError } = await supabase
        .from('definicao_colunas')
        .select(`
            *, 
            catalogos_dominio:catalogo_referencia_id ( 
                itens_catalogo ( 
                    valor_exibicao, 
                    chave 
                ) 
            )
        `)
        .eq('modulo_id', mod.id)
        .order('ordem');

      if (fldError) throw fldError;

      const mappedFields = (flds || []).map(f => {
        let options: any[] = [];
        
        const catalogo = Array.isArray(f.catalogos_dominio) ? f.catalogos_dominio[0] : f.catalogos_dominio;

        if (f.tipo === 'SELECAO_LISTA' && catalogo?.itens_catalogo) {
            options = catalogo.itens_catalogo.map((it: any) => ({ 
                label: it.valor_exibicao, 
                value: it.valor_exibicao 
            }));
        }
        
        return { 
            id: f.id, 
            name: f.nome_tecnico, 
            label: f.label_visual, 
            type: f.tipo, 
            options: options, 
            required: f.obrigatorio, 
            mask: f.mascara_formato 
        };
      });

      setFields(mappedFields);
      setExportSelectedFields(mappedFields.map(f => f.name));
      await loadTableData(mod.id);
    } catch (e: any) { 
        console.error(e); 
        toast.error("Erro ao carregar colunas: " + e.message);
    } finally { 
        setLoading(false); 
    }
  };

  const loadTableData = async (modId: number) => {
    try {
        const { data: recs, error } = await supabase.from('versoes_registro')
            .select(`id, status, conteudo, criado_em, registro_mestre_id, registros_mestre!inner ( modulo_id )`)
            .eq('registros_mestre.modulo_id', modId).eq('is_atual', true).order('criado_em', { ascending: false });
        if (error) throw error;
        const flatRecords = recs.map(r => ({ id: r.id, mestre_id: r.registro_mestre_id, status: r.status, created_at: r.criado_em, data: r.conteudo as Record<string, any> }));
        setRecords(flatRecords || []);
    } catch(e) { console.error(e); }
  };

  const filteredRecords = useMemo(() => {
    return records.filter(r => {
      const matchesGlobal = searchTerm === '' || JSON.stringify(r.data).toLowerCase().includes(searchTerm.toLowerCase()) || String(r.status).toLowerCase().includes(searchTerm.toLowerCase());
      const matchesColumns = Object.keys(columnFilters).every(key => {
          const selectedValues = columnFilters[key];
          if (!selectedValues || selectedValues.length === 0) return true;
          if (key === 'status') return selectedValues.includes(r.status);
          const recordVal = String(r.data[key] || '');
          return selectedValues.includes(recordVal);
      });
      return matchesGlobal && matchesColumns;
    });
  }, [records, searchTerm, columnFilters]);

  // --- ARQUIVOS ---
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]; if (!file) return;
      const reader = new FileReader();
      reader.onload = (event) => {
          const text = event.target?.result as string;
          const lines = text.split(/\r\n|\n/).filter(line => line.trim() !== '');
          if(lines.length < 2) return toast.error("Arquivo inválido.");
          const headers = lines[0].split(',').map(h => cleanText(h));
          const rows = lines.slice(1).map(line => {
             const values = line.split(','); const row:any = {};
             headers.forEach((h, i) => row[h] = values[i] ? cleanText(values[i]) : '');
             return row;
          });
          setImportCsvData({ headers, rows });
          const initialMap: Record<string, string> = {};
          headers.forEach(h => {
              const exactMatch = fields.find(f => f.label.toLowerCase() === h.toLowerCase() || f.name.toLowerCase() === h.toLowerCase());
              initialMap[h] = exactMatch ? exactMatch.name : 'ignore';
          });
          setImportMapping(initialMap);
          setImportModalOpen(true);
      };
      reader.readAsText(file);
      if(fileInputRef.current) fileInputRef.current.value = '';
  };

  const processImport = async () => {
      if(!importCsvData || !module) return; setSaving(true);
      try {
          const statusToSave = (role === 'ADMINISTRADOR' || role === 'SUPERVISOR') ? 'OFICIAL' : 'PENDENTE';
          const jsonPayloads = importCsvData.rows.map(csvRow => {
              const recordData: any = {}; let hasData = false;
              Object.keys(importMapping).forEach(csvHeader => {
                  const targetFieldKey = importMapping[csvHeader];
                  if(targetFieldKey && targetFieldKey !== 'ignore') {
                      const rawValue = csvRow[csvHeader];
                      const fieldDef = fields.find(f => f.name === targetFieldKey);
                      if (fieldDef && rawValue) {
                          const convertedValue = parseValueForStorage(rawValue, fieldDef.type);
                          if (convertedValue !== null) { recordData[targetFieldKey] = convertedValue; hasData = true; }
                      }
                  }
              });
              return hasData ? recordData : null;
          }).filter(Boolean);
          if (jsonPayloads.length === 0) throw new Error("Nenhum dado válido.");
          let successCount = 0;
          for (const payload of jsonPayloads) {
             const { data: mestre } = await supabase.from('registros_mestre').insert({ modulo_id: module.id }).select().single();
             if (mestre) {
                 await supabase.from('versoes_registro').insert({ registro_mestre_id: mestre.id, conteudo: payload, versao: 1, status: statusToSave, is_atual: true, criado_por_id: userData?.id });
                 successCount++;
             }
          }
          toast.success(`${successCount} registros importados!`);
          await loadTableData(module.id);
          setImportModalOpen(false); setImportCsvData(null);
      } catch(e:any) { toast.error("Erro: " + e.message); } finally { setSaving(false); }
  };

  const handleExportClick = () => { setExportSelectedFields(fields.map(f => f.name)); setExportModalOpen(true); };
  
  const processExportCSV = () => {
    if (filteredRecords.length === 0) return toast.warning("Nada para exportar.");
    const activeFields = fields.filter(f => exportSelectedFields.includes(f.name));
    const headers = ['ID', 'Status', 'Data', ...activeFields.map(f => f.label)];
    const rows = filteredRecords.map(r => {
      const statusLabel = r.status;
      const dataCells = activeFields.map(f => {
        let val = r.data[f.name]; val = formatValueForDisplay(val, f.type);
        if (typeof val === 'string') { val = val.replace(/"/g, '""'); if (val.includes(',') || val.includes('\n')) val = `"${val}"`; }
        return val;
      });
      return [r.id, statusLabel, new Date(r.created_at).toLocaleDateString('pt-BR'), ...dataCells].join(',');
    });
    const csvContent = "\uFEFF" + [headers.join(','), ...rows].join('\n');
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([csvContent], { type: 'text/csv;charset=utf-8;' }));
    link.download = `${module.nome}_export.csv`;
    document.body.appendChild(link); link.click(); document.body.removeChild(link);
    setExportModalOpen(false);
  };
  
  const handleExportPDF = () => { toast.info("Funcionalidade de PDF precisa ser configurada com jsPDF."); };

  // --- CRUD ---
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true);
    try {
      const cleanData: any = {};
      fields.forEach(f => { const rawVal = formData[f.name]; cleanData[f.name] = parseValueForStorage(rawVal, f.type); });
      const statusToSave = (role === 'ADMINISTRADOR' || role === 'SUPERVISOR') ? 'OFICIAL' : 'PENDENTE';
      if (editVersionId && editMestreId) {
        await supabase.from('versoes_registro').update({ conteudo: cleanData, status: statusToSave }).eq('id', editVersionId);
        toast.success('Registro atualizado!');
        setRecords(prev => prev.map(r => r.id === editVersionId ? { ...r, data: cleanData, status: statusToSave } : r));
      } else {
        const { data: mestre } = await supabase.from('registros_mestre').insert({ modulo_id: module.id }).select().single();
        if (mestre) {
            const { data: novaVersao } = await supabase.from('versoes_registro').insert({ registro_mestre_id: mestre.id, conteudo: cleanData, versao: 1, status: statusToSave, is_atual: true, criado_por_id: userData?.id }).select().single();
            if (novaVersao) {
                const newRecord = { id: novaVersao.id, mestre_id: mestre.id, status: novaVersao.status, created_at: novaVersao.criado_em, data: cleanData };
                setRecords(prev => [newRecord, ...prev]);
                toast.success('Registro salvo!');
            }
        }
      }
      setDialogOpen(false); setFormData({}); setEditVersionId(null); setEditMestreId(null);
    } catch (error: any) { toast.error("Erro: " + error.message); } finally { setSaving(false); }
  };

  const handleDelete = async (mestreId: number) => {
    if(!confirm("Tem certeza?")) return;
    try {
        await supabase.from('registros_mestre').delete().eq('id', mestreId);
        setRecords(prev => prev.filter(r => r.mestre_id !== mestreId));
        toast.success("Registro removido.");
    } catch(e:any) { toast.error("Erro: " + e.message); }
  };

  const getApiUrl = () => {
    const baseUrl = import.meta.env.VITE_SUPABASE_URL || '';
    const functionUrl = baseUrl.replace('.supabase.co', '.supabase.co/functions/v1/exportar-dados'); 
    return `${functionUrl}?token=segredo_prefeitura_bi_2024&id=${module?.id}&pagina=1`;
  };

  if (loading) return <div className="p-8 flex justify-center"><Loader2 className="animate-spin text-[#003B8F]" /></div>;

  return (
    <div className="space-y-6 pb-20 animate-in fade-in pt-8">
      <Button variant="ghost" onClick={() => navigate('/modulos')} className="pl-0 text-slate-500 hover:text-[#003B8F]">
        <ArrowLeft className="mr-2 h-4 w-4" /> Voltar
      </Button>

      {/* HEADER */}
      <div className="bg-gradient-to-r from-[#003B8F] to-[#0055CC] rounded-2xl p-8 text-white shadow-lg flex flex-col md:flex-row justify-between gap-6">
        <div>
          <div className="flex items-center gap-2 text-blue-200 text-sm font-medium uppercase mb-1">
             <span className="bg-white/20 px-2 py-0.5 rounded">Módulo</span>
          </div>
          <h1 className="text-3xl font-bold">{module?.nome}</h1>
          <p className="text-blue-100 mt-1 opacity-80">{module?.descricao}</p>
        </div>
        <div className="flex flex-wrap gap-2 items-center">
           <Button onClick={() => setBiModalOpen(true)} className="bg-indigo-500 hover:bg-indigo-600 text-white border-0 shadow-sm"><IconLink className="mr-2 h-4 w-4" /> API / BI</Button>
           <Button onClick={handleExportClick} variant="outline" className="bg-white/10 text-white border-white/20 hover:bg-white/20"><FileDown className="mr-2 h-4 w-4" /> Exportar</Button>
           <input type="file" ref={fileInputRef} accept=".csv" className="hidden" onChange={handleFileSelect} />
           {canWrite && (<Button onClick={() => fileInputRef.current?.click()} variant="outline" className="bg-white/10 text-white border-white/20 hover:bg-white/20"><FileUp className="mr-2 h-4 w-4" /> Importar CSV</Button>)}
           {canWrite && (<Button onClick={() => { setFormData({}); setEditVersionId(null); setEditMestreId(null); setDialogOpen(true); }} className="bg-[#22C55E] hover:bg-green-500 text-white border-0 shadow-md"><Plus className="mr-2 h-4 w-4" /> Novo Registro</Button>)}
        </div>
      </div>

      {/* TABELA DE DADOS */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden min-h-[400px]">
        <div className="p-4 border-b flex justify-between items-center bg-slate-50">
           <div className="relative max-w-sm w-full"><Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" /><Input placeholder={`Busca global...`} className="pl-10 bg-white" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} /></div>
           {Object.keys(columnFilters).length > 0 && (<Button variant="ghost" size="sm" onClick={() => setColumnFilters({})} className="text-red-500 hover:bg-red-50 h-8"><X className="mr-2 h-4 w-4"/> Limpar Filtros</Button>)}
           <span className="text-sm text-slate-500 font-medium">{filteredRecords.length} registros</span>
        </div>
        <div className="overflow-x-auto">
          {fields.length === 0 ? (<div className="p-12 text-center text-slate-400">Sem colunas definidas.</div>) : (
            <Table>
                <TableHeader>
                    <TableRow className="bg-slate-50 hover:bg-slate-50">
                        <TableHead className="w-[140px] font-bold text-[#003B8F]">
                            <ColumnFilter title="Status" fieldKey="status" allRecords={records} selectedValues={columnFilters['status']} onChange={(vals: string[]) => { const newFilters = { ...columnFilters }; if(vals.length) newFilters['status'] = vals; else delete newFilters['status']; setColumnFilters(newFilters); }} />
                        </TableHead>
                        {fields.map(f => (
                            <TableHead key={f.id} className="min-w-[150px] font-bold text-slate-700">
                                <div className="flex items-center gap-2">
                                    <TooltipProvider><Tooltip><TooltipTrigger><div className="p-1.5 rounded bg-slate-100 hover:bg-slate-200 transition-colors cursor-help"><TypeIcon type={f.type} /></div></TooltipTrigger><TooltipContent side="top"><p className="font-medium text-xs">{TypeLabel({ type: f.type })}</p></TooltipContent></Tooltip></TooltipProvider>
                                    <ColumnFilter title={f.label} fieldKey={f.name} allRecords={records} selectedValues={columnFilters[f.name]} onChange={(vals: string[]) => { const newFilters = { ...columnFilters }; if(vals.length) newFilters[f.name] = vals; else delete newFilters[f.name]; setColumnFilters(newFilters); }} />
                                </div>
                            </TableHead>
                        ))}
                        <TableHead className="text-right font-bold text-slate-700 sticky right-0 bg-slate-50">Ações</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                {filteredRecords.map((record) => (
                    <TableRow key={record.id} className="hover:bg-slate-50 group transition-colors">
                    <TableCell><Badge className={record.status === 'OFICIAL' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}>{record.status === 'OFICIAL' ? 'Oficial' : 'Análise'}</Badge></TableCell>
                    {fields.map(f => {
                      const rawVal = record.data[f.name]; const displayVal = formatValueForDisplay(rawVal, f.type);
                      return <TableCell key={f.id} className="max-w-[200px] whitespace-normal break-words text-sm text-slate-600">{displayVal}</TableCell>;
                    })}
                    <TableCell className="text-right sticky right-0 bg-white group-hover:bg-slate-50">
                        {canWrite && (<div className="flex justify-end gap-1 opacity-100"><Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-blue-50" onClick={() => { setFormData(record.data); setEditVersionId(record.id); setEditMestreId(record.mestre_id); setDialogOpen(true); }}><Pencil className="h-4 w-4 text-blue-600" /></Button><Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-red-50" onClick={() => handleDelete(record.mestre_id)}><Trash2 className="h-4 w-4 text-red-400" /></Button></div>)}
                    </TableCell>
                    </TableRow>
                ))}
                </TableBody>
            </Table>
          )}
        </div>
      </div>

      {/* MODAL BI / API */}
      <Dialog open={biModalOpen} onOpenChange={setBiModalOpen}>
          <DialogContent className="max-w-2xl">
              <DialogHeader>
                  <DialogTitle className="flex items-center gap-2"><IconLink className="w-5 h-5 text-indigo-500"/> Integração Pública (Power BI / Excel)</DialogTitle>
                  <DialogDescription>Link direto para dados JSON. Não requer headers complexos.</DialogDescription>
              </DialogHeader>
              <div className="bg-slate-50 p-4 rounded-lg border space-y-4">
                  <div>
                      <Label className="text-xs font-bold text-slate-500 uppercase">URL da API</Label>
                      <div className="flex gap-2 mt-1">
                          <Input readOnly value={getApiUrl()} className="bg-white font-mono text-xs text-slate-600" />
                          <Button size="icon" variant="outline" onClick={() => { navigator.clipboard.writeText(getApiUrl()); toast.success("Link copiado!"); }}><Copy className="h-4 w-4" /></Button>
                      </div>
                  </div>
                  <div className="text-sm text-slate-600 space-y-2 pt-2">
                      <p className="font-semibold text-slate-800">No Power BI / Excel:</p>
                      <ol className="list-decimal pl-5 space-y-1 text-xs">
                          <li>Selecione <strong>Obter Dados</strong> {'>'} <strong>Web</strong>.</li>
                          <li>Cole o link acima.</li>
                          <li>Se pedir credenciais, selecione <strong>Anônimo</strong>.</li>
                      </ol>
                  </div>
              </div>
          </DialogContent>
      </Dialog>

      {/* MODAL NOVO/EDITAR REGISTRO */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editVersionId ? 'Editar Registro' : 'Novo Registro'}</DialogTitle></DialogHeader>
          <form onSubmit={handleSave} className="space-y-4 pt-4">
              <div className="grid gap-4 md:grid-cols-2">
                {fields.map(f => {
                    // --- LÓGICA DE CORREÇÃO: POPULAR OPÇÕES ---
                    let fieldOptions = f.options || [];

                    // Se for tipo Lista mas a lista está vazia, pega dos registros existentes
                    if (f.type === 'SELECAO_LISTA' && fieldOptions.length === 0) {
                        const uniqueValues = new Set<string>();
                        records.forEach(r => {
                            const val = r.data[f.name];
                            if (val !== null && val !== undefined && String(val).trim() !== '') {
                                uniqueValues.add(String(val));
                            }
                        });
                        fieldOptions = Array.from(uniqueValues).sort().map(v => ({ label: v, value: v }));
                    }

                    // Se for SELECAO_LISTA mas não tiver NENHUM dado (sistema novo), 
                    // cai para Input normal para permitir cadastrar o primeiro
                    const showSelect = f.type === 'SELECAO_LISTA' && fieldOptions.length > 0;

                    return (
                        <div key={f.id} className={f.type === 'TEXTO_LONGO' ? 'col-span-2' : ''}>
                            <Label className="text-slate-700 font-medium">{f.label} {f.required && <span className="text-red-500">*</span>}</Label>
                            
                            {f.type === 'TEXTO_LONGO' ? (
                                <Textarea required={f.required} value={formData[f.name]||''} onChange={e=>setFormData({...formData, [f.name]:e.target.value})} className="mt-1" />
                            ) : showSelect ? (
                                <Select value={formData[f.name] || ''} onValueChange={v => setFormData({ ...formData, [f.name]: v })}>
                                <SelectTrigger className="mt-1"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                                <SelectContent>
                                    {fieldOptions.map((opt: any, index: number) => (
                                            <SelectItem key={`${f.name}-opt-${index}`} value={opt.value}>{opt.label}</SelectItem>
                                    ))}
                                </SelectContent>
                                </Select> 
                            ) : (
                                <Input type={getInputType(f.type)} step={f.type === 'DECIMAL' ? "0.01" : undefined} required={f.required} value={formData[f.name]||''} onChange={e=>setFormData({...formData, [f.name]:e.target.value})} className="mt-1" placeholder={f.type === 'SELECAO_LISTA' ? "Digite novo valor..." : ""} />
                            )}
                        </div>
                    );
                })}
              </div>
              <Button type="submit" className="w-full bg-[#22C55E]" disabled={saving}>Salvar Registro</Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* MODAL EXPORT */}
      <Dialog open={exportModalOpen} onOpenChange={setExportModalOpen}>
        <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>Exportar Dados</DialogTitle></DialogHeader>
            <div className="py-4 space-y-2 max-h-[50vh] overflow-y-auto border rounded p-2">
                <div className="flex items-center space-x-2 p-2 bg-slate-100 rounded">
                    <Checkbox id="select-all" checked={exportSelectedFields.length === fields.length} onCheckedChange={(c) => c ? setExportSelectedFields(fields.map(f => f.name)) : setExportSelectedFields([])} />
                    <label htmlFor="select-all" className="font-bold cursor-pointer">Todas as colunas</label>
                </div>
                {fields.map(f => (
                    <div key={f.id} className="flex items-center space-x-2 p-2 hover:bg-slate-50 rounded">
                        <Checkbox id={`exp-${f.id}`} checked={exportSelectedFields.includes(f.name)} onCheckedChange={(c) => c ? setExportSelectedFields([...exportSelectedFields, f.name]) : setExportSelectedFields(exportSelectedFields.filter(x => x !== f.name))} />
                        <label htmlFor={`exp-${f.id}`} className="text-sm cursor-pointer flex-1">{f.label}</label>
                    </div>
                ))}
            </div>
            <DialogFooter className="flex gap-2 sm:justify-end">
                <Button variant="outline" onClick={processExportCSV} className="flex-1 border-green-600 text-green-700 hover:bg-green-50"><FileDown className="mr-2 h-4 w-4" /> CSV</Button>
                <Button onClick={handleExportPDF} className="flex-1 bg-red-600 hover:bg-red-700 text-white"><PdfIcon className="mr-2 h-4 w-4" /> PDF</Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL IMPORT */}
      <Dialog open={importModalOpen} onOpenChange={setImportModalOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col">
            <DialogHeader><DialogTitle>Importar CSV</DialogTitle></DialogHeader>
            <div className="flex-1 overflow-y-auto py-4">
                {importCsvData?.headers.map((h, i) => (
                    <div key={i} className="grid grid-cols-2 gap-4 items-center p-2 border-b last:border-0 hover:bg-slate-50">
                        <div className="truncate font-medium text-sm" title={h}>{h}</div>
                        <Select value={importMapping[h] || 'ignore'} onValueChange={(v) => setImportMapping({...importMapping, [h]: v})}>
                            <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="ignore" className="text-slate-400 italic">-- Ignorar --</SelectItem>
                                {fields.map(f => <SelectItem key={f.id} value={f.name}>{f.label}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>
                ))}
            </div>
            <DialogFooter><Button onClick={processImport} disabled={saving} className="w-full bg-[#22C55E]">{saving ? 'Importando...' : `Confirmar`}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Helper para filtro
function ColumnFilter({ title, fieldKey, allRecords, selectedValues = [], onChange }: any) {
    const options = useMemo(() => {
        const unique = new Set<string>();
        allRecords.forEach((r: any) => {
            let val = '';
            if (fieldKey === 'status') val = r.status;
            else val = String(r.data[fieldKey] || '');
            if(val.trim()) unique.add(val);
        });
        return Array.from(unique).sort();
    }, [allRecords, fieldKey]);
    const isFiltered = selectedValues.length > 0;
    return (
        <Popover>
            <PopoverTrigger asChild>
                <Button variant="ghost" size="sm" className={cn("-ml-3 h-8 data-[state=open]:bg-slate-100", isFiltered && "bg-blue-50 text-blue-600")}>
                    <span>{title}</span>
                    {isFiltered ? <Filter className="ml-2 h-4 w-4 fill-blue-600" /> : <Filter className="ml-2 h-3 w-3 text-slate-400" />}
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[250px] p-0" align="start">
                <Command>
                    <CommandInput placeholder={`Buscar em ${title}...`} />
                    <CommandList>
                        <CommandEmpty>Vazio.</CommandEmpty>
                        <CommandGroup>
                            {options.map((option) => {
                                const isSelected = selectedValues.includes(option);
                                return (
                                    <CommandItem key={option} onSelect={() => onChange(isSelected ? selectedValues.filter((v:string) => v !== option) : [...selectedValues, option])}>
                                        <div className={cn("mr-2 flex h-4 w-4 items-center justify-center rounded-sm border border-primary", isSelected ? "bg-primary text-primary-foreground" : "opacity-50 [&_svg]:invisible")}><Check className={cn("h-4 w-4")} /></div>
                                        <span className="truncate" title={option}>{option}</span>
                                    </CommandItem>
                                );
                            })}
                        </CommandGroup>
                        {selectedValues.length > 0 && (<><CommandSeparator /><CommandGroup><CommandItem onSelect={() => onChange([])} className="justify-center text-center">Limpar</CommandItem></CommandGroup></>)}
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    );
}