import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, PackageCheck, FileText, FileSpreadsheet, AlertTriangle, ShieldAlert, ChevronUp, ChevronDown } from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

// Tipagem para os Lotes
type BatchGroup = {
  batchId: string;
  records: any[];
  moduleName: string;
  tableName: string;
  date: string;
};

const chunkArray = <T,>(array: T[], size: number): T[][] => {
  const result = [];
  for (let i = 0; i < array.length; i += size) {
    result.push(array.slice(i, i + size));
  }
  return result;
};

export default function Approvals() {
  const { user, role } = useAuth();
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  
  const [singles, setSingles] = useState<any[]>([]);
  const [batches, setBatches] = useState<BatchGroup[]>([]);
  
  const [rejectData, setRejectData] = useState<{ ids: number[], type: 'single' | 'batch' } | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const canApprove = role === 'ADMINISTRADOR' || role === 'SUPERVISOR';

  useEffect(() => { fetchPending(); }, []);

  const fetchPending = async () => {
    setLoading(true);
    try {
      // CORREÇÃO: Apontando para as tabelas do novo esquema (Gold Version)
      // Tabelas: versoes_registro -> registros_mestre -> modulos
      const { data, error } = await supabase
        .from('versoes_registro') 
        .select(`
            id,
            conteudo, 
            status,
            criado_em,
            is_atual,
            registros_mestre!inner (
                modulos ( nome )
            )
        `)
        .eq('status', 'PENDENTE') 
        .eq('is_atual', true)
        .order('criado_em', { ascending: false });

      if (error) throw error;
      
      console.log("Aprovações carregadas:", data); // Log para debug
      if (data) organizeData(data);
    } catch (e: any) {
        console.error("Erro ao buscar aprovações:", e);
        // Ignora erro 406/PGRST (formato) ou vazios, alerta apenas erros reais
        if (e.code !== 'PGRST205' && e.code !== '406') {
            toast.error("Erro ao carregar aprovações.");
        }
    } finally {
        setLoading(false);
    }
  };

  const organizeData = (records: any[]) => {
    const singleList: any[] = [];
    const batchMap: Record<string, any[]> = {};

    records.forEach((r: any) => {
      // O dado JSON está na coluna 'conteudo'
      const content = r.conteudo || {};
      const batchId = content._batch_id; 
      
      let moduleName = 'Sistema';
      // Tratamento seguro para extrair nome do módulo do relacionamento
      const mestre = Array.isArray(r.registros_mestre) ? r.registros_mestre[0] : r.registros_mestre;
      if (mestre?.modulos?.nome) {
          moduleName = mestre.modulos.nome;
      }

      const flatRecord = {
          id: r.id,
          date: r.criado_em,
          moduleName: moduleName,
          data: content
      };

      if (batchId) {
        if (!batchMap[batchId]) batchMap[batchId] = [];
        batchMap[batchId].push(flatRecord);
      } else {
        singleList.push(flatRecord);
      }
    });

    const batchList: BatchGroup[] = Object.entries(batchMap).map(([bId, recs]) => ({
      batchId: bId,
      records: recs,
      moduleName: recs[0].moduleName,
      tableName: recs[0].moduleName,
      date: recs[0].date
    }));

    setSingles(singleList);
    setBatches(batchList);
  };

  const handleApprove = async (ids: number[]) => {
    if (!canApprove) return toast.error("Sem permissão.");
    if (ids.length === 0) return;
    
    setProcessing(true);
    const chunks = chunkArray(ids, 50);
    let successCount = 0;
    
    const toastId = toast.loading(`Aprovando...`);

    try {
      for (const chunk of chunks) {
        const { error } = await supabase
            .from('versoes_registro')
            .update({ 
                status: 'OFICIAL', 
                avaliado_por_id: user?.id, // ID numérico do usuário logado
                data_avaliacao: new Date().toISOString()
            })
            .in('id', chunk);

        if (error) throw error;
        successCount += chunk.length;
      }
      toast.success(`${successCount} registros aprovados!`, { id: toastId });
      fetchPending(); 
    } catch (e: any) { 
        console.error(e);
        toast.error("Erro: " + e.message, { id: toastId }); 
    } finally { 
        setProcessing(false); 
    }
  };

  const handleRejectConfirm = async () => {
    if (!canApprove || !rejectData || !rejectReason.trim()) return;
    
    setProcessing(true);
    const toastId = toast.loading("Rejeitando...");

    try {
        const chunks = chunkArray(rejectData.ids, 50);
        
        for (const chunk of chunks) {
            const { error } = await supabase
                .from('versoes_registro')
                .update({ 
                    status: 'REJEITADO',
                    avaliado_por_id: user?.id,
                    data_avaliacao: new Date().toISOString()
                    // Nota: Se quiser salvar o motivo, precisaria de uma coluna 'motivo_rejeicao' no banco
                    // ou salvar no histórico de aprovação. Por enquanto apenas muda status.
                })
                .in('id', chunk);
            
            if (error) throw error;
        }

        toast.success("Registros rejeitados.", { id: toastId });
        setRejectData(null);
        setRejectReason('');
        fetchPending();
    } catch (e: any) { 
        toast.error("Erro: " + e.message, { id: toastId }); 
    } finally { 
        setProcessing(false); 
    }
  };

  if (loading) return <div className="p-10 flex justify-center"><Loader2 className="animate-spin text-[#003B8F] h-8 w-8" /></div>;

  return (
    <div className="space-y-6 pb-20 animate-in fade-in pt-6 max-w-7xl mx-auto px-4">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-[#003B8F] flex items-center gap-2">
             <PackageCheck className="h-8 w-8"/> Central de Aprovações
          </h1>
          <p className="text-slate-500 mt-1">Valide os dados inseridos antes que se tornem oficiais.</p>
        </div>
        {!canApprove && (
            <div className="bg-amber-50 border border-amber-200 text-amber-800 px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-medium">
                <ShieldAlert className="h-4 w-4"/> Modo Visualização
            </div>
        )}
      </div>

      <Tabs defaultValue="manual" className="w-full">
        <TabsList className="grid w-full grid-cols-2 lg:w-[400px]">
            <TabsTrigger value="manual" className="flex items-center gap-2"><FileText className="h-4 w-4"/> Inserção Manual {singles.length > 0 && <Badge variant="secondary" className="ml-1 bg-blue-100 text-blue-700">{singles.length}</Badge>}</TabsTrigger>
            <TabsTrigger value="import" className="flex items-center gap-2"><FileSpreadsheet className="h-4 w-4"/> Importação CSV {batches.length > 0 && <Badge variant="secondary" className="ml-1 bg-purple-100 text-purple-700">{batches.length}</Badge>}</TabsTrigger>
        </TabsList>

        <TabsContent value="manual" className="mt-6 space-y-4">
            {singles.length === 0 ? <EmptyState message="Nenhum registro pendente." icon={FileText} /> : 
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {singles.map(record => <SingleCard key={record.id} record={record} onApprove={() => handleApprove([record.id])} onReject={() => setRejectData({ ids: [record.id], type: 'single' })} disabled={processing || !canApprove} />)}
                </div>
            }
        </TabsContent>

        <TabsContent value="import" className="mt-6 space-y-6">
            {batches.length === 0 ? <EmptyState message="Nenhum lote pendente." icon={FileSpreadsheet} /> : 
                <div className="grid gap-6">
                    {batches.map((batch) => <BatchCard key={batch.batchId} batch={batch} onApprove={() => handleApprove(batch.records.map(r => r.id))} onReject={() => setRejectData({ ids: batch.records.map(r => r.id), type: 'batch' })} disabled={processing || !canApprove} />)}
                </div>
            }
        </TabsContent>
      </Tabs>

      <Dialog open={!!rejectData} onOpenChange={(open) => !open && setRejectData(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle className="text-red-600 flex items-center gap-2"><AlertTriangle className="h-5 w-5"/> Rejeitar</DialogTitle><DialogDescription>Motivo da rejeição (obrigatório).</DialogDescription></DialogHeader>
          <div className="py-2"><Textarea value={rejectReason} onChange={e => setRejectReason(e.target.value)} placeholder="Ex: Dados incorretos..." className="min-h-[100px]" /></div>
          <DialogFooter><Button variant="ghost" onClick={() => setRejectData(null)}>Cancelar</Button><Button variant="destructive" onClick={handleRejectConfirm} disabled={!rejectReason.trim() || processing}>{processing ? <Loader2 className="h-4 w-4 animate-spin"/> : 'Confirmar'}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// --- COMPONENTES AUXILIARES ---
function EmptyState({ message, icon: Icon }: any) {
    return (<div className="flex flex-col items-center justify-center py-16 text-slate-400 bg-slate-50/50 rounded-xl border border-dashed border-slate-200"><div className="p-3 bg-white rounded-full shadow-sm mb-3"><Icon className="h-8 w-8 text-slate-300"/></div><p className="text-sm font-medium">{message}</p></div>);
}

function BatchCard({ batch, onApprove, onReject, disabled }: any) {
  const [isOpen, setIsOpen] = useState(false);
  const count = batch.records.length;
  return (
    <Card className="border border-slate-200 shadow-sm bg-white overflow-hidden">
      <div className="flex flex-col md:flex-row justify-between p-5 gap-4">
          <div className="flex gap-4">
              <div className="p-3 bg-purple-50 text-purple-600 rounded-xl h-fit"><FileSpreadsheet className="h-6 w-6" /></div>
              <div>
                  <div className="flex items-center gap-2 mb-1"><Badge variant="secondary">Lote CSV</Badge><span className="text-xs text-slate-400 font-mono">{new Date(batch.date).toLocaleDateString()}</span></div>
                  <h3 className="text-lg font-bold text-slate-900">{batch.moduleName}</h3>
                  <p className="text-sm text-slate-500"><strong>{count} registros</strong></p>
              </div>
          </div>
          <div className="flex items-center gap-2"><Button variant="outline" className="text-red-600 hover:bg-red-50" onClick={onReject} disabled={disabled}>Rejeitar</Button><Button className="bg-green-600 hover:bg-green-700 text-white" onClick={onApprove} disabled={disabled}>Aprovar Tudo</Button></div>
      </div>
      <Collapsible open={isOpen} onOpenChange={setIsOpen} className="border-t border-slate-100">
        <div className="w-full flex justify-center -mt-3 mb-2 relative z-10"><CollapsibleTrigger asChild><Button variant="outline" size="sm" className="h-6 text-[10px] rounded-full bg-white border-slate-200 text-slate-500">{isOpen ? <ChevronUp className="h-3 w-3 mr-1" /> : <ChevronDown className="h-3 w-3 mr-1" />}{isOpen ? 'Ocultar' : 'Ver Detalhes'}</Button></CollapsibleTrigger></div>
        <CollapsibleContent>
          <div className="px-5 pb-5 pt-1 bg-slate-50/30">
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {batch.records.slice(0, 6).map((rec: any) => (
                <div key={rec.id} className="text-xs bg-white p-3 border border-slate-200 rounded-lg shadow-sm">
                   {Object.entries(rec.data).filter(([k]) => k !== '_batch_id').slice(0, 3).map(([k, v]) => (
                      <div key={k} className="flex justify-between py-1 border-b border-dashed border-slate-100 last:border-0"><span className="text-slate-500 font-bold uppercase truncate w-1/3">{k}</span><span className="text-slate-800 truncate w-2/3 text-right">{String(v)}</span></div>
                   ))}
                </div>
              ))}
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}

function SingleCard({ record, onApprove, onReject, disabled }: any) {
  const dataEntries = Object.entries(record.data).filter(([k]) => k !== '_batch_id');
  const titleEntry = dataEntries.find(([k]) => /nome|titulo/i.test(k)) || dataEntries[0];
  const title = titleEntry ? String(titleEntry[1]) : `Registro #${record.id}`;
  return (
    <Card className="border border-slate-200 shadow-sm flex flex-col h-full bg-white group hover:border-blue-300 transition-all">
      <CardHeader className="p-4 pb-2">
         <div className="flex justify-between items-start mb-2"><Badge variant="outline" className="text-[10px] bg-slate-50">{record.moduleName}</Badge><span className="text-xs text-slate-300 font-mono">{new Date(record.date).toLocaleDateString()}</span></div>
         <CardTitle className="text-sm font-bold text-slate-800 line-clamp-2" title={title}>{title}</CardTitle>
      </CardHeader>
      <CardContent className="p-4 pt-2 flex-1">
         <div className="space-y-1 bg-slate-50 p-2 rounded border border-slate-100">
             {dataEntries.slice(0, 3).map(([k, v]) => (<div key={k} className="flex justify-between text-xs"><span className="text-slate-400 font-bold uppercase truncate max-w-[80px]">{k}</span><span className="text-slate-600 truncate max-w-[120px]">{String(v)}</span></div>))}
         </div>
      </CardContent>
      <CardFooter className="p-3 pt-0 grid grid-cols-2 gap-2"><Button variant="outline" size="sm" className="w-full text-red-600 hover:bg-red-50 h-8 text-xs" onClick={onReject} disabled={disabled}>Rejeitar</Button><Button size="sm" className="w-full bg-green-600 hover:bg-green-700 text-white h-8 text-xs" onClick={onApprove} disabled={disabled}>Aprovar</Button></CardFooter>
    </Card>
  );
}