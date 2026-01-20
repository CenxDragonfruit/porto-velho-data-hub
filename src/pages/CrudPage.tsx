import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Layout } from '@/components/layout/Layout';
import { DynamicForm } from '@/components/crud/DynamicForm';
import { DataTable } from '@/components/crud/DataTable';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { CrudModule, CrudField, CrudRecord } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export default function CrudPage() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const [module, setModule] = useState<CrudModule | null>(null);
  const [fields, setFields] = useState<CrudField[]>([]);
  const [records, setRecords] = useState<CrudRecord[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editRecord, setEditRecord] = useState<CrudRecord | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => { if (slug) fetchData(); }, [slug]);

  const fetchData = async () => {
    const { data: mod } = await supabase.from('crud_modules').select('*').eq('slug', slug).single();
    if (!mod) { navigate('/modulos'); return; }
    setModule(mod as CrudModule);

    const [fieldsRes, recordsRes] = await Promise.all([
      supabase.from('crud_fields').select('*').eq('crud_module_id', mod.id).order('order_index'),
      supabase.from('crud_records').select('*').eq('crud_module_id', mod.id).order('created_at', { ascending: false }),
    ]);
    setFields((fieldsRes.data || []) as CrudField[]);
    setRecords((recordsRes.data || []) as CrudRecord[]);
  };

  const handleSubmit = async (data: Record<string, any>) => {
    setLoading(true);
    try {
      if (editRecord) {
        await supabase.from('crud_records').update({ data }).eq('id', editRecord.id);
        toast.success('Registro atualizado!');
      } else {
        await supabase.from('crud_records').insert({ crud_module_id: module!.id, data, created_by: user?.id });
        toast.success('Registro criado! Aguardando aprovação.');
      }
      setDialogOpen(false);
      setEditRecord(null);
      fetchData();
    } catch (e: any) { toast.error(e.message); }
    finally { setLoading(false); }
  };

  const handleDelete = async (id: string) => { await supabase.from('crud_records').delete().eq('id', id); toast.success('Excluído'); fetchData(); };
  const handleApprove = async (id: string) => { await supabase.from('crud_records').update({ status: 'approved', approved_by: user?.id }).eq('id', id); toast.success('Aprovado!'); fetchData(); };
  const handleReject = async (id: string, reason: string) => { await supabase.from('crud_records').update({ status: 'rejected', rejection_reason: reason, approved_by: user?.id }).eq('id', id); toast.success('Rejeitado'); fetchData(); };

  const exportCSV = () => {
    const headers = fields.map((f) => f.label).join(',');
    const rows = records.map((r) => fields.map((f) => r.data[f.name] || '').join(','));
    const csv = [headers, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `${module?.slug}.csv`; a.click();
  };

  const exportPDF = () => {
    const doc = new jsPDF();
    doc.text(module?.name || 'Relatório', 14, 15);
    autoTable(doc, { head: [fields.map((f) => f.label)], body: records.map((r) => fields.map((f) => String(r.data[f.name] || ''))), startY: 25 });
    doc.save(`${module?.slug}.pdf`);
  };

  const canApprove = profile?.role === 'admin' || profile?.role === 'supervisor';

  if (!module) return null;

  return (
    <Layout>
      <Button variant="ghost" onClick={() => navigate('/modulos')} className="mb-4"><ArrowLeft className="mr-2 h-4 w-4" />Voltar</Button>
      <div className="flex items-center justify-between mb-8">
        <div><h1 className="page-title">{module.name}</h1><p className="page-description">{module.description}</p></div>
        <Button onClick={() => { setEditRecord(null); setDialogOpen(true); }} className="btn-gradient-primary"><Plus className="mr-2 h-4 w-4" />Novo Registro</Button>
      </div>

      <Tabs defaultValue="todos" className="space-y-4">
        <TabsList><TabsTrigger value="todos">Todos</TabsTrigger><TabsTrigger value="pendentes">Pendentes</TabsTrigger><TabsTrigger value="aprovados">Aprovados</TabsTrigger></TabsList>
        <TabsContent value="todos"><DataTable records={records} fields={fields} onEdit={(r) => { setEditRecord(r); setDialogOpen(true); }} onDelete={handleDelete} onApprove={handleApprove} onReject={handleReject} onExportCSV={exportCSV} onExportPDF={exportPDF} canApprove={canApprove} /></TabsContent>
        <TabsContent value="pendentes"><DataTable records={records.filter((r) => r.status === 'pending')} fields={fields} onApprove={handleApprove} onReject={handleReject} canApprove={canApprove} /></TabsContent>
        <TabsContent value="aprovados"><DataTable records={records.filter((r) => r.status === 'approved')} fields={fields} onExportCSV={exportCSV} onExportPDF={exportPDF} showActions={false} /></TabsContent>
      </Tabs>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl"><DialogHeader><DialogTitle>{editRecord ? 'Editar' : 'Novo'} Registro</DialogTitle></DialogHeader><DynamicForm fields={fields} initialData={editRecord?.data || {}} onSubmit={handleSubmit} loading={loading} /></DialogContent>
      </Dialog>
    </Layout>
  );
}
