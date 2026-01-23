import { useState, useEffect, useRef, useMemo } from 'react';
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
  UserPlus, Loader2, Trash2, Search, Pencil, 
  Link as LinkIcon, FileDown, FileUp, Key, Filter, ShieldAlert
} from 'lucide-react';
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';

export default function Team() {
  const { role, user: currentUser } = useAuth();
  const [users, setUsers] = useState<any[]>([]);
  const [modules, setModules] = useState<any[]>([]); 
  
  // Controle de permissões (Quem tem o que)
  const [userModulesMap, setUserModulesMap] = useState<Record<string, string[]>>({});
  const [myAllowedModules, setMyAllowedModules] = useState<string[]>([]); // Módulos que EU posso gerenciar

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // Filtros
  const [searchTerm, setSearchTerm] = useState('');
  const [filterModuleId, setFilterModuleId] = useState<string>('all');

  // Seleção em Massa
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  
  // Modais
  const [isLinkModalOpen, setIsLinkModalOpen] = useState(false); // Bulk link
  const [selectedModulesToLink, setSelectedModulesToLink] = useState<string[]>([]);
  
  // Modal de Gestão Individual (Vincular/Desvincular)
  const [accessModalOpen, setAccessModalOpen] = useState(false);
  const [selectedUserForAccess, setSelectedUserForAccess] = useState<any>(null);
  const [tempUserModules, setTempUserModules] = useState<string[]>([]);

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
        .order('full_name', { ascending: true });
      if (userError) throw userError;
      setUsers(userData || []);

      // 2. Busca Módulos Ativos
      const { data: modData } = await supabase
        .from('crud_modules')
        .select('id, name')
        .eq('is_active', true);
      setModules(modData || []);

      // 3. Busca Vínculos (Quem tem acesso a quê)
      // AQUI PODE SER O PROBLEMA SE FOR RLS: O admin precisa poder ler TODOS os profile_modules
      const { data: linksData, error: linksError } = await supabase
        .from('profile_modules')
        .select('profile_id, crud_module_id');
      
      if (linksError) {
          console.error("Erro ao ler vínculos:", linksError);
          // Não paramos o fluxo, mas logamos o erro
      }

      // Mapeia: ID do Usuário -> Array de IDs de Módulos
      const mapping: Record<string, string[]> = {};
      linksData?.forEach((link: any) => {
        if (!mapping[link.profile_id]) mapping[link.profile_id] = [];
        mapping[link.profile_id].push(link.crud_module_id);
      });
      setUserModulesMap(mapping);

      // 4. Se sou Supervisor, descubro quais módulos EU tenho (para limitar o que posso dar aos outros)
      if (role === 'administrador') {
        setMyAllowedModules(modData?.map((m: any) => m.id) || []);
      } else if (currentUser?.id) {
         // Pega meu ID de perfil
         const { data: myProfile } = await supabase.from('profiles').select('id').eq('user_id', currentUser.id).single();
         if (myProfile) {
            setMyAllowedModules(mapping[myProfile.id] || []);
         }
      }

    } catch (e: any) { 
      toast.error("Erro ao carregar dados: " + e.message); 
    } finally { 
      setLoading(false); 
    }
  };

  // --- LÓGICA DE HIERARQUIA DE CARGOS ---
  const getAvailableRoles = () => {
    const baseRoles = [
      { value: 'funcionario', label: 'Funcionário' },
      { value: 'consulta', label: 'Consulta' }
    ];
    if (role === 'administrador') {
      return [
        { value: 'administrador', label: 'Administrador' },
        { value: 'supervisor', label: 'Supervisor' },
        ...baseRoles
      ];
    }
    return baseRoles;
  };

  // --- FILTROS ---
  const filteredUsers = useMemo(() => {
    return users.filter(u => {
      // Filtro de Texto
      const matchesSearch = u.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
                            u.email?.toLowerCase().includes(searchTerm.toLowerCase());
      
      // Filtro de Módulo (Novo)
      let matchesModule = true;
      if (filterModuleId !== 'all') {
        const userMods = userModulesMap[u.id] || [];
        matchesModule = userMods.includes(filterModuleId);
      }

      return matchesSearch && matchesModule;
    });
  }, [users, searchTerm, filterModuleId, userModulesMap]);

  // --- SELEÇÃO EM MASSA ---
  const toggleSelectAll = (checked: boolean) => {
    if (checked) setSelectedUserIds(filteredUsers.map(u => u.id));
    else setSelectedUserIds([]);
  };

  const toggleSelectUser = (id: string, checked: boolean) => {
    if (checked) setSelectedUserIds(prev => checked ? [...prev, id] : prev.filter(uid => uid !== id));
  };

  // --- GESTÃO INDIVIDUAL (ABRIR MODAL) ---
  const openAccessModal = (user: any) => {
    setSelectedUserForAccess(user);
    // Carrega o estado atual do usuário
    setTempUserModules(userModulesMap[user.id] || []);
    setAccessModalOpen(true);
  };

  // --- SALVAR GESTÃO INDIVIDUAL (LINK/UNLINK) ---
  const handleSaveIndividualAccess = async () => {
    if (!selectedUserForAccess) return;
    setSaving(true);
    try {
      const originalModules = userModulesMap[selectedUserForAccess.id] || [];
      const currentModules = tempUserModules;

      // 1. O que adicionar? (Está no novo, mas não no antigo)
      const toAdd = currentModules.filter(id => !originalModules.includes(id));
      
      // 2. O que remover? (Está no antigo, mas não no novo)
      const toRemove = originalModules.filter(id => !currentModules.includes(id));

      const promises = [];

      if (toAdd.length > 0) {
        const insertPayload = toAdd.map(modId => ({ profile_id: selectedUserForAccess.id, crud_module_id: modId }));
        promises.push(supabase.from('profile_modules').insert(insertPayload));
      }

      if (toRemove.length > 0) {
        promises.push(
          supabase.from('profile_modules')
            .delete()
            .eq('profile_id', selectedUserForAccess.id)
            .in('crud_module_id', toRemove)
        );
      }

      await Promise.all(promises);
      toast.success("Acessos atualizados com sucesso!");
      setAccessModalOpen(false);
      fetchData(); // Recarrega para atualizar o mapa local
    } catch (e: any) {
      toast.error("Erro ao salvar acessos: " + e.message);
    } finally {
      setSaving(false);
    }
  };

  // --- VINCULAR EM MASSA (RF003) ---
  const handleBulkLinkModules = async () => {
    if (selectedUserIds.length === 0 || selectedModulesToLink.length === 0) return;
    setSaving(true);
    try {
      const payload: any[] = [];
      selectedUserIds.forEach(userId => {
        selectedModulesToLink.forEach(modId => {
          payload.push({ profile_id: userId, crud_module_id: modId });
        });
      });

      const { error } = await supabase
        .from('profile_modules')
        .upsert(payload, { onConflict: 'profile_id,crud_module_id', ignoreDuplicates: true });
      
      if (error) throw error;
      
      toast.success(`${payload.length} permissões processadas!`);
      setIsLinkModalOpen(false);
      setSelectedUserIds([]);
      setSelectedModulesToLink([]);
      fetchData();
    } catch (e: any) {
      toast.error("Erro ao vincular: " + e.message);
    } finally {
      setSaving(false);
    }
  };

  // --- CADASTRO MANUAL (RF001) ---
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    // Validação extra de segurança no front
    if (role !== 'administrador' && (newRole === 'administrador' || newRole === 'supervisor')) {
        return toast.error("Você não tem permissão para criar este cargo.");
    }
    
    setSaving(true);
    try {
      const { error } = await supabase.from('profiles').insert({ 
          email, full_name: fullName, cpf, role: newRole 
      });
      if (error) throw error;
      toast.success("Usuário pré-cadastrado!");
      setEmail(''); setCpf(''); setFullName(''); fetchData();
    } catch (error: any) { toast.error(error.message); } finally { setSaving(false); }
  };

  // --- UPDATE ---
  const handleUpdate = async () => {
    if (!editingUser) return;
    setSaving(true);
    try {
        const { error } = await supabase.from('profiles')
            .update({ full_name: editName, cpf: editCpf, role: editRole })
            .eq('id', editingUser.id);
        if (error) throw error;
        toast.success("Atualizado!");
        setEditingUser(null); fetchData();
    } catch (e: any) { toast.error(e.message); } finally { setSaving(false); }
  };

  // --- EXPORTAR/IMPORTAR/DELETE (Mantidos iguais) ---
  const handleExport = () => { /* Código original mantido */
    const headers = ['Nome Completo', 'Email', 'CPF', 'Perfil', 'Status'];
    const rows = users.map(u => [u.full_name, u.email, u.cpf || '', u.role, u.user_id ? 'Ativo' : 'Pendente']);
    const csvContent = "\uFEFF" + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([csvContent], { type: 'text/csv;charset=utf-8;' }));
    link.download = `Equipe_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link); link.click(); document.body.removeChild(link);
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => { /* Código original mantido */
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      const text = event.target?.result as string;
      const lines = text.split(/\r\n|\n/).filter(line => line.trim() !== '');
      const dataLines = lines[0].toLowerCase().includes('email') ? lines.slice(1) : lines;
      if (dataLines.length === 0) return toast.error("Arquivo vazio.");
      setSaving(true);
      let successCount = 0, errorCount = 0;
      for (const line of dataLines) {
        const cols = line.split(',');
        if (cols.length < 2) continue; 
        const [impName, impEmail, impCpf, impRole] = cols.map(c => c.trim().replace(/^"|"$/g, ''));
        try {
          const { error } = await supabase.from('profiles').insert({
            full_name: impName, email: impEmail, cpf: impCpf, role: impRole
          });
          if (!error) successCount++; else errorCount++;
        } catch (err) { errorCount++; }
      }
      toast.success(`Importação: ${successCount} criados, ${errorCount} erros.`);
      setSaving(false); fetchData();
    };
    reader.readAsText(file);
    if(fileInputRef.current) fileInputRef.current.value = '';
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

  const getInitials = (name: string) => name ? name.substring(0, 2).toUpperCase() : 'US';
  const getRoleBadge = (r: string) => {
    const styles: any = { administrador: "bg-slate-900 text-white", supervisor: "bg-purple-100 text-purple-700", consulta: "bg-gray-100 text-gray-600", funcionario: "bg-blue-100 text-blue-700" };
    return <Badge className={`${styles[r] || styles.funcionario} border-0 shadow-none`}>{r ? r.charAt(0).toUpperCase() + r.slice(1) : 'Func.'}</Badge>;
  };

  return (
    <div className="space-y-8 animate-in fade-in pb-20 pt-4">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
            <h1 className="text-3xl font-bold text-[#003B8F]">Gestão de Equipe</h1>
            <p className="text-slate-500 mt-1">Gerencie usuários, cargos e permissões de acesso.</p>
        </div>
        <div className="flex gap-2">
            <input type="file" ref={fileInputRef} accept=".csv" className="hidden" onChange={handleImport} />
            <Button variant="outline" onClick={() => fileInputRef.current?.click()} className="bg-white"><FileUp className="mr-2 h-4 w-4"/> Importar CSV</Button>
            <Button variant="outline" onClick={handleExport} className="bg-white"><FileDown className="mr-2 h-4 w-4"/> Exportar</Button>
        </div>
      </div>

      {/* PAINEL DE CADASTRO */}
      <Card className="border-slate-200 shadow-sm bg-white">
        <CardHeader className="pb-4 border-b border-slate-50"><CardTitle className="text-base font-semibold text-slate-800 flex items-center gap-2"><UserPlus className="h-4 w-4 text-[#003B8F]" /> Novo Membro</CardTitle></CardHeader>
        <CardContent className="pt-6">
            <form onSubmit={handleRegister} className="grid gap-4 md:grid-cols-12 items-end">
                <div className="md:col-span-3 space-y-2"><Label>Nome Completo</Label><Input value={fullName} onChange={e=>setFullName(e.target.value)} required /></div>
                <div className="md:col-span-3 space-y-2"><Label>Email Corporativo</Label><Input value={email} onChange={e=>setEmail(e.target.value)} type="email" required /></div>
                <div className="md:col-span-2 space-y-2"><Label>CPF</Label><Input value={cpf} onChange={e=>setCpf(e.target.value)} required /></div>
                <div className="md:col-span-2 space-y-2"><Label>Cargo / Permissão</Label>
                    <Select value={newRole} onValueChange={(v: any) => setNewRole(v)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                            {/* AQUI ESTÁ A LÓGICA DE HIERARQUIA VISUAL */}
                            {getAvailableRoles().map(roleOpt => (
                                <SelectItem key={roleOpt.value} value={roleOpt.value}>{roleOpt.label}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                <div className="md:col-span-2"><Button type="submit" disabled={saving} className="bg-[#003B8F] w-full">{saving ? <Loader2 className="animate-spin h-4 w-4" /> : 'Cadastrar'}</Button></div>
            </form>
        </CardContent>
      </Card>
      
      {/* TABELA DE MEMBROS */}
      <Card className="border border-slate-200 shadow-sm overflow-hidden">
        <CardHeader className="bg-slate-50 border-b border-slate-100 py-4">
              <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
                  {selectedUserIds.length > 0 ? (
                     <div className="flex items-center gap-4 bg-blue-50 px-4 py-2 rounded-lg border border-blue-100 w-full animate-in fade-in">
                         <span className="font-bold text-[#003B8F] text-sm">{selectedUserIds.length} selecionado(s)</span>
                         <div className="h-4 w-px bg-blue-200" />
                         <Button size="sm" onClick={() => setIsLinkModalOpen(true)} className="bg-[#003B8F] hover:bg-blue-700 h-8 text-xs">
                             <LinkIcon className="mr-2 h-3 w-3" /> Vincular em Massa
                         </Button>
                         <Button size="sm" variant="ghost" onClick={() => setSelectedUserIds([])} className="ml-auto text-slate-500 h-8 text-xs">Cancelar</Button>
                     </div>
                  ) : (
                    <>
                        <div className="flex items-center gap-2">
                           <CardTitle className="text-base font-semibold text-slate-700">Equipe ({filteredUsers.length})</CardTitle>
                           {/* NOVO FILTRO DE MÓDULOS */}
                           <div className="ml-4 flex items-center gap-2">
                              <Filter className="h-4 w-4 text-slate-400" />
                              <Select value={filterModuleId} onValueChange={setFilterModuleId}>
                                <SelectTrigger className="h-8 w-[200px] text-xs bg-white border-slate-200">
                                    <SelectValue placeholder="Filtrar por Sistema" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Todos os Sistemas</SelectItem>
                                    {modules.map(m => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
                                </SelectContent>
                              </Select>
                           </div>
                        </div>
                        <div className="relative w-64">
                            <Search className="absolute left-2 top-2.5 h-4 w-4 text-slate-400" />
                            <Input placeholder="Buscar por nome ou email..." className="pl-8 h-9 bg-white" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}/>
                        </div>
                    </>
                  )}
            </div>
        </CardHeader>
        <CardContent className="p-0">
            {loading ? <div className="p-12 text-center"><Loader2 className="h-8 w-8 animate-spin mx-auto text-[#003B8F]" /></div> : (
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="w-[40px] text-center"><Checkbox checked={filteredUsers.length > 0 && selectedUserIds.length === filteredUsers.length} onCheckedChange={(c) => toggleSelectAll(!!c)} /></TableHead>
                            <TableHead className="w-[50px]"></TableHead>
                            <TableHead>Colaborador</TableHead>
                            <TableHead>Cargo</TableHead>
                            <TableHead>Acessos</TableHead>
                            <TableHead className="text-right">Ações</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filteredUsers.map((u) => {
                            const accessCount = (userModulesMap[u.id] || []).length;
                            return (
                                <TableRow key={u.id} className={selectedUserIds.includes(u.id) ? 'bg-blue-50/50' : ''}>
                                    <TableCell className="text-center"><Checkbox checked={selectedUserIds.includes(u.id)} onCheckedChange={(c) => toggleSelectUser(u.id, !!c)} /></TableCell>
                                    <TableCell><Avatar className="h-8 w-8"><AvatarFallback className="bg-slate-100 text-[#003B8F] text-xs font-bold">{getInitials(u.full_name)}</AvatarFallback></Avatar></TableCell>
                                    <TableCell>
                                        <div className="flex flex-col"><span className="font-medium text-slate-700">{u.full_name}</span><span className="text-xs text-slate-500">{u.email}</span></div>
                                    </TableCell>
                                    <TableCell>{getRoleBadge(u.role)}</TableCell>
                                    <TableCell>
                                        <Badge variant="secondary" className="bg-slate-100 text-slate-600 font-normal">
                                            {accessCount} sistema{accessCount !== 1 && 's'}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex justify-end gap-1">
                                            {/* BOTÃO DE GESTÃO DE ACESSOS (CHAVE) */}
                                            <Button variant="ghost" size="icon" className="h-8 w-8 text-amber-600 hover:bg-amber-50" onClick={() => openAccessModal(u)} title="Gerenciar Acessos">
                                                <Key className="h-4 w-4" />
                                            </Button>
                                            <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-600 hover:bg-blue-50" onClick={() => { setEditName(u.full_name); setEditCpf(u.cpf); setEditRole(u.role); setEditingUser(u); }}>
                                                <Pencil className="h-4 w-4" />
                                            </Button>
                                            <Button variant="ghost" size="icon" className="h-8 w-8 text-red-400 hover:bg-red-50" onClick={() => handleDelete(u)}>
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            );
                        })}
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
                <div className="space-y-2"><Label>Perfil</Label>
                    <Select value={editRole} onValueChange={(v: any) => setEditRole(v)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                            {getAvailableRoles().map(opt => <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>)}
                        </SelectContent>
                    </Select>
                </div>
            </div>
            <DialogFooter><Button variant="outline" onClick={() => setEditingUser(null)}>Cancelar</Button><Button onClick={handleUpdate} disabled={saving} className="bg-[#003B8F]">Salvar</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL DE GESTÃO INDIVIDUAL DE ACESSOS (LINK/UNLINK) */}
      <Dialog open={accessModalOpen} onOpenChange={setAccessModalOpen}>
        <DialogContent className="max-w-md">
            <DialogHeader>
                <DialogTitle>Acessos de {selectedUserForAccess?.full_name}</DialogTitle>
                <DialogDescription>Marque os sistemas que este usuário pode acessar. Desmarque para remover o acesso.</DialogDescription>
            </DialogHeader>
            
            <div className="py-4 space-y-2 max-h-[300px] overflow-y-auto border rounded-md p-2 bg-slate-50">
                {modules.map(mod => {
                    // SUPERVISOR SÓ VÊ O QUE TEM ACESSO
                    if (role !== 'administrador' && !myAllowedModules.includes(mod.id)) return null;

                    const isChecked = tempUserModules.includes(mod.id);
                    return (
                        <div key={mod.id} className={`flex items-center space-x-3 p-3 rounded cursor-pointer border transition-colors ${isChecked ? 'bg-white border-blue-200 shadow-sm' : 'border-transparent hover:bg-white'}`}
                             onClick={() => {
                                 if (isChecked) setTempUserModules(prev => prev.filter(id => id !== mod.id));
                                 else setTempUserModules(prev => [...prev, mod.id]);
                             }}>
                            <Checkbox checked={isChecked} />
                            <span className={`text-sm font-medium ${isChecked ? 'text-[#003B8F]' : 'text-slate-600'}`}>{mod.name}</span>
                        </div>
                    );
                })}
                {modules.length === 0 && <p className="text-center text-sm text-slate-400">Nenhum módulo disponível.</p>}
            </div>

            <DialogFooter>
                <Button variant="outline" onClick={() => setAccessModalOpen(false)}>Cancelar</Button>
                <Button onClick={handleSaveIndividualAccess} disabled={saving} className="bg-[#003B8F]">
                    {saving ? <Loader2 className="animate-spin h-4 w-4" /> : 'Salvar Alterações'}
                </Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL DE VÍNCULO EM MASSA */}
      <Dialog open={isLinkModalOpen} onOpenChange={setIsLinkModalOpen}>
        <DialogContent>
            <DialogHeader>
                <DialogTitle>Vincular em Massa</DialogTitle>
                <DialogDescription>Adicionar acesso para <b>{selectedUserIds.length} usuários</b> de uma vez.</DialogDescription>
            </DialogHeader>
            <div className="py-4 space-y-2 max-h-[300px] overflow-y-auto border rounded-md p-2">
                {modules.map(mod => {
                     if (role !== 'administrador' && !myAllowedModules.includes(mod.id)) return null;
                     return (
                        <div key={mod.id} className="flex items-center space-x-2 p-2 hover:bg-slate-50 rounded cursor-pointer" onClick={() => {
                            if (selectedModulesToLink.includes(mod.id)) setSelectedModulesToLink(prev => prev.filter(id => id !== mod.id));
                            else setSelectedModulesToLink(prev => [...prev, mod.id]);
                        }}>
                            <Checkbox checked={selectedModulesToLink.includes(mod.id)} />
                            <span className="text-sm font-medium">{mod.name}</span>
                        </div>
                     );
                })}
            </div>
            <DialogFooter>
                <Button variant="outline" onClick={() => setIsLinkModalOpen(false)}>Cancelar</Button>
                <Button onClick={handleBulkLinkModules} disabled={saving || selectedModulesToLink.length === 0} className="bg-[#003B8F]">Confirmar</Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}