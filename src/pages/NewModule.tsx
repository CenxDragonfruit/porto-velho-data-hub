import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Layout } from '@/components/layout/Layout';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Plus, Trash2, Save, ArrowLeft, GripVertical } from 'lucide-react';
import { toast } from 'sonner';

const FIELD_TYPES = [
  { value: 'text', label: 'Texto' },
  { value: 'number', label: 'Número' },
  { value: 'date', label: 'Data' },
  { value: 'email', label: 'E-mail' },
  { value: 'phone', label: 'Telefone' },
  { value: 'cpf', label: 'CPF' },
  { value: 'cnpj', label: 'CNPJ' },
  { value: 'currency', label: 'Moeda' },
  { value: 'textarea', label: 'Texto Longo' },
  { value: 'select', label: 'Seleção' },
];

interface FieldDef {
  id: string; name: string; label: string; field_type: string; is_required: boolean; options: { value: string; label: string }[];
}

export default function NewModule() {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [fields, setFields] = useState<FieldDef[]>([]);
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();
  const navigate = useNavigate();

  const addField = () => {
    setFields([...fields, { id: crypto.randomUUID(), name: '', label: '', field_type: 'text', is_required: false, options: [] }]);
  };

  const updateField = (id: string, updates: Partial<FieldDef>) => {
    setFields(fields.map((f) => (f.id === id ? { ...f, ...updates } : f)));
  };

  const removeField = (id: string) => setFields(fields.filter((f) => f.id !== id));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || fields.length === 0) {
      toast.error('Preencha o nome e adicione ao menos um campo');
      return;
    }
    setLoading(true);
    try {
      const slug = name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
      const { data: module, error } = await supabase.from('crud_modules').insert({ name, description, slug, created_by: user?.id }).select().single();
      if (error) throw error;

      const fieldsToInsert = fields.map((f, i) => ({
        crud_module_id: module.id, name: f.name || f.label.toLowerCase().replace(/\s+/g, '_'), label: f.label, field_type: f.field_type, is_required: f.is_required, options: f.options.length > 0 ? f.options : null, order_index: i,
      }));
      await supabase.from('crud_fields').insert(fieldsToInsert);
      toast.success('Módulo criado com sucesso!');
      navigate('/modulos');
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout>
      <Button variant="ghost" onClick={() => navigate('/modulos')} className="mb-4"><ArrowLeft className="mr-2 h-4 w-4" />Voltar</Button>
      <div className="page-header"><h1 className="page-title">Novo Módulo CRUD</h1><p className="page-description">Configure os campos do formulário</p></div>

      <form onSubmit={handleSubmit} className="space-y-8">
        <div className="form-section space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div><Label className="input-label">Nome do Módulo *</Label><Input value={name} onChange={(e) => setName(e.target.value)} required /></div>
            <div><Label className="input-label">Descrição</Label><Input value={description} onChange={(e) => setDescription(e.target.value)} /></div>
          </div>
        </div>

        <div className="form-section">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-semibold">Campos do Formulário</h3>
            <Button type="button" variant="outline" onClick={addField}><Plus className="mr-2 h-4 w-4" />Adicionar Campo</Button>
          </div>

          <div className="space-y-4">
            {fields.map((field, index) => (
              <motion.div key={field.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-4 border rounded-lg bg-muted/20 space-y-4">
                <div className="grid gap-4 md:grid-cols-4">
                  <div><Label className="text-xs">Rótulo *</Label><Input value={field.label} onChange={(e) => updateField(field.id, { label: e.target.value })} required /></div>
                  <div><Label className="text-xs">Nome do Campo</Label><Input value={field.name} onChange={(e) => updateField(field.id, { name: e.target.value })} placeholder={field.label?.toLowerCase().replace(/\s+/g, '_')} /></div>
                  <div><Label className="text-xs">Tipo</Label>
                    <Select value={field.field_type} onValueChange={(v) => updateField(field.id, { field_type: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent className="bg-popover">{FIELD_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-end gap-4">
                    <div className="flex items-center gap-2"><Switch checked={field.is_required} onCheckedChange={(c) => updateField(field.id, { is_required: c })} /><span className="text-sm">Obrigatório</span></div>
                    <Button type="button" variant="ghost" size="icon" onClick={() => removeField(field.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </div>
                </div>
              </motion.div>
            ))}
            {fields.length === 0 && <div className="text-center py-8 text-muted-foreground">Adicione campos ao formulário</div>}
          </div>
        </div>

        <div className="flex justify-end"><Button type="submit" className="btn-gradient-primary" disabled={loading}><Save className="mr-2 h-4 w-4" />{loading ? 'Salvando...' : 'Criar Módulo'}</Button></div>
      </form>
    </Layout>
  );
}
