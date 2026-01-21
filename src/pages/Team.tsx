import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth, UserRole } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { 
  UserPlus, Mail, FileText, Loader2, Trash2, User, Search, Pencil, 
  Link as LinkIcon, FileDown, FileUp, CheckSquare, X 
} from 'lucide-react';
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';

export default function Team() {
  const { role, user: currentUser } = useAuth();
  const [users, setUsers] = useState<any[]>([]);
  const [modules, setModules] = useState<any[]>([]); // Lista de sistemas disponíveis
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Seleção em Massa
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  
  // Modais
  const [isLinkModalOpen, setIsLinkModalOpen] = useState(false);
  const [selectedModulesToLink, setSelectedModulesToLink] = useState<string[]>([]);
  
  // Form Cadastro Manual
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [cpf, setCpf] = useState('');
  const [newRole, setNewRole] = useState<UserRole>('funcionario');

  // Edição
  const [editingUser, setEditingUser] = useState<any>(null);
  const [editName, setEditName] = useState('');
  const [editCpf, setEditCpf] = useState('');
  const [editRole, setEditRole] = useState<UserRole>('funcionario');

  // Importação CSV
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { 
    fetchData(); 
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      // 1. Busca Usuários
      const { data: userData, error: userError } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });
      if (userError) throw userError;
      setUsers(userData || []);

      // 2. Busca Módulos (para o modal de vínculo)
      const { data: modData } = await supabase
        .from('crud_modules')
        .select('id, name')
        .eq('is_active', true);
      setModules(modData || []);

    } catch (e: any) { 
      toast.error("Erro ao carregar dados."); 
    } finally { 
      setLoading(false); 
    }
  };

  // --- SELEÇÃO EM MASSA ---
  const toggleSelectAll = (checked: boolean) => {
    if (checked) setSelectedUserIds(filteredUsers.map(u => u.id));
    else setSelectedUserIds([]);
  };

  const toggleSelectUser = (id: string, checked: boolean) => {
    if (checked) setSelectedUserIds(prev => [...prev, id]);
    else setSelectedUserIds(prev => prev.filter(uid => uid !== id));
  };

  // --- VINCULAR MÓDULOS ---
  const handleLinkModules = async () => {
    if (selectedUserIds.length === 0 || selectedModulesToLink.length === 0) return;
    setSaving(true);
    try {
      const payload: any[] = [];
      
      selectedUserIds.forEach(userId => {
        selectedModulesToLink.forEach(modId => {
          payload.push({ profile_id: userId, crud_module_id: modId });
        });
      });

      // Usa upsert com ignoreDuplicates para não dar erro se já existir
      const { error } = await supabase.from('profile_modules').upsert(payload, { onConflict: 'profile_id,crud_module_id', ignoreDuplicates: true });
      
      if (error) throw error;
      toast.success(`${payload.length} vínculos processados!`);
      setIsLinkModalOpen(false);
      setSelectedUserIds([]);
      setSelectedModulesToLink([]);
    } catch (e: any) {
      toast.error("Erro ao vincular: " + e.message);
    } finally {
      setSaving(false);
    }
  };

  // --- EXPORTAR CSV ---
  const handleExport = () => {
    const headers = ['Nome Completo', 'Email', 'CPF', 'Perfil', 'Status'];
    const rows = users.map(u => [
      u.full_name,
      u.email,
      u.cpf || '',
      u.role,
      u.user_id ? 'Ativo' : 'Pendente'
    ]);

    const csvContent = "\uFEFF" + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([csvContent], { type: 'text/csv;charset=utf-8;' }));
    link.download = `Equipe_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link); link.click(); document.body.removeChild(link);
  };

  // --- IMPORTAR CSV ---
  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const text = event.target?.result as string;
      const lines = text.split(/\r\n|\n/).filter(line => line.trim() !== '');
      // Remove header se existir (assumindo que a primeira linha tem "email" ou "nome")
      const dataLines = lines[0].toLowerCase().includes('email') ? lines.slice(1) : lines;

      if (dataLines.length === 0) return toast.error("Arquivo vazio.");

      setSaving(true);
      let successCount = 0;
      let errorCount = 0;

      // Formato esperado: Nome, Email, CPF, Perfil
      for (const line of dataLines) {
        const cols = line.split(',');
        if (cols.length < 2) continue; // Pula linhas inválidas

        const [impName, impEmail, impCpf, impRole] = cols.map(c => c.trim().replace(/^"|"$/g, ''));
        
        // Validação básica do perfil
        const validRole = ['administrador', 'supervisor', 'funcionario', 'consulta'].includes(impRole?.toLowerCase()) 
          ? impRole.toLowerCase() 
          : 'funcionario';

        try {
          const { error } = await supabase.from('profiles').insert({
            full_name: impName,
            email: impEmail,
            cpf: impCpf,
            role: validRole
          });
          if (!error) successCount++;
          else errorCount++;
        } catch (err) { errorCount++; }
      }

      toast.success(`Importação: ${successCount} criados, ${errorCount} erros/duplicados.`);
      setSaving(false);
      fetchData();
    };
    reader.readAsText(file);
    if(fileInputRef.current) fileInputRef.current.value = '';
  };

  // --- CADASTRO MANUAL, DELETAR E EDITAR (Mantidos do anterior) ---
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (role === 'supervisor' && newRole === 'administrador') return toast.error("Sem permissão.");
    setSaving(true);
    try {
      const { error } = await supabase.from('profiles').insert({ email, full_name: fullName, cpf, role: newRole });
      if (error) throw error;
      toast.success("Cadastrado!");
      setEmail(''); setCpf(''); setFullName(''); fetchData();
    } catch (error: any) { toast.error(error.message); } finally { setSaving(false); }
  };

  const handleDelete = async (targetUser: any) => {
    if (!confirm(`Remover ${targetUser.full_name}?`)) return;
    try {
        const { error } = await supabase.from('profiles').delete().eq('id', targetUser.id);
        if (error) throw error;
        toast.success("Removido.");
        setUsers(users.filter(u => u.id !== targetUser.id));
    } catch (error: any) { toast.error(error.message); }
  };

  const handleUpdate = async () => {
    if (!editingUser) return;
    setSaving(true);
    try {
        const { error } = await supabase.from('profiles').update({ full_name: editName, cpf: editCpf, role: editRole }).eq('id', editingUser.id);
        if (error) throw error;
        toast.success("Atualizado!");
        setEditingUser(null); fetchData();
    } catch (e: any) { toast.error(e.message); } finally { setSaving(false); }
  };

  const filteredUsers = users.filter(u => u.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) || u.email?.toLowerCase().includes(searchTerm.toLowerCase()));
  const getInitials = (name: string) => name ? name.substring(0, 2).toUpperCase() : 'US';
  const getRoleBadge = (r: string) => {
    const styles: any = { administrador: "bg-red-100 text-red-700", supervisor: "bg-orange-100 text-orange-700", consulta: "text-slate-500", funcionario: "bg-blue-100 text-blue-700" };
    return <Badge variant="outline" className={styles[r] || styles.funcionario}>{r ? r.charAt(0).toUpperCase() + r.slice(1) : 'Func.'}</Badge>;
  };

  return (
    <div className="space-y-8 animate-in fade-in pb-20">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
            <h1 className="text-2xl font-bold text-slate-900">Gestão de Equipe</h1>
            <p className="text-slate-500 text-sm">Gerencie usuários e acessos aos módulos.</p>
        </div>
        <div className="flex gap-2">
            <input type="file" ref={fileInputRef} accept=".csv" className="hidden" onChange={handleImport} />
            <Button variant="outline" onClick={() => fileInputRef.current?.click()} className="bg-white"><FileUp className="mr-2 h-4 w-4"/> Importar CSV</Button>
            <Button variant="outline" onClick={handleExport} className="bg-white"><FileDown className="mr-2 h-4 w-4"/> Exportar Lista</Button>
        </div>
      </div>

      {/* FORMULÁRIO DE CADASTRO RÁPIDO */}
      <Card className="border border-slate-200 shadow-sm bg-white">
        <CardHeader className="pb-4 border-b border-slate-50"><CardTitle className="text-base font-semibold text-slate-800 flex items-center gap-2"><UserPlus className="h-4 w-4 text-[#003B8F]" /> Cadastro Rápido</CardTitle></CardHeader>
        <CardContent className="pt-6">
            <form onSubmit={handleRegister} className="grid gap-4 md:grid-cols-12 items-end">
                <div className="md:col-span-3 space-y-2"><label className="text-xs font-bold text-slate-500 uppercase">Nome</label><Input value={fullName} onChange={e=>setFullName(e.target.value)} className="bg-slate-50" required /></div>
                <div className="md:col-span-3 space-y-2"><label className="text-xs font-bold text-slate-500 uppercase">Email</label><Input value={email} onChange={e=>setEmail(e.target.value)} className="bg-slate-50" type="email" required /></div>
                <div className="md:col-span-2 space-y-2"><label className="text-xs font-bold text-slate-500 uppercase">CPF</label><Input value={cpf} onChange={e=>setCpf(e.target.value)} className="bg-slate-50" required /></div>
                <div className="md:col-span-2 space-y-2"><label className="text-xs font-bold text-slate-500 uppercase">Perfil</label>
                    <Select value={newRole} onValueChange={(v: any) => setNewRole(v)}><SelectTrigger className="bg-slate-50"><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="funcionario">Funcionário</SelectItem><SelectItem value="consulta">Consulta</SelectItem><SelectItem value="supervisor">Supervisor</SelectItem>{role === 'administrador' && <SelectItem value="administrador">Administrador</SelectItem>}</SelectContent></Select>
                </div>
                <div className="md:col-span-2"><Button type="submit" disabled={saving} className="bg-[#003B8F] w-full">{saving ? <Loader2 className="animate-spin h-4 w-4" /> : 'Cadastrar'}</Button></div>
            </form>
        </CardContent>
      </Card>
      
      {/* TABELA COM SELEÇÃO */}
      <Card className="border border-slate-200 shadow-sm overflow-hidden">
        <CardHeader className="bg-slate-50 border-b border-slate-100 py-4">
             <div className="flex justify-between items-center h-10">
                 {selectedUserIds.length > 0 ? (
                    <div className="flex items-center gap-4 animate-in fade-in slide-in-from-left-2 bg-blue-50 px-4 py-2 rounded-lg border border-blue-100 w-full">
                        <span className="font-bold text-[#003B8F] text-sm">{selectedUserIds.length} selecionado(s)</span>
                        <div className="h-4 w-px bg-blue-200" />
                        <Button size="sm" onClick={() => setIsLinkModalOpen(true)} className="bg-[#003B8F] hover:bg-blue-700 text-white h-8 text-xs">
                            <LinkIcon className="mr-2 h-3 w-3" /> Vincular a Módulos
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setSelectedUserIds([])} className="ml-auto text-slate-500 hover:text-slate-700 h-8 text-xs">
                            Cancelar
                        </Button>
                    </div>
                 ) : (
                    <>
                        <CardTitle className="text-base font-semibold text-slate-700">Membros ({filteredUsers.length})</CardTitle>
                        <div className="relative w-64">
                            <Search className="absolute left-2 top-2.5 h-4 w-4 text-slate-400" />
                            <Input placeholder="Buscar..." className="pl-8 h-9 bg-white" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}/>
                        </div>
                    </>
                 )}
            </div>
        </CardHeader>
        <CardContent className="p-0">
            {loading ? <div className="p-8 text-center"><Loader2 className="h-8 w-8 animate-spin mx-auto text-[#003B8F]" /></div> : (
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="w-[40px] text-center">
                                <Checkbox 
                                    checked={filteredUsers.length > 0 && selectedUserIds.length === filteredUsers.length} 
                                    onCheckedChange={(c) => toggleSelectAll(!!c)} 
                                />
                            </TableHead>
                            <TableHead className="w-[50px]"></TableHead>
                            <TableHead>Usuário</TableHead>
                            <TableHead>Função</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Ações</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filteredUsers.map((u) => (
                            <TableRow key={u.id} className={selectedUserIds.includes(u.id) ? 'bg-blue-50/50 hover:bg-blue-50' : 'hover:bg-slate-50'}>
                                <TableCell className="text-center">
                                    <Checkbox checked={selectedUserIds.includes(u.id)} onCheckedChange={(c) => toggleSelectUser(u.id, !!c)} />
                                </TableCell>
                                <TableCell><Avatar className="h-8 w-8"><AvatarFallback className="bg-slate-100 text-[#003B8F] text-xs font-bold">{getInitials(u.full_name)}</AvatarFallback></Avatar></TableCell>
                                <TableCell>
                                    <div className="flex flex-col"><span className="font-medium text-slate-700">{u.full_name}</span><span className="text-xs text-slate-500">{u.email}</span></div>
                                </TableCell>
                                <TableCell>{getRoleBadge(u.role)}</TableCell>
                                <TableCell>{u.user_id ? <Badge variant="outline" className="text-green-600 bg-green-50">Ativo</Badge> : <Badge variant="outline" className="text-yellow-600 bg-yellow-50">Pendente</Badge>}</TableCell>
                                <TableCell className="text-right">
                                    <div className="flex justify-end gap-1">
                                        {role === 'administrador' && <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-600 hover:bg-blue-50" onClick={() => { setEditName(u.full_name); setEditCpf(u.cpf); setEditRole(u.role); setEditingUser(u); }}><Pencil className="h-4 w-4" /></Button>}
                                        {u.user_id !== currentUser?.id && <Button variant="ghost" size="icon" className="h-8 w-8 text-red-400 hover:bg-red-50" onClick={() => handleDelete(u)}><Trash2 className="h-4 w-4" /></Button>}
                                    </div>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            )}
        </CardContent>
      </Card>

      {/* MODAL DE EDIÇÃO */}
      <Dialog open={!!editingUser} onOpenChange={(open) => !open && setEditingUser(null)}>
        <DialogContent>
            <DialogHeader><DialogTitle>Editar Usuário</DialogTitle></DialogHeader>
            <div className="space-y-4 py-2">
                <div className="space-y-2"><Label>Nome</Label><Input value={editName} onChange={e => setEditName(e.target.value)} /></div>
                <div className="space-y-2"><Label>CPF</Label><Input value={editCpf} onChange={e => setEditCpf(e.target.value)} /></div>
                <div className="space-y-2"><Label>Perfil</Label><Select value={editRole} onValueChange={(v: any) => setEditRole(v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="funcionario">Funcionário</SelectItem><SelectItem value="consulta">Consulta</SelectItem><SelectItem value="supervisor">Supervisor</SelectItem><SelectItem value="administrador">Administrador</SelectItem></SelectContent></Select></div>
            </div>
            <DialogFooter><Button variant="outline" onClick={() => setEditingUser(null)}>Cancelar</Button><Button onClick={handleUpdate} disabled={saving} className="bg-[#003B8F]">Salvar</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL DE VÍNCULO DE MÓDULOS */}
      <Dialog open={isLinkModalOpen} onOpenChange={setIsLinkModalOpen}>
        <DialogContent>
            <DialogHeader>
                <DialogTitle>Vincular Módulos</DialogTitle>
                <DialogDescription>Selecione os sistemas que os <b>{selectedUserIds.length} usuários</b> selecionados poderão acessar.</DialogDescription>
            </DialogHeader>
            <div className="py-4 space-y-2 max-h-[300px] overflow-y-auto border rounded-md p-2">
                {modules.map(mod => (
                    <div key={mod.id} className="flex items-center space-x-2 p-2 hover:bg-slate-50 rounded cursor-pointer" onClick={() => {
                        if (selectedModulesToLink.includes(mod.id)) setSelectedModulesToLink(prev => prev.filter(id => id !== mod.id));
                        else setSelectedModulesToLink(prev => [...prev, mod.id]);
                    }}>
                        <Checkbox checked={selectedModulesToLink.includes(mod.id)} />
                        <span className="text-sm font-medium">{mod.name}</span>
                    </div>
                ))}
                {modules.length === 0 && <p className="text-sm text-slate-400 text-center py-4">Nenhum módulo ativo disponível.</p>}
            </div>
            <DialogFooter>
                <Button variant="outline" onClick={() => setIsLinkModalOpen(false)}>Cancelar</Button>
                <Button onClick={handleLinkModules} disabled={saving || selectedModulesToLink.length === 0} className="bg-[#003B8F]">
                    {saving ? <Loader2 className="animate-spin h-4 w-4" /> : 'Confirmar Vínculos'}
                </Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}