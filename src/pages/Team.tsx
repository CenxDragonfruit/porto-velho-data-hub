import { useState, useEffect, useRef, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { 
  UserPlus, Loader2, Trash2, Pencil, 
  Link as LinkIcon, FileUp, Key, ShieldCheck, Upload, Filter, Check, Search
} from 'lucide-react';
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator } from '@/components/ui/command';
import { cn } from '@/lib/utils';

// --- UTILITÁRIOS CPF ---
const formatCPF = (value: string) => {
    if (!value) return '';
    return value.replace(/\D/g, '').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d{1,2})/, '$1-$2').replace(/(-\d{2})\d+?$/, '$1');
};

const validateCPF = (cpf: string) => {
  if (!cpf) return true; 
  cpf = cpf.replace(/[^\d]+/g, '');
  if (cpf.length !== 11 || /^(\d)\1+$/.test(cpf)) return false;
  let soma = 0, resto;
  for (let i = 1; i <= 9; i++) soma += parseInt(cpf.substring(i-1, i)) * (11 - i);
  resto = (soma * 10) % 11;
  if ((resto === 10) || (resto === 11)) resto = 0;
  if (resto !== parseInt(cpf.substring(9, 10))) return false;
  soma = 0;
  for (let i = 1; i <= 10; i++) soma += parseInt(cpf.substring(i-1, i)) * (12 - i);
  resto = (soma * 10) % 11;
  if ((resto === 10) || (resto === 11)) resto = 0;
  if (resto !== parseInt(cpf.substring(10, 11))) return false;
  return true;
};

const sb: any = supabase;

interface User {
  id: number;
  nome_completo: string;
  email: string;
  cpf: string;
  perfil_id: number;
  perfis?: { nome: string };
}

export default function Team() {
  const { userData, role } = useAuth(); 
  const [users, setUsers] = useState<User[]>([]);
  const [modules, setModules] = useState<any[]>([]); 
  const [profiles, setProfiles] = useState<any[]>([]); 
  const [userPermissionsMap, setUserPermissionsMap] = useState<Record<number, number[]>>({});

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // --- NOVOS FILTROS (POR COLUNA) ---
  const [searchTerm, setSearchTerm] = useState('');
  const [columnFilters, setColumnFilters] = useState<Record<string, string[]>>({});
  
  const [selectedUserIds, setSelectedUserIds] = useState<number[]>([]);
  
  // Modais
  const [dialogOpen, setDialogOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [accessModalOpen, setAccessModalOpen] = useState(false);
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false); 
  const [csvModalOpen, setCsvModalOpen] = useState(false);
  
  // CSV Import State
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [csvRows, setCsvRows] = useState<string[][]>([]);
  const [csvMapping, setCsvMapping] = useState({ nome: '', email: '', cpf: '' });
  const [csvTargetProfile, setCsvTargetProfile] = useState('');

  // Edição/Vínculo
  const [selectedUserForAccess, setSelectedUserForAccess] = useState<User | null>(null);
  const [tempUserModules, setTempUserModules] = useState<number[]>([]);
  const [selectedModulesToLink, setSelectedModulesToLink] = useState<number[]>([]);
  const [formData, setFormData] = useState({ id: 0, nome: '', email: '', cpf: '', perfil_id: '' });

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: perfData } = await sb.from('perfis').select('*').order('id');
      setProfiles(perfData || []);

      const { data: modData } = await sb.from('modulos').select('id, nome').eq('ativo', true);
      setModules(modData || []);

      const { data: userDataDB, error: userError } = await sb
        .from('usuarios')
        .select('*, perfis(nome)')
        .order('nome_completo', { ascending: true });
      
      if (userError) throw userError;
      setUsers(userDataDB || []);

      // CORREÇÃO: Nome da tabela 'permissoes_modulo'
      const { data: permData } = await sb.from('permissoes_modulo').select('usuario_id, modulo_id');
      if (permData) {
        const mapping: Record<number, number[]> = {};
        permData.forEach((p: any) => {
          if (!mapping[p.usuario_id]) mapping[p.usuario_id] = [];
          mapping[p.usuario_id].push(p.modulo_id);
        });
        setUserPermissionsMap(mapping);
      }
    } catch (e: any) { 
      toast.error("Erro ao carregar dados.");
    } finally { setLoading(false); }
  };

  // --- LÓGICA DE FILTRAGEM UNIFICADA ---
  const filteredUsers = useMemo(() => {
    return users.filter(u => {
      // 1. Busca Global (Limpa CPF para comparar apenas números)
      const cleanSearch = searchTerm.replace(/\D/g, '');
      const cleanCpf = u.cpf ? u.cpf.replace(/\D/g, '') : '';
      
      const matchesSearch = searchTerm === '' || 
        u.nome_completo?.toLowerCase().includes(searchTerm.toLowerCase()) || 
        u.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (cleanSearch.length > 0 && cleanCpf.includes(cleanSearch));

      // 2. Filtros por Coluna (Valores Únicos)
      const matchesColumns = Object.keys(columnFilters).every(key => {
          const selectedValues = columnFilters[key];
          if (!selectedValues || selectedValues.length === 0) return true;
          
          let recordVal = '';
          if (key === 'perfis') recordVal = u.perfis?.nome || 'Sem Cargo';
          else if (key === 'nome_completo') recordVal = u.nome_completo;
          else if (key === 'email') recordVal = u.email;
          else if (key === 'cpf') recordVal = u.cpf ? formatCPF(u.cpf) : 'Sem CPF'; // Filtra pelo formatado
          
          return selectedValues.includes(recordVal);
      });

      return matchesSearch && matchesColumns;
    });
  }, [users, searchTerm, columnFilters]);

  // --- PERFIS DISPONÍVEIS PARA CRIAÇÃO ---
  const availableProfilesToCreate = useMemo(() => {
    if (role === 'ADMINISTRADOR') return profiles;
    if (role === 'SUPERVISOR') {
        return profiles.filter(p => !['ADMINISTRADOR', 'SUPERVISOR'].includes(p.nome.toUpperCase()));
    }
    return [];
  }, [profiles, role]);

  const toggleSelectAll = (checked: boolean) => {
    if (checked) setSelectedUserIds(filteredUsers.map(u => u.id));
    else setSelectedUserIds([]);
  };

  const toggleSelectUser = (id: number, checked: boolean) => {
    if (checked) setSelectedUserIds(prev => [...prev, id]);
    else setSelectedUserIds(prev => prev.filter(uid => uid !== id));
  };

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.cpf && !validateCPF(formData.cpf)) {
        toast.error("CPF Inválido! Corrija ou deixe em branco.");
        return;
    }
    setSaving(true);
    try {
      const payload = {
        nome_completo: formData.nome,
        email: formData.email,
        cpf: formData.cpf ? formData.cpf.replace(/\D/g, '') : null, 
        perfil_id: Number(formData.perfil_id)
      };

      if (isEditing) {
        await sb.from('usuarios').update(payload).eq('id', formData.id);
        toast.success("Usuário atualizado!");
      } else {
        await sb.from('usuarios').insert(payload);
        toast.success("Usuário pré-cadastrado!");
      }
      setDialogOpen(false); fetchData();
    } catch (e: any) { toast.error("Erro ao salvar: " + e.message); } finally { setSaving(false); }
  };

  // --- LÓGICA DE EXCLUSÃO COM PERMISSÕES ---
  const handleDelete = async (targetUser: User) => {
    if (userData && userData.id === targetUser.id) {
        return toast.error("Ação bloqueada: Você não pode excluir seu próprio usuário.");
    }
    if (role === 'SUPERVISOR') {
        const targetProfileName = targetUser.perfis?.nome?.toUpperCase() || '';
        const isProtected = ['ADMINISTRADOR', 'SUPERVISOR'].includes(targetProfileName);
        if (isProtected) {
            return toast.error("Permissão negada: Supervisores não podem remover Administradores ou outros Supervisores.");
        }
    }
    if (!confirm(`Remover ${targetUser.nome_completo} permanentemente?`)) return;
    
    await sb.from('usuarios').delete().eq('id', targetUser.id);
    fetchData();
    toast.success("Usuário removido.");
  };

  const canDeleteUser = (targetUser: User) => {
      if (userData?.id === targetUser.id) return false;
      if (role === 'ADMINISTRADOR') return true;
      if (role === 'SUPERVISOR') {
          const p = targetUser.perfis?.nome?.toUpperCase() || '';
          return !['ADMINISTRADOR', 'SUPERVISOR'].includes(p);
      }
      return false;
  };

  // --- IMPORTAÇÃO CSV ---
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
        const text = evt.target?.result as string;
        const lines = text.split(/\r\n|\n/).filter(line => line.trim() !== '');
        if (lines.length < 2) return toast.error("CSV vazio ou inválido");
        const headers = lines[0].split(',').map(h => h.trim());
        const rows = lines.slice(1).map(line => line.split(',').map(c => c.trim()));
        setCsvHeaders(headers);
        setCsvRows(rows);
        setCsvModalOpen(true);
        const map = { nome: '', email: '', cpf: '' };
        headers.forEach(h => {
            if (/nome|name/i.test(h)) map.nome = h;
            if (/email|mail/i.test(h)) map.email = h;
            if (/cpf|doc/i.test(h)) map.cpf = h;
        });
        setCsvMapping(map);
        const funcProfile = availableProfilesToCreate.find(p => p.nome.toUpperCase() === 'FUNCIONARIO');
        if (funcProfile) setCsvTargetProfile(funcProfile.id.toString());
    };
    reader.readAsText(file);
    if(fileInputRef.current) fileInputRef.current.value = '';
  };

  const processCsvImport = async () => {
    if (!csvTargetProfile || !csvMapping.nome || !csvMapping.email) return toast.warning("Mapeie Nome e Email (obrigatórios)");
    setSaving(true);
    try {
        const nomeIdx = csvHeaders.indexOf(csvMapping.nome);
        const emailIdx = csvHeaders.indexOf(csvMapping.email);
        const cpfIdx = csvHeaders.indexOf(csvMapping.cpf);
        const usersToInsert = csvRows.map(row => {
            const rawCpf = cpfIdx >= 0 ? row[cpfIdx] : '';
            return {
                nome_completo: row[nomeIdx],
                email: row[emailIdx],
                cpf: rawCpf ? rawCpf.replace(/\D/g, '') : null,
                perfil_id: parseInt(csvTargetProfile)
            };
        }).filter(u => u.nome_completo && u.email);
        const { error } = await sb.from('usuarios').insert(usersToInsert);
        if (error) throw error;
        toast.success(`${usersToInsert.length} usuários importados!`);
        setCsvModalOpen(false);
        fetchData();
    } catch(e: any) { toast.error("Erro na importação: " + e.message); } finally { setSaving(false); }
  };

  const handleSaveAccess = async () => {
    if (!selectedUserForAccess) return;
    setSaving(true);
    try {
      const userId = selectedUserForAccess.id;
      // CORREÇÃO: Nome da tabela 'permissoes_modulo'
      await sb.from('permissoes_modulo').delete().eq('usuario_id', userId);
      if (tempUserModules.length > 0) {
        const payload = tempUserModules.map(mid => ({ usuario_id: userId, modulo_id: mid }));
        await sb.from('permissoes_modulo').insert(payload);
      }
      toast.success("Acessos atualizados.");
      setAccessModalOpen(false); fetchData();
    } catch (e: any) { toast.error("Erro ao salvar acessos."); } finally { setSaving(false); }
  };

  const handleBulkLink = async () => {
    if (!selectedUserIds.length || !selectedModulesToLink.length) return;
    setSaving(true);
    try {
      const payload: any[] = [];
      selectedUserIds.forEach(uid => {
        selectedModulesToLink.forEach(mid => {
          payload.push({ usuario_id: uid, modulo_id: mid });
        });
      });
      // CORREÇÃO: Nome da tabela 'permissoes_modulo'
      await sb.from('permissoes_modulo').upsert(payload, { onConflict: 'usuario_id,modulo_id', ignoreDuplicates: true });
      toast.success("Acesso em massa liberado.");
      setIsBulkModalOpen(false); setSelectedUserIds([]); setSelectedModulesToLink([]); fetchData();
    } catch (e: any) { toast.error("Erro na operação em massa."); } finally { setSaving(false); }
  };

  const getInitials = (name: string) => name ? name.substring(0, 2).toUpperCase() : 'US';

  return (
    <div className="space-y-6 animate-in fade-in pb-20 pt-4">
      {/* HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-[#003B8F]">Gestão de Equipe</h1>
          <p className="text-slate-500 mt-1">Gerencie usuários, cargos e permissões de acesso.</p>
        </div>
        <div className="flex gap-2">
            <input type="file" ref={fileInputRef} accept=".csv" className="hidden" onChange={handleFileSelect} />
            <Button variant="outline" onClick={() => fileInputRef.current?.click()} className="bg-white"><FileUp className="mr-2 h-4 w-4"/> Importar CSV</Button>
            <Button onClick={() => { 
                const defaultProfile = availableProfilesToCreate[0]?.id || '';
                setFormData({ id: 0, nome: '', email: '', cpf: '', perfil_id: defaultProfile.toString() }); 
                setIsEditing(false); 
                setDialogOpen(true); 
            }} className="bg-[#003B8F] hover:bg-blue-800 shadow-md">
            <UserPlus className="mr-2 h-4 w-4"/> Adicionar Membro
            </Button>
        </div>
      </div>

      {/* TABELA COM FILTROS AVANÇADOS */}
      <Card className="border border-slate-200 shadow-sm overflow-hidden bg-white">
        <CardHeader className="bg-white border-b border-slate-100 py-3">
            <div className="flex flex-col md:flex-row justify-between gap-4 items-center">
                <div className="flex items-center gap-2">
                    {selectedUserIds.length > 0 ? (
                        <div className="flex items-center gap-3 animate-in fade-in">
                            <Badge className="bg-[#003B8F]">{selectedUserIds.length} selecionados</Badge>
                            <Button size="sm" variant="outline" onClick={() => setIsBulkModalOpen(true)} className="h-8 text-xs border-[#003B8F] text-[#003B8F]">
                                <LinkIcon className="mr-2 h-3 w-3" /> Vincular Módulos
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => setSelectedUserIds([])} className="h-8 text-xs text-slate-500">Cancelar</Button>
                        </div>
                    ) : (
                        <span className="text-sm font-bold text-slate-700">{filteredUsers.length} colaboradores</span>
                    )}
                </div>
                
                {/* Busca Global */}
                <div className="relative w-full md:w-72">
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                    <Input placeholder="Busca rápida..." className="pl-9 h-9 bg-slate-50 border-slate-200" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                </div>
            </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? <div className="p-20 text-center"><Loader2 className="h-8 w-8 animate-spin mx-auto text-[#003B8F]" /></div> : (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent bg-slate-50/50">
                  <TableHead className="w-[50px] text-center">
                    <Checkbox checked={filteredUsers.length > 0 && selectedUserIds.length === filteredUsers.length} onCheckedChange={(c) => toggleSelectAll(!!c)} />
                  </TableHead>
                  
                  {/* FILTRO DE COLABORADOR */}
                  <TableHead>
                      <ColumnFilter 
                          title="Colaborador" 
                          field="nome_completo" 
                          data={users} 
                          selectedValues={columnFilters['nome_completo']}
                          onChange={(vals: string[]) => {
                              const newF = {...columnFilters};
                              if (vals.length) newF['nome_completo'] = vals; else delete newF['nome_completo'];
                              setColumnFilters(newF);
                          }}
                      />
                  </TableHead>

                  {/* FILTRO DE EMAIL */}
                  <TableHead>
                      <ColumnFilter 
                          title="E-mail" 
                          field="email" 
                          data={users} 
                          selectedValues={columnFilters['email']}
                          onChange={(vals: string[]) => {
                              const newF = {...columnFilters};
                              if (vals.length) newF['email'] = vals; else delete newF['email'];
                              setColumnFilters(newF);
                          }}
                      />
                  </TableHead>

                  {/* FILTRO DE CPF */}
                  <TableHead>
                      <ColumnFilter 
                          title="CPF" 
                          field="cpf" 
                          data={users} 
                          selectedValues={columnFilters['cpf']}
                          onChange={(vals: string[]) => {
                              const newF = {...columnFilters};
                              if (vals.length) newF['cpf'] = vals; else delete newF['cpf'];
                              setColumnFilters(newF);
                          }}
                      />
                  </TableHead>

                  {/* FILTRO DE CARGO */}
                  <TableHead>
                      <ColumnFilter 
                          title="Cargo" 
                          field="perfis" 
                          data={users} 
                          selectedValues={columnFilters['perfis']}
                          onChange={(vals: string[]) => {
                              const newF = {...columnFilters};
                              if (vals.length) newF['perfis'] = vals; else delete newF['perfis'];
                              setColumnFilters(newF);
                          }}
                      />
                  </TableHead>

                  <TableHead>Sistemas</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.length === 0 ? (
                    <TableRow><TableCell colSpan={7} className="text-center h-24 text-slate-500">Nenhum registro encontrado.</TableCell></TableRow>
                ) : (
                    filteredUsers.map(u => {
                    const permCount = (userPermissionsMap[u.id] || []).length;
                    const canDel = canDeleteUser(u);
                    
                    return (
                        <TableRow key={u.id} className={selectedUserIds.includes(u.id) ? "bg-blue-50/40" : ""}>
                        <TableCell className="text-center">
                            <Checkbox checked={selectedUserIds.includes(u.id)} onCheckedChange={(c) => toggleSelectUser(u.id, !!c)} />
                        </TableCell>
                        <TableCell>
                            <div className="flex items-center gap-3">
                            <Avatar className="h-8 w-8 border border-slate-200">
                                <AvatarFallback className="bg-slate-100 text-[#003B8F] text-[10px] font-bold">{getInitials(u.nome_completo)}</AvatarFallback>
                            </Avatar>
                            <span className="text-sm font-semibold text-slate-700">{u.nome_completo}</span>
                            </div>
                        </TableCell>
                        <TableCell className="text-xs text-slate-500">{u.email}</TableCell>
                        <TableCell className="text-xs font-mono text-slate-500">
                            {u.cpf ? formatCPF(u.cpf) : '-'}
                        </TableCell>
                        <TableCell>
                            <Badge variant="secondary" className="font-normal border-0 bg-slate-100">{u.perfis?.nome || 'Sem Cargo'}</Badge>
                        </TableCell>
                        <TableCell>
                            <Badge variant="outline" className={permCount > 0 ? "bg-emerald-50 text-emerald-700 border-emerald-100" : "text-slate-400"}>
                            {permCount}
                            </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-amber-600 hover:bg-amber-50" title="Gerenciar Módulos" onClick={() => { setSelectedUserForAccess(u); setTempUserModules(userPermissionsMap[u.id] || []); setAccessModalOpen(true); }}>
                                <Key className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-600 hover:bg-blue-50" onClick={() => { setFormData({ id: u.id, nome: u.nome_completo, email: u.email, cpf: formatCPF(u.cpf || ''), perfil_id: u.perfil_id.toString() }); setIsEditing(true); setDialogOpen(true); }}>
                                <Pencil className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" disabled={!canDel} className={cn("h-8 w-8", canDel ? "text-red-400 hover:bg-red-50" : "text-slate-200")} onClick={() => canDel && handleDelete(u)}>
                                <Trash2 className="h-4 w-4" />
                            </Button>
                            </div>
                        </TableCell>
                        </TableRow>
                    );
                    })
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* MODAL CRIAR/EDITAR (Igual) */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[450px]">
          <DialogHeader>
            <DialogTitle className="text-[#003B8F] flex items-center gap-2">
              <ShieldCheck className="w-5 h-5"/> {isEditing ? 'Atualizar Membro' : 'Novo Membro da Equipe'}
            </DialogTitle>
            <DialogDescription>
                O usuário receberá acesso ao se cadastrar/logar com este e-mail.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSaveUser} className="space-y-5 pt-2">
            <div className="space-y-2"><Label className="text-xs">Nome Completo</Label><Input value={formData.nome} onChange={e => setFormData({...formData, nome: e.target.value})} required /></div>
            <div className="space-y-2"><Label className="text-xs">E-mail Corporativo</Label><Input type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} required /></div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                  <Label className="text-xs">CPF <span className="text-slate-400 font-normal">(Opcional)</span></Label>
                  <Input 
                    value={formData.cpf} 
                    onChange={e => setFormData({...formData, cpf: formatCPF(e.target.value)})} 
                    placeholder="000.000.000-00" 
                    maxLength={14}
                  />
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Cargo Principal</Label>
                <Select value={formData.perfil_id} onValueChange={v => setFormData({...formData, perfil_id: v})}>
                  <SelectTrigger className="text-xs"><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {availableProfilesToCreate.map(p => (
                        <SelectItem key={p.id} value={p.id.toString()}>
                            {p.nome}
                        </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter className="pt-4"><Button type="submit" disabled={saving} className="bg-[#003B8F] w-full">{saving ? 'Salvando...' : 'Confirmar Dados'}</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* MODAL CSV (Igual) */}
      <Dialog open={csvModalOpen} onOpenChange={setCsvModalOpen}>
        <DialogContent className="sm:max-w-[600px]">
            <DialogHeader>
                <DialogTitle className="flex items-center gap-2"><Upload className="w-5 h-5"/> Mapeamento de CSV</DialogTitle>
                <DialogDescription>Associe as colunas. CPF é opcional.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label>Nome (Obrigatório)</Label>
                        <Select value={csvMapping.nome} onValueChange={v => setCsvMapping({...csvMapping, nome: v})}>
                            <SelectTrigger><SelectValue/></SelectTrigger>
                            <SelectContent>{csvHeaders.map(h => <SelectItem key={h} value={h}>{h}</SelectItem>)}</SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-2">
                        <Label>Email (Obrigatório)</Label>
                        <Select value={csvMapping.email} onValueChange={v => setCsvMapping({...csvMapping, email: v})}>
                            <SelectTrigger><SelectValue/></SelectTrigger>
                            <SelectContent>{csvHeaders.map(h => <SelectItem key={h} value={h}>{h}</SelectItem>)}</SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-2">
                        <Label>CPF (Opcional)</Label>
                        <Select value={csvMapping.cpf} onValueChange={v => setCsvMapping({...csvMapping, cpf: v})}>
                            <SelectTrigger><SelectValue placeholder="Não importar"/></SelectTrigger>
                            <SelectContent>{csvHeaders.map(h => <SelectItem key={h} value={h}>{h}</SelectItem>)}</SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-2">
                        <Label>Perfil para todos</Label>
                        <Select value={csvTargetProfile} onValueChange={setCsvTargetProfile}>
                            <SelectTrigger><SelectValue placeholder="Selecione perfil"/></SelectTrigger>
                            <SelectContent>{availableProfilesToCreate.map(p => <SelectItem key={p.id} value={p.id.toString()}>{p.nome}</SelectItem>)}</SelectContent>
                        </Select>
                    </div>
                </div>
                <div className="bg-slate-50 p-2 rounded text-xs text-slate-500">
                    Serão pré-cadastrados {csvRows.length} usuários.
                </div>
            </div>
            <DialogFooter>
                <Button onClick={processCsvImport} disabled={saving} className="bg-green-600 hover:bg-green-700 text-white w-full">Confirmar Importação</Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* OUTROS MODAIS (Acessos, Bulk) Mantidos */}
      <Dialog open={accessModalOpen} onOpenChange={setAccessModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Sistemas Disponíveis</DialogTitle></DialogHeader>
          <div className="py-4 space-y-2 max-h-[350px] overflow-y-auto border border-slate-100 rounded-lg p-3 bg-slate-50/50">
            {modules.map(mod => (
              <div key={mod.id} className="flex items-center space-x-3 p-3 rounded-md bg-white border border-slate-200 shadow-sm hover:border-[#003B8F] transition-colors">
                <Checkbox checked={tempUserModules.includes(mod.id)} onCheckedChange={(checked) => checked ? setTempUserModules(prev => [...prev, mod.id]) : setTempUserModules(prev => prev.filter(id => id !== mod.id))} />
                <span className="text-sm font-medium text-slate-700">{mod.nome}</span>
              </div>
            ))}
          </div>
          <DialogFooter><Button onClick={handleSaveAccess} disabled={saving} className="bg-[#003B8F] w-full">Salvar Acessos</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isBulkModalOpen} onOpenChange={setIsBulkModalOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Liberação de Acesso em Massa</DialogTitle></DialogHeader>
          <div className="py-4 space-y-2 max-h-[300px] overflow-y-auto border rounded-md p-2">
            {modules.map(mod => (
              <div key={mod.id} className="flex items-center space-x-3 p-3 hover:bg-slate-50 rounded-md cursor-pointer" onClick={() => selectedModulesToLink.includes(mod.id) ? setSelectedModulesToLink(prev => prev.filter(id => id !== mod.id)) : setSelectedModulesToLink(prev => [...prev, mod.id])}>
                <Checkbox checked={selectedModulesToLink.includes(mod.id)} />
                <span className="text-sm font-medium">{mod.nome}</span>
              </div>
            ))}
          </div>
          <DialogFooter><Button onClick={handleBulkLink} disabled={saving || !selectedModulesToLink.length} className="bg-[#003B8F] w-full">Confirmar Vínculos</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// --- COMPONENTE DE FILTRO (ATUALIZADO PARA CPF E OUTROS CAMPOS) ---
function ColumnFilter({ title, field, data, selectedValues = [], onChange }: any) {
    const options = useMemo(() => {
        const unique = new Set<string>();
        data.forEach((item: any) => {
            let val = '';
            if (field === 'perfis') val = item.perfis?.nome || 'Sem Cargo';
            else if (field === 'cpf') val = item.cpf ? formatCPF(item.cpf) : 'Sem CPF'; // Exibe formatado
            else val = item[field];
            
            if (val) unique.add(String(val));
        });
        return Array.from(unique).sort();
    }, [data, field]);

    const isFiltered = selectedValues.length > 0;

    return (
        <Popover>
            <PopoverTrigger asChild>
                <Button variant="ghost" size="sm" className={cn("-ml-3 h-8 data-[state=open]:bg-slate-100", isFiltered && "bg-blue-50 text-blue-600")}>
                    <span>{title}</span>
                    {isFiltered ? <Filter className="ml-2 h-4 w-4 fill-blue-600" /> : <Filter className="ml-2 h-3 w-3 text-slate-400" />}
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[200px] p-0" align="start">
                <Command>
                    <CommandInput placeholder={`Buscar ${title}...`} />
                    <CommandList>
                        <CommandEmpty>Vazio.</CommandEmpty>
                        <CommandGroup>
                            {options.map((option) => {
                                const isSelected = selectedValues.includes(option);
                                return (
                                    <CommandItem key={option} onSelect={() => onChange(isSelected ? selectedValues.filter((v: string) => v !== option) : [...selectedValues, option])}>
                                        <div className={cn("mr-2 flex h-4 w-4 items-center justify-center rounded-sm border border-primary", isSelected ? "bg-primary text-primary-foreground" : "opacity-50 [&_svg]:invisible")}>
                                            <Check className={cn("h-4 w-4")} />
                                        </div>
                                        <span className="truncate">{option}</span>
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