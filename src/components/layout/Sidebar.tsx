import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  LayoutDashboard, 
  FolderOpen, 
  ClipboardList, 
  PlusCircle, 
  ChevronLeft, 
  ChevronRight, 
  LogOut, 
  UserCircle, 
  Users, 
  History
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  
  const { userData, signOut, role } = useAuth();
  
  const isActive = (path: string) => location.pathname === path;

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  const navItems = [
    { path: '/', icon: LayoutDashboard, label: 'Painel Principal' },
    { path: '/modulos', icon: FolderOpen, label: 'Sistemas de Dados' },
  ];

  // Aprovações: Visível para todos, mas com labels diferentes (Funcionário vê 'Solicitações')
  if (role && ['SUPERVISOR', 'FUNCIONARIO', 'ADMINISTRADOR'].includes(role)) {
    navItems.push({ 
        path: '/aprovacoes', 
        icon: ClipboardList, 
        label: role === 'SUPERVISOR' || role === 'ADMINISTRADOR' ? 'Aprovações Pendentes' : 'Minhas Solicitações' 
    });
  }

  // Gestão de Equipe: ESTRITAMENTE Admin e Supervisor
  if (role === 'ADMINISTRADOR' || role === 'SUPERVISOR') {
      navItems.push({ 
          path: '/equipe', 
          icon: Users, 
          label: 'Gestão de Equipe' 
      });
  }

  // Auditoria: Somente Admin
  if (role === 'ADMINISTRADOR') {
      navItems.push({
          path: '/auditoria',
          icon: History,
          label: 'Auditoria e Logs'
      });
  }

  return (
    <TooltipProvider delayDuration={0}>
      <motion.aside 
        initial={false} 
        animate={{ width: collapsed ? 80 : 270 }} 
        className="relative h-screen bg-gradient-to-b from-[#003B8F] to-[#002050] text-white flex flex-col border-r border-white/5 z-20 shadow-2xl transition-all duration-300"
      >
        {/* Header Branding */}
        <div className={cn("flex items-center h-24 transition-all overflow-hidden mb-2", collapsed ? "justify-center px-0" : "px-6")}>
          <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center p-1 shadow-lg shrink-0">
                <img src="https://www.portovelho.ro.gov.br/logo/Brasao_municipal.svg" alt="Brasão" className="w-full h-full object-contain"/>
              </div>
              {!collapsed && (
                <div className="flex flex-col min-w-[140px] animate-in fade-in duration-300 whitespace-nowrap">
                  <h1 className="font-bold text-lg leading-none text-white tracking-tight">SMTI</h1>
                  <p className="text-[10px] text-yellow-400 font-bold uppercase tracking-widest mt-1">Prefeitura PVH</p>
                </div>
              )}
          </div>
        </div>

        {/* Menu de Navegação */}
        <nav className="flex-1 py-4 px-3 space-y-2 overflow-y-auto overflow-x-hidden scrollbar-thin scrollbar-thumb-white/10 flex flex-col">
          {navItems.map((item) => {
            const active = isActive(item.path);
            return (
              <Tooltip key={item.path}>
                <TooltipTrigger asChild>
                  <Link 
                    to={item.path} 
                    className={cn(
                      "flex items-center rounded-xl transition-all duration-200 group border min-h-[50px] relative overflow-hidden", 
                      collapsed ? "justify-center w-full px-0" : "px-3 gap-3 w-full",
                      active 
                        ? "bg-white/10 text-yellow-400 border-white/5 shadow-inner" 
                        : "border-transparent text-white/70 hover:bg-white/5 hover:text-white"
                    )}
                  >
                    {active && !collapsed && (
                        <div className="absolute left-0 top-0 bottom-0 w-1 bg-yellow-400 rounded-l-md" />
                    )}
                    
                    <item.icon className={cn(
                        "h-6 w-6 shrink-0 transition-transform duration-300", 
                        active ? "text-yellow-400 scale-110" : "group-hover:text-white"
                    )} />
                    
                    {!collapsed && <span className="whitespace-nowrap text-sm font-medium">{item.label}</span>}
                  </Link>
                </TooltipTrigger>
                {collapsed && (
                  <TooltipContent side="right" className="bg-[#002050] text-white border-white/10 font-medium ml-2 shadow-xl z-50">
                    {item.label}
                  </TooltipContent>
                )}
              </Tooltip>
            );
          })}
          
          <div className="my-4 border-t border-white/10 mx-2" />

          {/* Botão de Criação de Módulos (Apenas Admin) */}
          {role === 'ADMINISTRADOR' && (
            <div className={cn("px-0", !collapsed && "px-0")}>
               {!collapsed && <p className="text-[10px] uppercase text-white/40 font-bold mb-3 px-2 whitespace-nowrap tracking-wider">Administração</p>}
               
               <Tooltip>
                 <TooltipTrigger asChild>
                   <Link to="/modulos/novo" className={cn(
                     "flex items-center rounded-xl text-white hover:bg-green-600 transition-all bg-green-700 shadow-lg shadow-black/20 min-h-[48px]",
                     collapsed ? "justify-center w-full px-0" : "px-3 gap-3 w-full"
                   )}>
                     <PlusCircle className="h-6 w-6 shrink-0" />
                     {!collapsed && <span className="font-bold text-sm whitespace-nowrap">Novo Sistema</span>}
                   </Link>
                 </TooltipTrigger>
                 {collapsed && <TooltipContent side="right" className="bg-green-800 text-white border-0 ml-2 font-bold z-50">Criar Módulo</TooltipContent>}
               </Tooltip>
            </div>
          )}
        </nav>

        {/* Footer do Usuário */}
        <div className="mt-auto p-0 bg-[#001835] border-t border-white/5">
            <div className={cn("flex items-center transition-all p-4", collapsed ? "justify-center" : "gap-3")}>
              
              <div onClick={() => navigate('/perfil')} className="w-10 h-10 rounded-full bg-yellow-400 text-[#003B8F] font-bold flex items-center justify-center cursor-pointer hover:ring-2 hover:ring-white transition-all shrink-0 shadow-md relative group">
                {userData?.nome_completo ? userData.nome_completo.charAt(0).toUpperCase() : <UserCircle className="h-6 w-6"/>}
                <span className={cn(
                    "absolute bottom-0 right-0 w-3 h-3 border-2 border-[#001835] rounded-full",
                    userData?.is_ativo ? "bg-green-500" : "bg-red-500"
                )}></span>
              </div>
              
              {!collapsed && (
                <div className="flex-1 min-w-0 flex flex-col justify-center">
                  <p className="text-xs font-bold text-white truncate cursor-pointer hover:text-yellow-400 transition-colors" onClick={() => navigate('/perfil')} title={userData?.nome_completo}>
                    {userData?.nome_completo ? userData.nome_completo.split(' ')[0] : <span className="opacity-50 italic">Carregando...</span>}
                  </p>
                  
                  <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="text-[9px] bg-white/10 px-1.5 py-0.5 rounded text-blue-200 font-medium tracking-wide">
                        {role || 'Visitante'}
                      </span>
                  </div>

                  <button onClick={handleSignOut} className="text-[10px] text-white/40 hover:text-red-400 flex items-center gap-1 mt-1.5 transition-colors w-fit font-medium hover:underline">
                    <LogOut className="h-3 w-3"/> Sair
                  </button>
                </div>
              )}
            </div>
        </div>

        {/* Botão de Toggle */}
        <button 
          onClick={() => setCollapsed(!collapsed)} 
          className="absolute -right-3 top-24 w-7 h-7 bg-yellow-400 border-2 border-[#003B8F] rounded-full flex items-center justify-center text-[#003B8F] shadow-lg hover:scale-110 transition-all focus:outline-none z-50"
        >
           {collapsed ? <ChevronRight className="h-4 w-4 stroke-[3]" /> : <ChevronLeft className="h-4 w-4 stroke-[3]" />}
        </button>
      </motion.aside>
    </TooltipProvider>
  );
}