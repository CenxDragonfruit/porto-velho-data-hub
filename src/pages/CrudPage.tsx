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
import { 
  Plus, ArrowLeft, Search, Pencil, Trash2, Loader2, FileDown, FileUp, 
  Filter, X, Check, FileText as PdfIcon, Table as TableIcon 
} from 'lucide-react';
import { toast } from 'sonner';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator } from '@/components/ui/command';
import { cn } from '@/lib/utils';

// Imports do PDF
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// Função para limpar sujeira do CSV
const cleanText = (txt: string) => txt ? txt.replace(/^['"]+|['"]+$/g, '').replace(/[\r\n]+/g, '').trim() : '';

export default function CrudPage() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { user, role } = useAuth();
  
  // Estados do Sistema
  const [module, setModule] = useState<any>(null);
  const [tables, setTables] = useState<any[]>([]);
  const [activeTable, setActiveTable] = useState<any>(null);
  const [fields, setFields] = useState<any[]>([]);
  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Estados de Interface e Filtros
  const [searchTerm, setSearchTerm] = useState('');
  const [columnFilters, setColumnFilters] = useState<Record<string, string[]>>({});
  
  const [dialogOpen, setDialogOpen] = useState(false);
  const [formData, setFormData] = useState<any>({});
  const [editRecordId, setEditRecordId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Estados de Importação / Exportação
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [exportSelectedFields, setExportSelectedFields] = useState<string[]>([]);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [importCsvData, setImportCsvData] = useState<{headers: string[], rows: any[]} | null>(null);
  const [importMapping, setImportMapping] = useState<Record<string, string>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 1. Carregar Sistema
  useEffect(() => { if (slug) loadSystem(); }, [slug]);

  const loadSystem = async () => {
    try {
      const { data: mod, error } = await supabase.from('crud_modules').select('*').eq('slug', slug).single();
      if (error || !mod) { 
          toast.error("Sistema não encontrado."); 
          navigate('/modulos'); 
          return; 
      }
      setModule(mod);
      const { data: tabs } = await supabase.from('crud_tables').select('*').eq('crud_module_id', mod.id).order('created_at');
      setTables(tabs || []);
      if (tabs && tabs.length > 0) setActiveTable(tabs[0]); 
      else setLoading(false);
    } catch (e) { console.error(e); setLoading(false); }
  };

  // 2. Carregar Dados da Tabela
  useEffect(() => { 
      if (activeTable) {
          loadTableData();
          setColumnFilters({});
      }
  }, [activeTable]);

  const loadTableData = async () => {
    setLoading(true);
    try {
        const { data: flds } = await supabase.from('crud_fields').select('*').eq('crud_table_id', activeTable.id).order('order_index');
        const safeFields = (flds || []).map(f => {
            let safeOptions = [];
            if (Array.isArray(f.options)) safeOptions = f.options;
            else if (typeof f.options === 'string') { try { safeOptions = JSON.parse(f.options); } catch (e) { safeOptions = []; } }
            return { ...f, options: safeOptions };
        });
        setFields(safeFields);
        setExportSelectedFields(safeFields.map(f => f.name));

        const { data: recs } = await supabase.from('crud_records').select('*').eq('crud_table_id', activeTable.id).order('created_at', { ascending: false });
        setRecords(recs || []);
    } catch(e) { console.error(e); } finally { setLoading(false); }
  };

  // --- LÓGICA DE FILTRAGEM AVANÇADA ---
  const filteredRecords = useMemo(() => {
    return records.filter(r => {
      const matchesGlobal = searchTerm === '' || 
                            JSON.stringify(r.data).toLowerCase().includes(searchTerm.toLowerCase()) ||
                            r.status.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesColumns = Object.keys(columnFilters).every(key => {
          const selectedValues = columnFilters[key];
          if (!selectedValues || selectedValues.length === 0) return true;

          if (key === 'status') {
              const statusLabel = r.status === 'approved' ? 'Aprovado' : r.status === 'rejected' ? 'Negado' : 'Análise';
              return selectedValues.includes(statusLabel);
          }

          const recordVal = String(r.data[key] || '');
          return selectedValues.includes(recordVal);
      });

      return matchesGlobal && matchesColumns;
    });
  }, [records, searchTerm, columnFilters]);

  // --- IMPORTAÇÃO CSV ---
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      
      reader.onload = (event) => {
          const text = event.target?.result as string;
          const lines = text.split(/\r\n|\n/).filter(line => line.trim() !== '');
          if(lines.length < 2) return toast.error("Arquivo inválido.");
          
          const headers = lines[0].split(',').map(h => cleanText(h));
          const rows = lines.slice(1).map(line => {
             const values = line.split(','); 
             const row:any = {};
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
      if(!importCsvData) return;
      setSaving(true);
      try {
          const batchId = crypto.randomUUID(); 
          const importStatus = (role === 'administrador' || role === 'supervisor') ? 'approved' : 'pending';

          const newRecords = importCsvData.rows.map(csvRow => {
              const recordData: any = {};
              let hasData = false;
              Object.keys(importMapping).forEach(csvHeader => {
                  const targetFieldKey = importMapping[csvHeader];
                  if(targetFieldKey && targetFieldKey !== 'ignore') {
                      const value = csvRow[csvHeader];
                      if(value) { recordData[targetFieldKey] = value; hasData = true; }
                  }
              });
              if (!hasData) return null;
              recordData['_batch_id'] = batchId; 
              return { crud_table_id: activeTable.id, data: recordData, created_by: user?.id, status: importStatus };
          }).filter(Boolean);

          if (newRecords.length === 0) throw new Error("Nenhum dado válido mapeado.");

          const BATCH_SIZE = 50;
          for(let i=0; i<newRecords.length; i+=BATCH_SIZE) {
              const { error } = await supabase.from('crud_records').insert(newRecords.slice(i, i+BATCH_SIZE));
              if (error) throw error;
          }
          toast.success(`${newRecords.length} registros importados em lote!`);
          await loadTableData();
          setImportModalOpen(false);
          setImportCsvData(null);
      } catch(e:any) { toast.error("Erro: " + e.message); } finally { setSaving(false); }
  };

  // --- EXPORTAÇÃO CSV ---
  const handleExportClick = () => { setExportSelectedFields(fields.map(f => f.name)); setExportModalOpen(true); };
  
  const processExportCSV = () => {
    if (filteredRecords.length === 0) { toast.warning("Nada para exportar."); return; }
    const activeFields = fields.filter(f => exportSelectedFields.includes(f.name));
    const headers = ['ID', 'Status', 'Data', ...activeFields.map(f => f.label)];
    
    const rows = filteredRecords.map(r => {
      const statusLabel = r.status === 'approved' ? 'Aprovado' : r.status === 'rejected' ? 'Negado' : 'Pendente';
      
      const dataCells = activeFields.map(f => {
        let val = r.data[f.name];
        // Tenta achar o label se for select
        const opt = f.options?.find((o:any) => o.value === val);
        if(opt) val = opt.label;
        
        val = val || '';
        if (typeof val === 'string') { 
            val = val.replace(/"/g, '""'); 
            if (val.includes(',') || val.includes('\n')) val = `"${val}"`; 
        }
        return val;
      });

      return [r.id, statusLabel, new Date(r.created_at).toLocaleDateString('pt-BR'), ...dataCells].join(',');
    });
    
    const csvContent = "\uFEFF" + [headers.join(','), ...rows].join('\n');
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([csvContent], { type: 'text/csv;charset=utf-8;' }));
    link.download = `${module.name}_${activeTable.name}.csv`;
    document.body.appendChild(link); link.click(); document.body.removeChild(link);
    setExportModalOpen(false);
  };

  // --- EXPORTAÇÃO PDF (RF012) ---
  const handleExportPDF = () => {
    if (filteredRecords.length === 0) { toast.warning("Nada para exportar."); return; }
    
    const doc = new jsPDF();
    
    // Título e Cabeçalho do PDF
    doc.setFontSize(16);
    doc.setTextColor(0, 59, 143); // Azul Prefeitura
    doc.text("Prefeitura de Porto Velho - Relatório de Dados", 14, 20);
    
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Sistema: ${module.name} | Tabela: ${activeTable.name}`, 14, 28);
    doc.text(`Gerado em: ${new Date().toLocaleDateString()} às ${new Date().toLocaleTimeString()}`, 14, 33);

    // Preparar dados da tabela
    const activeFields = fields.filter(f => exportSelectedFields.includes(f.name));
    const tableHeaders = [['Status', 'Data', ...activeFields.map(f => f.label)]];
    
    const tableData = filteredRecords.map(r => {
        const statusLabel = r.status === 'approved' ? 'Aprovado' : r.status === 'rejected' ? 'Negado' : 'Pendente';
        const dateStr = new Date(r.created_at).toLocaleDateString('pt-BR');
        
        const rowData = activeFields.map(f => {
            const rawVal = r.data[f.name];
            // Fix para mostrar Label no PDF também
            const opt = f.options?.find((o:any) => o.value === rawVal);
            return String(opt ? opt.label : (rawVal || '-'));
        });

        return [statusLabel, dateStr, ...rowData];
    });

    // Gerar Tabela
    autoTable(doc, {
        startY: 40,
        head: tableHeaders,
        body: tableData,
        headStyles: { fillColor: [0, 59, 143], textColor: 255, fontSize: 8 },
        bodyStyles: { fontSize: 8 },
        alternateRowStyles: { fillColor: [245, 247, 250] },
        theme: 'grid'
    });

    doc.save(`Relatorio_${module.slug}_${new Date().getTime()}.pdf`);
    toast.success("PDF gerado com sucesso!");
    setExportModalOpen(false);
  };

  // --- CRUD COM VALIDAÇÃO DE FLUXO ---
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const cleanData = { ...formData };
      delete cleanData['_batch_id'];
      
      const statusToSave = (role === 'administrador' || role === 'supervisor') ? 'approved' : 'pending';

      if (editRecordId) {
        await supabase.from('crud_records').update({ data: cleanData, status: statusToSave }).eq('id', editRecordId);
        toast.success('Registro atualizado!');
        setRecords(prev => prev.map(r => r.id === editRecordId ? { ...r, data: cleanData, status: statusToSave } : r));
      } else {
        const { data: newRec, error } = await supabase.from('crud_records').insert({ 
            crud_table_id: activeTable.id, 
            data: cleanData, 
            created_by: user?.id, 
            status: statusToSave 
        }).select().single();
        if (error) throw error;
        toast.success(statusToSave === 'pending' ? 'Enviado para aprovação!' : 'Registro salvo!');
        setRecords(prev => [newRec, ...prev]);
      }
      setDialogOpen(false); setFormData({}); setEditRecordId(null);
    } catch (error: any) { toast.error("Erro: " + error.message); } finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    if(!confirm("Tem certeza que deseja excluir este registro?")) return;
    try {
      await supabase.from('crud_records').delete().eq('id', id);
      setRecords(prev => prev.filter(r => r.id !== id));
      toast.success("Removido.");
    } catch (e) { toast.error("Erro ao excluir."); }
  };

  // --- NOVA FUNÇÃO: DELETAR O SISTEMA INTEIRO ---
  const handleDeleteSystem = async () => {
    if (!module) return;
    
    // Pergunta de segurança dupla
    const confirmText = prompt(`ATENÇÃO PERIGO:\nIsso apagará TODO o sistema "${module.name}", todas as tabelas e todos os dados inseridos.\n\nPara confirmar, digite "DELETAR" na caixa abaixo:`);
    
    if (confirmText !== "DELETAR") {
        if (confirmText !== null) toast.info("Exclusão cancelada.");
        return;
    }

    setLoading(true);
    try {
      // Deleta o módulo. Se o banco tiver "ON DELETE CASCADE", tabelas e registros somem junto.
      const { error } = await supabase
        .from('crud_modules')
        .delete()
        .eq('id', module.id);

      if (error) throw error;

      toast.success("Sistema excluído permanentemente.");
      navigate('/modulos'); // Redireciona para a lista de sistemas
    } catch (e: any) {
      console.error(e);
      toast.error("Erro ao excluir sistema: " + e.message);
      setLoading(false);
    }
  };

  if (loading && !module) return <div className="p-8 flex justify-center"><Loader2 className="animate-spin text-[#003B8F]" /></div>;

  return (
    <div className="space-y-6 pb-20 animate-in fade-in pt-8">
      <Button variant="ghost" onClick={() => navigate('/modulos')} className="pl-0 text-slate-500 hover:text-[#003B8F]">
        <ArrowLeft className="mr-2 h-4 w-4" /> Voltar
      </Button>

      {/* HEADER */}
      <div className="bg-gradient-to-r from-[#003B8F] to-[#0055CC] rounded-2xl p-8 text-white shadow-lg flex flex-col md:flex-row justify-between gap-6">
        <div>
          <div className="flex items-center gap-2 text-blue-200 text-sm font-medium uppercase mb-1">
             <span className="bg-white/20 px-2 py-0.5 rounded">Sistema</span> / <span>{activeTable?.name}</span>
          </div>
          <h1 className="text-3xl font-bold">{module?.name}</h1>
        </div>
        
        <div className="flex flex-wrap gap-2">
          {/* BOTÃO DE EXCLUIR SISTEMA (Apenas Admin) */}
          {role === 'administrador' && (
             <Button 
               onClick={handleDeleteSystem} 
               variant="destructive" 
               className="bg-red-600 hover:bg-red-700 text-white border-0 shadow-md"
             >
               <Trash2 className="mr-2 h-4 w-4" /> Excluir Sistema
             </Button>
          )}

          <Button onClick={handleExportClick} variant="outline" className="bg-white/10 text-white border-white/20 hover:bg-white/20">
            <FileDown className="mr-2 h-4 w-4" /> Exportar
          </Button>
          <input type="file" ref={fileInputRef} accept=".csv" className="hidden" onChange={handleFileSelect} />
          <Button onClick={() => fileInputRef.current?.click()} variant="outline" className="bg-white/10 text-white border-white/20 hover:bg-white/20">
            <FileUp className="mr-2 h-4 w-4" /> Importar CSV
          </Button>
          <Button onClick={() => { setFormData({}); setEditRecordId(null); setDialogOpen(true); }} className="bg-[#22C55E] hover:bg-green-500 text-white border-0 shadow-md">
            <Plus className="mr-2 h-4 w-4" /> Novo Registro
          </Button>
        </div>
      </div>

      {/* TABS DE TABELAS */}
      {tables.length > 1 && (
        <div className="flex gap-1 overflow-x-auto pb-1">
            {tables.map(t => (
                <button key={t.id} onClick={() => setActiveTable(t)}
                    className={`flex items-center gap-2 px-6 py-2.5 rounded-t-lg text-sm font-bold transition-all border-b-2 ${activeTable?.id === t.id ? 'bg-white text-[#003B8F] border-[#003B8F] shadow-sm' : 'bg-transparent text-slate-500 border-transparent hover:bg-white/50 hover:text-slate-700'}`}>
                    <TableIcon className="h-4 w-4" /> {t.name}
                </button>
            ))}
        </div>
      )}

      {/* TABELA DE DADOS E FILTROS */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden min-h-[400px]">
        <div className="p-4 border-b flex justify-between items-center bg-slate-50">
           <div className="relative max-w-sm w-full">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <Input placeholder={`Busca global...`} className="pl-10 bg-white" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
           </div>
           {Object.keys(columnFilters).length > 0 && (
             <Button variant="ghost" size="sm" onClick={() => setColumnFilters({})} className="text-red-500 hover:bg-red-50 h-8">
                <X className="mr-2 h-4 w-4"/> Limpar {Object.keys(columnFilters).length} Filtros
             </Button>
           )}
           <span className="text-sm text-slate-500 font-medium">{filteredRecords.length} registros</span>
        </div>
        
        <div className="overflow-x-auto">
          {fields.length === 0 ? (<div className="p-12 text-center text-slate-400">Sem campos definidos.</div>) : (
            <Table>
                <TableHeader>
                    <TableRow className="bg-slate-50 hover:bg-slate-50">
                        <TableHead className="w-[140px] font-bold text-[#003B8F]">
                            <ColumnFilter title="Status" fieldKey="status" allRecords={records} selectedValues={columnFilters['status']}
                                onChange={(vals: string[]) => {
                                    const newFilters = { ...columnFilters };
                                    if(vals.length > 0) newFilters['status'] = vals; else delete newFilters['status'];
                                    setColumnFilters(newFilters);
                                }}
                            />
                        </TableHead>
                        {fields.map(f => (
                            <TableHead key={f.id} className="min-w-[150px] font-bold text-slate-700">
                                <ColumnFilter title={f.label} fieldKey={f.name} allRecords={records} selectedValues={columnFilters[f.name]}
                                    onChange={(vals: string[]) => {
                                        const newFilters = { ...columnFilters };
                                        if(vals.length > 0) newFilters[f.name] = vals; else delete newFilters[f.name];
                                        setColumnFilters(newFilters);
                                    }}
                                />
                            </TableHead>
                        ))}
                        <TableHead className="text-right font-bold text-slate-700 sticky right-0 bg-slate-50">Ações</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                {filteredRecords.map((record) => (
                    <TableRow key={record.id} className="hover:bg-slate-50 group transition-colors">
                    <TableCell>
                        <Badge className={
                            record.status === 'approved' ? 'bg-green-100 text-green-700 hover:bg-green-200' : 
                            record.status === 'rejected' ? 'bg-red-100 text-red-700 hover:bg-red-200' : 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200'
                        }>
                            {record.status === 'approved' ? 'Aprovado' : record.status === 'rejected' ? 'Negado' : 'Análise'}
                        </Badge>
                    </TableCell>
                    {fields.map(f => {
                      const rawVal = record.data[f.name];
                      const foundOpt = f.options?.find((opt: any) => opt.value === rawVal);
                      const displayVal = foundOpt ? foundOpt.label : (rawVal || '-');

                      // AQUI A MUDANÇA: removemos 'truncate' e adicionamos 'whitespace-normal break-words'
                      return (
                        <TableCell key={f.id} className="max-w-[200px] whitespace-normal break-words text-sm text-slate-600">
                          {displayVal}
                        </TableCell>
                      );
                    })}
                    <TableCell className="text-right sticky right-0 bg-white group-hover:bg-slate-50 shadow-[-10px_0_10px_-10px_rgba(0,0,0,0.05)]">
                        <div className="flex justify-end gap-1 opacity-100">
                           <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-blue-50" onClick={() => { setFormData(record.data); setEditRecordId(record.id); setDialogOpen(true); }}><Pencil className="h-4 w-4 text-blue-600" /></Button>
                           <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-red-50" onClick={() => handleDelete(record.id)}><Trash2 className="h-4 w-4 text-red-400" /></Button>
                        </div>
                    </TableCell>
                    </TableRow>
                ))}
                {filteredRecords.length === 0 && (
                    <TableRow><TableCell colSpan={fields.length + 2} className="h-40 text-center text-slate-400">Nenhum registro encontrado.</TableCell></TableRow>
                )}
                </TableBody>
            </Table>
          )}
        </div>
      </div>

      {/* MODAL FORMULÁRIO */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editRecordId ? 'Editar' : 'Novo Registro'}</DialogTitle></DialogHeader>
          <form onSubmit={handleSave} className="space-y-4 pt-4">
             <div className="grid gap-4 md:grid-cols-2">
               {fields.map(f => (
                 <div key={f.id} className={f.field_type === 'textarea' ? 'col-span-2' : ''}>
                    <Label className="text-slate-700 font-medium">{f.label}</Label>
                    {f.field_type === 'textarea' ? <Textarea value={formData[f.name]||''} onChange={e=>setFormData({...formData, [f.name]:e.target.value})} className="mt-1" /> :
                     f.field_type === 'select' ? 
                      <Select value={formData[f.name] || ''} onValueChange={v => setFormData({ ...formData, [f.name]: v })}>
                        <SelectTrigger className="mt-1"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                        <SelectContent>{f.options?.map((opt: any, i: number) => <SelectItem key={i} value={opt.value}>{opt.label}</SelectItem>)}</SelectContent>
                      </Select> : <Input type={f.field_type} value={formData[f.name]||''} onChange={e=>setFormData({...formData, [f.name]:e.target.value})} className="mt-1" />}
                 </div>
               ))}
             </div>
             <Button type="submit" className="w-full bg-[#22C55E]" disabled={saving}>Salvar Registro</Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* MODAL EXPORTAR (CSV ou PDF) */}
      <Dialog open={exportModalOpen} onOpenChange={setExportModalOpen}>
        <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>Exportar Dados</DialogTitle><DialogDescription>Selecione as colunas e o formato.</DialogDescription></DialogHeader>
            <div className="py-4 space-y-2 max-h-[50vh] overflow-y-auto border rounded p-2">
                <div className="flex items-center space-x-2 p-2 bg-slate-100 rounded">
                    <Checkbox id="select-all" 
                        checked={exportSelectedFields.length === fields.length}
                        onCheckedChange={(c) => c ? setExportSelectedFields(fields.map(f => f.name)) : setExportSelectedFields([])} />
                    <label htmlFor="select-all" className="font-bold cursor-pointer">Todas as colunas</label>
                </div>
                {fields.map(f => (
                    <div key={f.id} className="flex items-center space-x-2 p-2 hover:bg-slate-50 rounded">
                        <Checkbox id={`exp-${f.id}`} checked={exportSelectedFields.includes(f.name)} 
                            onCheckedChange={(c) => {
                                if(c) setExportSelectedFields([...exportSelectedFields, f.name]);
                                else setExportSelectedFields(exportSelectedFields.filter(x => x !== f.name));
                            }} />
                        <label htmlFor={`exp-${f.id}`} className="text-sm cursor-pointer flex-1">{f.label}</label>
                    </div>
                ))}
            </div>
            <DialogFooter className="flex gap-2 sm:justify-end">
                <Button variant="outline" onClick={processExportCSV} className="flex-1 border-green-600 text-green-700 hover:bg-green-50">
                    <FileDown className="mr-2 h-4 w-4" /> CSV (Excel)
                </Button>
                <Button onClick={handleExportPDF} className="flex-1 bg-red-600 hover:bg-red-700 text-white">
                    <PdfIcon className="mr-2 h-4 w-4" /> Relatório PDF
                </Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL IMPORTAR */}
      <Dialog open={importModalOpen} onOpenChange={setImportModalOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col">
            <DialogHeader><DialogTitle>Importar CSV</DialogTitle><DialogDescription>Mapeie as colunas.</DialogDescription></DialogHeader>
            <div className="flex-1 overflow-y-auto py-4">
                <div className="grid grid-cols-2 gap-4 font-bold text-xs text-slate-500 mb-2 px-2 bg-slate-50 py-2 rounded">
                    <div>COLUNA CSV</div><div>CAMPO SISTEMA</div>
                </div>
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
            <DialogFooter><Button onClick={processImport} disabled={saving} className="w-full bg-[#22C55E]">{saving ? 'Importando...' : `Confirmar (${importCsvData?.rows.length} itens)`}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ColumnFilter({ title, fieldKey, allRecords, selectedValues = [], onChange }: any) {
    const options = useMemo(() => {
        const unique = new Set<string>();
        allRecords.forEach((r: any) => {
            let val = '';
            if (fieldKey === 'status') val = r.status === 'approved' ? 'Aprovado' : r.status === 'rejected' ? 'Negado' : 'Análise';
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
                    {isFiltered && <Badge variant="secondary" className="ml-1 rounded-sm px-1 font-normal bg-blue-100 text-blue-700 h-5">{selectedValues.length}</Badge>}
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[250px] p-0" align="start">
                <Command>
                    <CommandInput placeholder={`Buscar em ${title}...`} />
                    <CommandList>
                        <CommandEmpty>Nenhum resultado.</CommandEmpty>
                        <CommandGroup>
                            {options.map((option) => {
                                const isSelected = selectedValues.includes(option);
                                return (
                                    <CommandItem key={option} onSelect={() => onChange(isSelected ? selectedValues.filter((v:string) => v !== option) : [...selectedValues, option])}>
                                        <div className={cn("mr-2 flex h-4 w-4 items-center justify-center rounded-sm border border-primary", isSelected ? "bg-primary text-primary-foreground" : "opacity-50 [&_svg]:invisible")}>
                                            <Check className={cn("h-4 w-4")} />
                                        </div>
                                        <span className="truncate" title={option}>{option}</span>
                                    </CommandItem>
                                );
                            })}
                        </CommandGroup>
                        {selectedValues.length > 0 && (
                            <>
                                <CommandSeparator />
                                <CommandGroup>
                                    <CommandItem onSelect={() => onChange([])} className="justify-center text-center">Limpar Filtros</CommandItem>
                                </CommandGroup>
                            </>
                        )}
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    );
}