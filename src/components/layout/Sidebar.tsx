import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard,
  Database,
  Settings,
  LogOut,
  ChevronLeft,
  FileText,
  Users,
  CheckCircle,
  Plus,
  Menu,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { CrudModule } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

const iconMap: Record<string, any> = {
  FileText,
  Users,
  Database,
  Settings,
  CheckCircle,
};

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const [modules, setModules] = useState<CrudModule[]>([]);
  const location = useLocation();
  const { profile, signOut } = useAuth();

  useEffect(() => {
    fetchModules();
  }, []);

  const fetchModules = async () => {
    const { data } = await supabase
      .from('crud_modules')
      .select('*')
      .eq('is_active', true)
      .order('name');
    
    if (data) setModules(data as CrudModule[]);
  };

  const isActive = (path: string) => location.pathname === path;

  const getIcon = (iconName: string) => {
    const Icon = iconMap[iconName] || FileText;
    return Icon;
  };

  const navItems = [
    { path: '/', icon: LayoutDashboard, label: 'Dashboard' },
    { path: '/modulos', icon: Database, label: 'Módulos CRUD' },
    { path: '/aprovacoes', icon: CheckCircle, label: 'Aprovações' },
  ];

  return (
    <>
      {/* Mobile Menu Button */}
      <Button
        variant="ghost"
        size="icon"
        className="fixed top-4 left-4 z-50 lg:hidden"
        onClick={() => setCollapsed(!collapsed)}
      >
        <Menu className="h-5 w-5" />
      </Button>

      {/* Overlay for mobile */}
      <AnimatePresence>
        {!collapsed && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-40 lg:hidden"
            onClick={() => setCollapsed(true)}
          />
        )}
      </AnimatePresence>

      <motion.aside
        initial={false}
        animate={{ width: collapsed ? 0 : 280 }}
        className={cn(
          "fixed left-0 top-0 h-screen bg-sidebar z-50 flex flex-col overflow-hidden",
          "lg:relative lg:w-72",
          collapsed && "lg:w-20"
        )}
      >
        {/* Header */}
        <div className="p-6 border-b border-sidebar-border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-sidebar-accent flex items-center justify-center">
              <span className="text-xl font-bold text-sidebar-foreground">PV</span>
            </div>
            <AnimatePresence>
              {!collapsed && (
                <motion.div
                  initial={{ opacity: 0, width: 0 }}
                  animate={{ opacity: 1, width: 'auto' }}
                  exit={{ opacity: 0, width: 0 }}
                  className="overflow-hidden"
                >
                  <h1 className="font-bold text-sidebar-foreground whitespace-nowrap">
                    Prefeitura
                  </h1>
                  <p className="text-xs text-sidebar-foreground/60 whitespace-nowrap">
                    Porto Velho - RO
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          <div className="space-y-1">
            {navItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  "sidebar-link",
                  isActive(item.path) && "sidebar-link-active"
                )}
              >
                <item.icon className="h-5 w-5 shrink-0" />
                <AnimatePresence>
                  {!collapsed && (
                    <motion.span
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="whitespace-nowrap"
                    >
                      {item.label}
                    </motion.span>
                  )}
                </AnimatePresence>
              </Link>
            ))}
          </div>

          {modules.length > 0 && (
            <>
              <div className="pt-4 pb-2">
                {!collapsed && (
                  <p className="text-xs font-semibold text-sidebar-foreground/50 uppercase tracking-wider px-4">
                    Módulos Ativos
                  </p>
                )}
              </div>
              <div className="space-y-1">
                {modules.map((module) => {
                  const Icon = getIcon(module.icon);
                  return (
                    <Link
                      key={module.id}
                      to={`/crud/${module.slug}`}
                      className={cn(
                        "sidebar-link",
                        isActive(`/crud/${module.slug}`) && "sidebar-link-active"
                      )}
                    >
                      <Icon className="h-5 w-5 shrink-0" />
                      <AnimatePresence>
                        {!collapsed && (
                          <motion.span
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="whitespace-nowrap truncate"
                          >
                            {module.name}
                          </motion.span>
                        )}
                      </AnimatePresence>
                    </Link>
                  );
                })}
              </div>
            </>
          )}

          <div className="pt-4">
            <Link
              to="/modulos/novo"
              className="sidebar-link text-sidebar-foreground/70 hover:text-sidebar-foreground"
            >
              <Plus className="h-5 w-5 shrink-0" />
              <AnimatePresence>
                {!collapsed && (
                  <motion.span
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="whitespace-nowrap"
                  >
                    Novo Módulo
                  </motion.span>
                )}
              </AnimatePresence>
            </Link>
          </div>
        </nav>

        {/* User Section */}
        <div className="p-4 border-t border-sidebar-border">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-sidebar-accent flex items-center justify-center shrink-0">
              <span className="text-sm font-medium text-sidebar-foreground">
                {profile?.full_name?.charAt(0).toUpperCase() || 'U'}
              </span>
            </div>
            <AnimatePresence>
              {!collapsed && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex-1 min-w-0"
                >
                  <p className="text-sm font-medium text-sidebar-foreground truncate">
                    {profile?.full_name || 'Usuário'}
                  </p>
                  <p className="text-xs text-sidebar-foreground/60 capitalize">
                    {profile?.role || 'user'}
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
            <Button
              variant="ghost"
              size="icon"
              onClick={signOut}
              className="text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent shrink-0"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Collapse Button - Desktop only */}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setCollapsed(!collapsed)}
          className="absolute -right-3 top-8 hidden lg:flex w-6 h-6 rounded-full bg-sidebar border border-sidebar-border shadow-md hover:bg-sidebar-accent"
        >
          <ChevronLeft className={cn("h-4 w-4 transition-transform", collapsed && "rotate-180")} />
        </Button>
      </motion.aside>
    </>
  );
}
