import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ChevronDown, ChevronUp, Loader2, PackageCheck, FileText, FileSpreadsheet } from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

type BatchGroup = {
  batchId: string;
  records: any[];
  moduleName: string;
  tableName: string;
  date: string;
};

// Função auxiliar para dividir array em pedaços (chunks)
const chunkArray = <T,>(array: T[], size: number): T[][] => {
  const result = [];
  for (let i = 0; i < array.length; i += size) {
    result.push(array.slice(i, i + size));
  }
  return result;
};

export default function Approvals() {
  const { user, checkPermission } = useAuth();
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [singles, setSingles] = useState<any[]>([]);
  const [batches, setBatches] = useState<BatchGroup[]>([]);
  const [rejectData, setRejectData] = useState<{ ids: string[], type: 'single' | 'batch' } | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  // PERMISSÃO: Verifica se o usuário pode aprovar
  const canApprove = checkPermission('approve_data');

  useEffect(() => { fetchPending(); }, []);

  const fetchPending = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('crud_records')
      .select(`*, crud_tables (name, crud_modules (name))`)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    if (error) toast.error("Erro ao carregar aprovações.");
    else if (data) organizeData(data);
    setLoading(false);
  };

  const organizeData = (records: any[]) => {
    const singleList: any[] = [];
    const batchMap: Record<string, any[]> = {};
    records.forEach(r => {
      const batchId = r.data?._batch_id; 
      if (batchId) {
        if (!batchMap[batchId]) batchMap[batchId] = [];
        batchMap[batchId].push(r);
      } else {
        singleList.push(r);
      }
    });
    const batchList: BatchGroup[] = Object.entries(batchMap).map(([bId, recs]) => ({
      batchId: bId,
      records: recs,
      moduleName: recs[0]?.crud_tables?.crud_modules?.name || 'Sistema',
      tableName: recs[0]?.crud_tables?.name || 'Tabela',
      date: recs[0]?.created_at
    }));
    setSingles(singleList);
    setBatches(batchList);
  };

  // --- CORREÇÃO PRINCIPAL: Processamento em Chunks ---
  const handleApprove = async (ids: string[]) => {
    if (ids.length === 0) return;
    setProcessing(true);
    
    // Divide os IDs em lotes de 50 para evitar timeout ou payload excessivo
    const chunks = chunkArray(ids, 50);
    let successCount = 0;
    let errorCount = 0;

    const toastId = toast.loading(`Iniciando aprovação de ${ids.length} registros...`);

    try {
      for (const [index, chunk] of chunks.entries()) {
        // Atualiza o toast para dar feedback visual
        toast.loading(`Processando lote ${index + 1} de ${chunks.length}...`, { id: toastId });

        const { error } = await supabase
            .from('crud_records')
            .update({ 
                status: 'approved', 
                approved_by: user?.id, 
                updated_at: new Date().toISOString() 
            })
            .in('id', chunk); // Atualiza apenas os 50 deste lote

        if (error) {
            console.error("Erro no lote:", error);
            errorCount += chunk.length;
        } else {
            successCount += chunk.length;
        }
      }

      if (errorCount > 0) {
        toast.warning(`${successCount} aprovados, mas ${errorCount} falharam. Verifique os logs ou triggers do banco.`, { id: toastId });
      } else {
        toast.success(`${successCount} registros aprovados com sucesso!`, { id: toastId });
      }

      fetchPending(); 
    } catch (e: any) { 
        toast.error("Erro crítico ao aprovar: " + e.message, { id: toastId }); 
    } finally { 
        setProcessing(false); 
    }
  };

  const handleRejectConfirm = async () => {
    if (!rejectReason.trim() || !rejectData) return;
    setProcessing(true);
    const toastId = toast.loading("Rejeitando registros...");

    try {
        // Também aplicamos chunking na rejeição por segurança
        const chunks = chunkArray(rejectData.ids, 50);
        let errorOccurred = false;

        for (const chunk of chunks) {
            const { error } = await supabase
                .from('crud_records')
                .update({ 
                    status: 'rejected', 
                    rejection_reason: rejectReason, 
                    approved_by: user?.id, 
                    updated_at: new Date().toISOString() 
                })
                .in('id', chunk);
            
            if (error) {
                errorOccurred = true;
                console.error(error);
            }
        }

        if (errorOccurred) {
             toast.error("Alguns registros não puderam ser rejeitados.", { id: toastId });
        } else {
             toast.success("Solicitação rejeitada.", { id: toastId });
        }

        setRejectData(null);
        setRejectReason('');
        fetchPending();
    } catch (e: any) { 
        toast.error("Erro ao rejeitar: " + e.message, { id: toastId }); 
    } finally { 
        setProcessing(false); 
    }
  };

  if (loading) return <div className="p-10 flex justify-center"><Loader2 className="animate-spin text-[#003B8F] h-8 w-8" /></div>;

  if (batches.length === 0 && singles.length === 0) return (
    <div className="flex flex-col items-center justify-center py-24 text-slate-400 bg-slate-50/50 rounded-xl border border-dashed border-slate-200 mx-4 mt-8">
      <PackageCheck className="h-12 w-12 mb-4 text-green-500 bg-green-50 p-2 rounded-full"/>
      <h3 className="text-lg font-semibold text-slate-700">Tudo limpo!</h3>
      <p className="text-sm">Nenhuma aprovação pendente no momento.</p>
    </div>
  );

  return (
    <div className="space-y-10 pb-20 animate-in fade-in pt-6">
      {!canApprove && (
          <div className="bg-yellow-50 border border-yellow-200 p-3 rounded-lg text-yellow-800 text-sm mb-4 flex items-center gap-2">
              <FileText className="h-4 w-4" /> Modo de visualização. Você não tem permissão para aprovar registros.
          </div>
      )}

      {batches.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 px-1 mb-2">
             <div className="h-8 w-8 rounded-full bg-purple-50 flex items-center justify-center text-purple-600"><FileSpreadsheet className="h-4 w-4"/></div>
             <div><h2 className="text-lg font-bold text-slate-800">Lotes CSV</h2><p className="text-xs text-slate-500">Aprovação em massa</p></div>
          </div>
          <div className="grid gap-6">
            {batches.map((batch) => (
              <BatchCard 
                key={batch.batchId} 
                batch={batch} 
                onApprove={() => handleApprove(batch.records.map(r => r.id))} 
                onReject={() => setRejectData({ ids: batch.records.map(r => r.id), type: 'batch' })} 
                disabled={processing || !canApprove} 
              />
            ))}
          </div>
        </div>
      )}

      {batches.length > 0 && singles.length > 0 && <div className="border-t border-slate-100" />}

      {singles.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 px-1 mb-2">
             <div className="h-8 w-8 rounded-full bg-yellow-50 flex items-center justify-center text-yellow-600"><FileText className="h-4 w-4"/></div>
             <div><h2 className="text-lg font-bold text-slate-800">Individuais</h2><p className="text-xs text-slate-500">Validação unitária</p></div>
          </div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {singles.map(record => (
              <SingleCard 
                key={record.id} 
                record={record} 
                onApprove={() => handleApprove([record.id])} 
                onReject={() => setRejectData({ ids: [record.id], type: 'single' })} 
                disabled={processing || !canApprove} 
              />
            ))}
          </div>
        </div>
      )}

      <Dialog open={!!rejectData} onOpenChange={(open) => !open && setRejectData(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle className="text-red-600">Confirmar Rejeição</DialogTitle><DialogDescription>Informe o motivo para rejeitar este(s) item(ns).</DialogDescription></DialogHeader>
          <div className="py-2"><Textarea value={rejectReason} onChange={e => setRejectReason(e.target.value)} placeholder="Motivo da rejeição..." className="min-h-[100px] border-slate-200 focus-visible:ring-red-500"/></div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRejectData(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={handleRejectConfirm} disabled={!rejectReason.trim() || processing}>{processing ? <Loader2 className="h-4 w-4 animate-spin"/> : 'Confirmar Rejeição'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Os componentes BatchCard e SingleCard permanecem iguais,
// apenas certifique-se de que estão no arquivo.
function BatchCard({ batch, onApprove, onReject, disabled }: any) {
  const [isOpen, setIsOpen] = useState(false);
  const count = batch.records.length;

  return (
    <Card className="border border-slate-200 shadow-sm bg-white overflow-hidden hover:shadow-md transition-all">
      <div className="flex flex-col md:flex-row justify-between p-5 gap-4">
          <div className="flex gap-4">
             <div className="p-3 bg-purple-50 text-purple-600 rounded-xl h-fit"><FileSpreadsheet className="h-6 w-6" /></div>
             <div>
                <div className="flex items-center gap-2 mb-1">
                   <Badge variant="secondary" className="bg-slate-100 text-slate-600 font-normal hover:bg-slate-200">Importação CSV</Badge>
                   <span className="text-xs text-slate-400 font-mono">{new Date(batch.date).toLocaleDateString()}</span>
                </div>
                <h3 className="text-lg font-bold text-slate-900">{batch.moduleName}</h3>
                <p className="text-sm text-slate-500">Tabela: <span className="font-medium text-slate-700">{batch.tableName}</span> • {count} registros</p>
             </div>
          </div>
          <div className="flex items-center gap-2 self-start md:self-center">
             <Button variant="ghost" className="text-red-600 hover:text-red-700 hover:bg-red-50" onClick={onReject} disabled={disabled}>Rejeitar</Button>
             <Button className="bg-green-600 hover:bg-green-700 text-white shadow-sm" onClick={onApprove} disabled={disabled}>Aprovar Tudo</Button>
          </div>
      </div>
      
      <Collapsible open={isOpen} onOpenChange={setIsOpen} className="border-t border-slate-100">
        <div className="w-full flex justify-center -mt-3 mb-2 relative z-10">
             <CollapsibleTrigger asChild>
                <Button variant="outline" size="sm" className="h-6 text-[10px] rounded-full bg-white border-slate-200 text-slate-500 shadow-sm hover:text-purple-600">
                    {isOpen ? <ChevronUp className="h-3 w-3 mr-1" /> : <ChevronDown className="h-3 w-3 mr-1" />}
                    {isOpen ? 'Ocultar' : 'Ver Detalhes'}
                </Button>
             </CollapsibleTrigger>
        </div>
        <CollapsibleContent>
          <div className="px-5 pb-5 pt-1 bg-slate-50/30">
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {batch.records.map((rec: any) => (
                <div key={rec.id} className="text-xs bg-white p-3 border border-slate-200 rounded-lg shadow-sm">
                   {Object.entries(rec.data).filter(([k]) => k !== '_batch_id').slice(0, 4).map(([k, v]) => (
                      <div key={k} className="flex justify-between py-1 border-b border-dashed border-slate-100 last:border-0">
                          <span className="text-slate-500 uppercase text-[9px] font-semibold">{k}</span>
                          <span className="text-slate-800 font-medium truncate max-w-[60%] text-right">{String(v)}</span>
                      </div>
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
  const titleEntry = dataEntries.find(([k]) => /nome|titulo|assunto/i.test(k)) || dataEntries[0];
  const title = titleEntry ? String(titleEntry[1]) : `Registro #${record.id.slice(0,4)}`;
  
  return (
    <Card className="border border-slate-200 shadow-sm hover:shadow-md transition-all flex flex-col h-full bg-white">
      <CardHeader className="p-4 pb-2">
         <div className="flex justify-between items-start mb-2">
            <Badge variant="outline" className="text-[10px] font-normal text-slate-500 bg-slate-50">{record.crud_tables?.name}</Badge>
            <span className="text-xs text-slate-300 font-mono">{new Date(record.created_at).toLocaleDateString()}</span>
         </div>
         <CardTitle className="text-sm font-bold text-slate-800 leading-snug line-clamp-2" title={title}>{title}</CardTitle>
      </CardHeader>
      <CardContent className="p-4 pt-2 flex-1">
         <div className="space-y-2 bg-slate-50/50 p-3 rounded-lg border border-slate-100">
             {dataEntries.slice(0, 3).map(([k, v]) => (
               <div key={k} className="flex flex-col">
                 <span className="text-[9px] uppercase font-bold text-slate-400">{k}</span>
                 <span className="text-xs text-slate-700 truncate">{String(v)}</span>
               </div>
             ))}
         </div>
      </CardContent>
      <CardFooter className="p-3 pt-0 grid grid-cols-2 gap-2">
         <Button variant="outline" size="sm" className="w-full text-red-600 border-slate-200 hover:bg-red-50 hover:border-red-200 h-8 text-xs" onClick={onReject} disabled={disabled}>Rejeitar</Button>
         <Button size="sm" className="w-full bg-green-600 hover:bg-green-700 text-white h-8 text-xs shadow-sm" onClick={onApprove} disabled={disabled}>Aprovar</Button>
      </CardFooter>
    </Card>
  );
}