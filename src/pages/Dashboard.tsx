import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { FileText, Clock, CheckCircle2, LayoutGrid, ArrowUpRight, Activity, Filter, Database } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { format, subDays, isSameDay, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function Dashboard() {
  const [stats, setStats] = useState({ total: 0, active_systems: 0, pending: 0, approved: 0 });
  const [chartData, setChartData] = useState<any[]>([]);
  const [recentActivity, setRecentActivity] = useState<any[]>([]);
  const [modulesList, setModulesList] = useState<any[]>([]);
  const [selectedModule, setSelectedModule] = useState<string>('all');
  const [loading, setLoading] = useState(true);

  // 1. Carregar lista de módulos para o filtro
  useEffect(() => {
    const fetchModules = async () => {
      const { data } = await supabase
        .from('modulos')
        .select('id, nome')
        .eq('ativo', true)
        .order('nome');
      setModulesList(data || []);
    };
    fetchModules();
  }, []);

  // 2. Carregar Dados do Dashboard quando o filtro mudar
  useEffect(() => {
    fetchDashboardData();
  }, [selectedModule]);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const moduleId = selectedModule === 'all' ? null : Number(selectedModule);

      // --- HELPER: CONTAGEM OTIMIZADA ---
      const getCount = async (status?: 'PENDENTE' | 'OFICIAL' | 'RASCUNHO') => {
        // Se filtramos por módulo, precisamos fazer o JOIN com registros_mestre
        let query = supabase
            .from('versoes_registro')
            .select(moduleId ? 'id, registros_mestre!inner(modulo_id)' : 'id', { count: 'exact', head: true })
            .eq('is_atual', true);

        if (status) {
            query = query.eq('status', status);
        }

        if (moduleId) {
            query = query.eq('registros_mestre.modulo_id', moduleId);
        }

        const { count, error } = await query;
        if (error) throw error;
        return count || 0;
      };

      // 1. EXECUÇÃO DAS CONTAGENS (Paralelo para performance)
      const [total, pending, approved] = await Promise.all([
        getCount(),              // Total de registros ativos
        getCount('PENDENTE'),    // Pendentes de aprovação
        getCount('OFICIAL')      // Registros oficiais
      ]);
      
      // Contagem de sistemas
      let systemsCount = 0;
      if (moduleId) {
        systemsCount = 1;
      } else {
        const { count } = await supabase
            .from('modulos')
            .select('*', { count: 'exact', head: true })
            .eq('ativo', true);
        systemsCount = count || 0;
      }

      // 2. ATIVIDADE RECENTE (JOIN COMPLETO)
      // Buscamos: Versão -> Mestre -> Módulo (para pegar o nome do sistema)
      let recentQuery = supabase
        .from('versoes_registro')
        .select(`
            id, 
            status, 
            criado_em, 
            registros_mestre!inner ( 
                modulos ( nome ) 
            )
        `)
        .order('criado_em', { ascending: false })
        .limit(5);
      
      if (moduleId) {
        recentQuery = recentQuery.eq('registros_mestre.modulo_id', moduleId);
      }

      // 3. DADOS DO GRÁFICO (Últimos 7 dias)
      const sevenDaysAgo = subDays(new Date(), 7).toISOString();
      let chartQuery = supabase
        .from('versoes_registro')
        .select('criado_em, registros_mestre!inner(modulo_id)')
        .gte('criado_em', sevenDaysAgo);

      if (moduleId) {
        chartQuery = chartQuery.eq('registros_mestre.modulo_id', moduleId);
      }

      // --- FINALIZAR PROMISES DE DADOS ---
      const [{ data: recent }, { data: chartRaw }] = await Promise.all([
        recentQuery,
        chartQuery
      ]);

      // --- PROCESSAMENTO DO GRÁFICO (JS) ---
      // Agrupa os dados por dia
      const days = Array.from({ length: 7 }, (_, i) => subDays(new Date(), 6 - i));
      const processedChart = days.map(day => {
        const count = (chartRaw || []).filter((r: any) => isSameDay(parseISO(r.criado_em), day)).length;
        return { name: format(day, 'dd/MM'), registros: count };
      });

      // --- ATUALIZA ESTADOS ---
      setStats({ 
        total: total || 0, 
        active_systems: systemsCount || 0, 
        pending: pending || 0, 
        approved: approved || 0 
      });
      
      setRecentActivity(recent || []);
      setChartData(processedChart);

    } catch (error) { 
      console.error("Erro ao carregar dashboard:", error); 
    } finally { 
      setLoading(false); 
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      
      {/* HEADER + FILTRO */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Visão Geral</h1>
          <p className="text-sm text-slate-500">
            {selectedModule === 'all' 
              ? 'Acompanhe as métricas consolidada de todos os sistemas.' 
              : 'Visualizando dados filtrados especificamente por sistema.'}
          </p>
        </div>
        
        <div className="w-full md:w-[280px]">
          <Select value={selectedModule} onValueChange={setSelectedModule}>
            <SelectTrigger className="bg-white border-slate-200 shadow-sm h-10 focus:ring-[#003B8F]">
              <div className="flex items-center gap-2 text-slate-700">
                <Filter className="h-4 w-4 text-[#003B8F]" />
                <SelectValue placeholder="Filtrar por Sistema" />
              </div>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="font-medium text-[#003B8F]">Todos os Sistemas</SelectItem>
              {modulesList.map(mod => (
                <SelectItem key={mod.id} value={mod.id.toString()}>{mod.nome}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* STATS CARDS */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatsCard title="Registros Ativos" value={stats.total} icon={FileText} loading={loading} />
        <StatsCard title="Sistemas Monitorados" value={stats.active_systems} icon={LayoutGrid} loading={loading} />
        <StatsCard title="Pendentes (Análise)" value={stats.pending} icon={Clock} loading={loading} highlight />
        <StatsCard title="Dados Oficiais" value={stats.approved} icon={CheckCircle2} loading={loading} />
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-7">
        
        {/* GRÁFICO DE ENTRADA */}
        <Card className="lg:col-span-4 border border-slate-200 shadow-sm rounded-xl overflow-hidden bg-white">
          <CardHeader className="pb-2 border-b border-slate-50">
            <CardTitle className="text-base font-semibold text-slate-800 flex items-center gap-2">
                <Activity className="h-4 w-4 text-[#003B8F]" /> Fluxo de Entrada de Dados (7 dias)
            </CardTitle>
          </CardHeader>
          <CardContent className="pl-0 pt-6 pr-4">
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorBlue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#003B8F" stopOpacity={0.1}/>
                      <stop offset="95%" stopColor="#003B8F" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9"/>
                  <XAxis dataKey="name" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} dy={10} />
                  <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} allowDecimals={false} dx={-10} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                    cursor={{ stroke: '#cbd5e1', strokeWidth: 1, strokeDasharray: '4 4' }}
                  />
                  <Area type="monotone" dataKey="registros" stroke="#003B8F" strokeWidth={2} fill="url(#colorBlue)" activeDot={{ r: 6, fill: "#003B8F", strokeWidth: 0 }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* ATIVIDADE RECENTE */}
        <Card className="lg:col-span-3 border border-slate-200 shadow-sm rounded-xl bg-white">
          <CardHeader className="border-b border-slate-50">
              <CardTitle className="text-base font-semibold text-slate-800">
                {selectedModule === 'all' ? 'Últimas Movimentações' : 'Atividades deste Sistema'}
              </CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="space-y-6">
              {loading ? (
                 [1,2,3].map(i => <div key={i} className="flex gap-4"><div className="w-10 h-10 rounded-full bg-slate-100 animate-pulse"/><div className="space-y-2 flex-1"><div className="h-4 bg-slate-100 rounded w-3/4 animate-pulse"/><div className="h-3 bg-slate-100 rounded w-1/2 animate-pulse"/></div></div>)
              ) : recentActivity.length === 0 ? (
                 <div className="text-center py-10">
                    <div className="bg-slate-50 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3">
                        <FileText className="h-6 w-6 text-slate-300" />
                    </div>
                    <p className="text-sm text-slate-400">Nenhuma atividade recente.</p>
                 </div>
              ) : (
                recentActivity.map((item) => (
                  <div key={item.id} className="flex items-start justify-between group">
                    <div className="flex items-start gap-3">
                      <div className="mt-1 p-2 bg-blue-50 text-blue-600 rounded-full border border-blue-100 group-hover:bg-[#003B8F] group-hover:text-white transition-colors duration-300">
                          <ArrowUpRight className="h-3.5 w-3.5" />
                      </div>
                      <div>
                        {/* Acesso Seguro ao Nome do Módulo */}
                        <p className="text-sm font-medium text-slate-700 leading-none mb-1 group-hover:text-[#003B8F] transition-colors">
                          {item.registros_mestre?.modulos?.nome || 'Sistema Desconhecido'}
                        </p>
                        <p className="text-xs text-slate-500">
                           Movimentação de Dado • <span className="text-slate-400">{format(new Date(item.criado_em), "d 'de' MMM, HH:mm", { locale: ptBR })}</span>
                        </p>
                      </div>
                    </div>
                    <StatusBadge status={item.status} />
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// --- Componentes Auxiliares ---

function StatsCard({ title, value, icon: Icon, loading, highlight }: any) {
  return (
    <Card className={`border border-slate-200 shadow-sm hover:shadow-md transition-all duration-200 rounded-xl ${highlight ? 'bg-amber-50/50 border-amber-100' : 'bg-white'}`}>
      <CardContent className="p-6">
        <div className="flex items-center justify-between space-y-0 pb-2">
          <span className={`text-sm font-medium ${highlight ? 'text-amber-700' : 'text-slate-500'}`}>{title}</span>
          <div className={`p-2 rounded-lg ${highlight ? 'bg-amber-100 text-amber-600' : 'bg-slate-50 text-slate-400'}`}>
              <Icon className="h-4 w-4" />
          </div>
        </div>
        <div className="text-2xl font-bold text-slate-800 mt-2">
            {loading ? <div className="h-8 w-16 bg-slate-100 animate-pulse rounded"/> : value}
        </div>
      </CardContent>
    </Card>
  );
}

function StatusBadge({ status }: { status: string }) {
    const styles: any = {
        PENDENTE: 'bg-yellow-50 text-yellow-700 border-yellow-200',
        OFICIAL: 'bg-green-50 text-green-700 border-green-200',
        REJEITADO: 'bg-red-50 text-red-700 border-red-200',
        RASCUNHO: 'bg-slate-50 text-slate-600 border-slate-200',
        OBSOLETO: 'bg-gray-100 text-gray-500 border-gray-200'
    };
    
    const labels: any = { 
        PENDENTE: 'Em Análise', 
        OFICIAL: 'Oficial', 
        REJEITADO: 'Rejeitado',
        RASCUNHO: 'Rascunho',
        OBSOLETO: 'Obsoleto'
    };
    
    return (
        <span className={`text-[10px] font-medium px-2.5 py-0.5 rounded-full border ${styles[status] || 'bg-slate-100 text-slate-600'}`}>
            {labels[status] || status}
        </span>
    );
}