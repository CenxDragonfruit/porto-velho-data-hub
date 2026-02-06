import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { User as UserIcon, Lock, Mail, Loader2, Save, ShieldCheck, LayoutGrid, KeyRound } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

export default function Profile() {
  const { userData, role, user } = useAuth(); // Usando userData do contexto atualizado
  const [loading, setLoading] = useState(false);
  
  // Estados do Formulário
  const [fullName, setFullName] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  // Lista de sistemas vinculados (RF-003)
  const [myModules, setMyModules] = useState<any[]>([]);

  useEffect(() => {
    if (userData) {
        setFullName(userData.nome_completo || '');
        fetchMyAccess();
    }
  }, [userData]);

  // Busca os módulos que o usuário tem permissão de visualizar
  const fetchMyAccess = async () => {
      if (!userData) return;
      
      // Se for ADMIN, ele vê tudo, mas aqui listamos o que está explicitamente vinculado
      // ou podemos mostrar uma mensagem de "Acesso Total".
      if (role === 'ADMINISTRADOR') return; 

      try {
          const { data, error } = await supabase
            .from('permissoes_modulo')
            .select(`
                modulo_id,
                modulos (
                    id,
                    nome,
                    descricao
                )
            `)
            .eq('usuario_id', userData.id)
            .eq('pode_visualizar', true)
            .eq('modulos.ativo', true); // Apenas módulos ativos

          if (error) throw error;
          
          // Filtra e mapeia os dados para evitar nulos
          const modules = data
            ?.map((item: any) => item.modulos)
            .filter((mod: any) => mod !== null) || [];
          
          setMyModules(modules);
      } catch (err) {
          console.error("Erro ao buscar módulos:", err);
      }
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      // Atualiza na tabela de negócio 'usuarios'
      const { error } = await supabase
        .from('usuarios')
        .update({ nome_completo: fullName })
        .eq('id', userData?.id);

      if (error) throw error;
      
      // Opcional: Se quiser atualizar o metadado do Auth também (não obrigatório, mas bom para consistência)
      // await supabase.auth.updateUser({ data: { nome_completo: fullName } });

      toast.success('Perfil atualizado com sucesso!');
    } catch (error: any) { 
        toast.error('Erro ao atualizar: ' + error.message); 
    } finally { 
        setLoading(false); 
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) return toast.error('Senhas não conferem.');
    if (newPassword.length < 6) return toast.error('A senha deve ter no mínimo 6 caracteres.');

    setLoading(true);
    try {
      // Atualiza a senha no Supabase Auth (Segurança NF-001)
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      
      if (error) throw error;
      
      toast.success('Senha alterada com sucesso!');
      setCurrentPassword(''); 
      setNewPassword(''); 
      setConfirmPassword('');
    } catch (error: any) { 
        toast.error('Erro ao alterar senha: ' + error.message); 
    } finally { 
        setLoading(false); 
    }
  };

  return (
      <div className="max-w-5xl mx-auto pb-20 pt-8 animate-in fade-in px-4">
        <div className="flex items-center gap-3 mb-2">
            <div className="p-3 bg-blue-50 rounded-full">
                <UserIcon className="w-6 h-6 text-[#003B8F]" />
            </div>
            <div>
                <h1 className="text-2xl font-bold text-slate-900">Meu Perfil</h1>
                <p className="text-slate-500 text-sm">Gerencie suas informações pessoais e credenciais.</p>
            </div>
        </div>

        <div className="grid gap-8 lg:grid-cols-[1fr_320px] mt-8">
            
            {/* COLUNA PRINCIPAL */}
            <Tabs defaultValue="general" className="w-full">
                <TabsList className="grid w-full grid-cols-2 lg:w-[400px] mb-6">
                    <TabsTrigger value="general">Dados Pessoais</TabsTrigger>
                    <TabsTrigger value="security">Segurança</TabsTrigger>
                </TabsList>

                <TabsContent value="general" className="space-y-6">
                    <Card className="border-slate-200 shadow-sm">
                        <CardHeader className="pb-4 border-b bg-slate-50/50">
                            <CardTitle className="text-base flex items-center gap-2">
                                <UserIcon className="w-4 h-4 text-slate-500"/> Informações Básicas
                            </CardTitle>
                            <CardDescription>Estes dados são visíveis para administradores do sistema.</CardDescription>
                        </CardHeader>
                        <CardContent className="pt-6">
                            <form onSubmit={handleUpdateProfile} className="space-y-5">
                                <div className="grid gap-2">
                                    <Label htmlFor="name">Nome Completo</Label>
                                    <div className="relative">
                                        <UserIcon className="absolute left-3 top-2.5 h-5 w-5 text-slate-400" />
                                        <Input id="name" value={fullName} onChange={(e) => setFullName(e.target.value)} className="pl-10 h-11" />
                                    </div>
                                </div>
                                
                                <div className="grid gap-2">
                                    <Label>E-mail Corporativo</Label>
                                    <div className="relative">
                                        <Mail className="absolute left-3 top-2.5 h-5 w-5 text-slate-400" />
                                        <Input value={userData?.email || user?.email} disabled className="pl-10 h-11 bg-slate-100 text-slate-500 border-slate-200 cursor-not-allowed" />
                                    </div>
                                    <p className="text-[11px] text-slate-400">O e-mail não pode ser alterado. Contate o suporte se necessário.</p>
                                </div>

                                <div className="flex justify-end pt-2">
                                    <Button type="submit" disabled={loading} className="bg-[#003B8F] hover:bg-blue-800 min-w-[140px]">
                                        {loading ? <Loader2 className="animate-spin mr-2 h-4 w-4"/> : <Save className="mr-2 h-4 w-4"/>} 
                                        Salvar Dados
                                    </Button>
                                </div>
                            </form>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="security">
                    <Card className="border-slate-200 shadow-sm">
                        <CardHeader className="pb-4 border-b bg-slate-50/50">
                            <CardTitle className="text-base flex items-center gap-2">
                                <KeyRound className="w-4 h-4 text-slate-500"/> Alterar Senha
                            </CardTitle>
                            <CardDescription>Recomendamos o uso de senhas fortes com no mínimo 6 caracteres.</CardDescription>
                        </CardHeader>
                        <CardContent className="pt-6">
                            <form onSubmit={handleChangePassword} className="space-y-5">
                                <div className="grid gap-2">
                                    <Label htmlFor="new-pass">Nova Senha</Label>
                                    <div className="relative">
                                        <Lock className="absolute left-3 top-2.5 h-5 w-5 text-slate-400" />
                                        <Input id="new-pass" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="pl-10 h-11" required />
                                    </div>
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="confirm-pass">Confirmar Nova Senha</Label>
                                    <div className="relative">
                                        <Lock className="absolute left-3 top-2.5 h-5 w-5 text-slate-400" />
                                        <Input id="confirm-pass" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="pl-10 h-11" required />
                                    </div>
                                </div>
                                <div className="flex justify-end pt-2">
                                    <Button type="submit" variant="destructive" disabled={loading} className="min-w-[140px]">
                                        {loading ? <Loader2 className="animate-spin mr-2 h-4 w-4"/> : <Save className="mr-2 h-4 w-4"/>} 
                                        Atualizar Senha
                                    </Button>
                                </div>
                            </form>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>

            {/* COLUNA LATERAL - INFO DE ACESSO */}
            <div className="space-y-6">
                <Card className="bg-gradient-to-br from-white to-slate-50 border-slate-200 shadow-sm">
                    <CardHeader className="pb-4 border-b">
                        <div className="flex items-center gap-2 text-[#003B8F]">
                            <ShieldCheck className="h-5 w-5" />
                            <CardTitle className="text-base font-bold">Suas Credenciais</CardTitle>
                        </div>
                    </CardHeader>
                    <CardContent className="pt-6 space-y-6">
                        <div>
                            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-2">Perfil de Acesso</span>
                            <Badge className={`px-3 py-1 text-sm font-semibold ${role === 'ADMINISTRADOR' ? 'bg-[#003B8F] text-white hover:bg-blue-800' : 'bg-green-100 text-green-700 hover:bg-green-200 border-green-200'}`}>
                                {role || 'Carregando...'}
                            </Badge>
                        </div>
                        
                        <div>
                            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-3">Módulos Liberados</span>
                            
                            {role === 'ADMINISTRADOR' ? (
                                <div className="p-3 bg-blue-50 border border-blue-100 rounded-lg text-sm text-blue-700">
                                    <p className="font-medium">Acesso Irrestrito</p>
                                    <p className="text-xs opacity-80 mt-1">Como administrador, você tem acesso total a todos os sistemas.</p>
                                </div>
                            ) : myModules.length > 0 ? (
                                <ul className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                                    {myModules.map((m: any) => (
                                        <li key={m.id} className="flex items-center gap-2.5 text-sm text-slate-700 bg-white p-2.5 rounded-lg border border-slate-200 shadow-sm hover:border-blue-300 transition-colors">
                                            <div className="p-1.5 bg-blue-50 rounded text-blue-600"><LayoutGrid className="h-3.5 w-3.5" /></div>
                                            <span className="font-medium">{m.nome}</span>
                                        </li>
                                    ))}
                                </ul>
                            ) : (
                                <div className="text-center p-6 bg-slate-50 rounded-lg border border-dashed border-slate-200">
                                    <p className="text-sm text-slate-500 italic">Nenhum sistema vinculado.</p>
                                    <p className="text-xs text-slate-400 mt-1">Solicite acesso ao seu supervisor.</p>
                                </div>
                            )}
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
      </div>
  );
}