import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { User as UserIcon, Lock, Mail, Loader2, Save, ShieldCheck, LayoutGrid } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

export default function Profile() {
  const { user, profile, role } = useAuth();
  const [loading, setLoading] = useState(false);
  
  const [fullName, setFullName] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  // Lista de sistemas vinculados ao usuário
  const [myModules, setMyModules] = useState<any[]>([]);

  useEffect(() => {
    if (profile?.full_name) setFullName(profile.full_name);
    fetchMyAccess();
  }, [profile]);

  const fetchMyAccess = async () => {
      if(!profile) return;
      if (role === 'administrador') return; // Admin tem acesso a tudo, não precisa listar

      const { data } = await supabase
        .from('profile_modules')
        .select('crud_modules (name, description)')
        .eq('profile_id', profile.id);
      
      // CORREÇÃO AQUI: Filtramos itens nulos antes de salvar no estado
      const modules = data
        ?.map((item: any) => item.crud_modules)
        .filter((mod: any) => mod !== null) || []; // Remove nulos
      
      setMyModules(modules);
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.from('profiles').update({ full_name: fullName }).eq('id', profile?.id);
      if (error) throw error;
      toast.success('Perfil atualizado com sucesso!');
    } catch (error: any) { toast.error('Erro ao atualizar: ' + error.message); } 
    finally { setLoading(false); }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) return toast.error('Senhas não conferem.');
    if (newPassword.length < 6) return toast.error('Mínimo 6 caracteres.');

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      toast.success('Senha alterada!');
      setCurrentPassword(''); setNewPassword(''); setConfirmPassword('');
    } catch (error: any) { toast.error(error.message); } 
    finally { setLoading(false); }
  };

  return (
      <div className="max-w-4xl mx-auto pb-20 pt-6 animate-in fade-in">
        <h1 className="text-3xl font-bold mb-2 text-slate-900">Meu Perfil</h1>
        <p className="text-slate-500 mb-8">Gerencie suas informações e veja seus níveis de acesso.</p>

        <div className="grid gap-6 md:grid-cols-[1fr_300px]">
            {/* Coluna Principal: Forms */}
            <Tabs defaultValue="general" className="w-full">
                <TabsList className="grid w-full grid-cols-2 lg:w-[400px]">
                    <TabsTrigger value="general">Geral</TabsTrigger>
                    <TabsTrigger value="security">Segurança</TabsTrigger>
                </TabsList>

                <TabsContent value="general" className="space-y-6 mt-6">
                    <Card>
                        <CardHeader><CardTitle>Informações Pessoais</CardTitle><CardDescription>Dados visíveis no sistema.</CardDescription></CardHeader>
                        <CardContent>
                            <form onSubmit={handleUpdateProfile} className="space-y-4">
                                <div className="space-y-2">
                                    <Label>Nome Completo</Label>
                                    <div className="relative">
                                        <UserIcon className="absolute left-3 top-2.5 h-5 w-5 text-slate-400" />
                                        <Input value={fullName} onChange={(e) => setFullName(e.target.value)} className="pl-10" />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Label>E-mail (Login)</Label>
                                    <div className="relative">
                                        <Mail className="absolute left-3 top-2.5 h-5 w-5 text-slate-400" />
                                        <Input value={user?.email} disabled className="pl-10 bg-slate-50 text-slate-500" />
                                    </div>
                                </div>
                                <Button type="submit" disabled={loading} className="bg-[#003B8F]">{loading ? <Loader2 className="animate-spin mr-2 h-4 w-4"/> : <Save className="mr-2 h-4 w-4"/>} Salvar</Button>
                            </form>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="security" className="mt-6">
                    <Card>
                        <CardHeader><CardTitle>Trocar Senha</CardTitle><CardDescription>Defina uma nova senha de acesso.</CardDescription></CardHeader>
                        <CardContent>
                            <form onSubmit={handleChangePassword} className="space-y-4">
                                <div className="space-y-2">
                                    <Label>Nova Senha</Label>
                                    <div className="relative"><Lock className="absolute left-3 top-2.5 h-5 w-5 text-slate-400" /><Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="pl-10" required /></div>
                                </div>
                                <div className="space-y-2">
                                    <Label>Confirmar Senha</Label>
                                    <div className="relative"><Lock className="absolute left-3 top-2.5 h-5 w-5 text-slate-400" /><Input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="pl-10" required /></div>
                                </div>
                                <Button type="submit" variant="destructive" disabled={loading}>Redefinir Senha</Button>
                            </form>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>

            {/* Coluna Lateral: Permissões */}
            <div className="space-y-6">
                <Card className="bg-slate-50 border-slate-200">
                    <CardHeader className="pb-3">
                        <div className="flex items-center gap-2">
                            <ShieldCheck className="h-5 w-5 text-[#003B8F]" />
                            <CardTitle className="text-base">Permissões</CardTitle>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="mb-4">
                            <span className="text-xs font-bold text-slate-400 uppercase">Função Atual</span>
                            <div className="mt-1"><Badge className="bg-blue-100 text-blue-700 hover:bg-blue-200">{role?.toUpperCase() || 'USUÁRIO'}</Badge></div>
                        </div>
                        
                        <div>
                            <span className="text-xs font-bold text-slate-400 uppercase mb-2 block">Sistemas Liberados</span>
                            {role === 'administrador' ? (
                                <p className="text-sm text-slate-600 italic">Acesso total a todos os sistemas.</p>
                            ) : myModules.length > 0 ? (
                                <ul className="space-y-2">
                                    {myModules.map((m: any, i) => (
                                        // CORREÇÃO AQUI: Verificamos se 'm' existe antes de renderizar
                                        m ? (
                                            <li key={i} className="flex items-center gap-2 text-sm text-slate-700 bg-white p-2 rounded border border-slate-100">
                                                <LayoutGrid className="h-3 w-3 text-slate-400" /> {m?.name || 'Sem nome'}
                                            </li>
                                        ) : null
                                    ))}
                                </ul>
                            ) : (
                                <p className="text-sm text-slate-500 italic">Nenhum sistema vinculado.</p>
                            )}
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
      </div>
  );
}