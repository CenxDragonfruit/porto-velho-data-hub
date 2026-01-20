import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Layout } from '@/components/layout/Layout';
import { StatCard } from '@/components/dashboard/StatCard';
import { RecentRecords } from '@/components/dashboard/RecentRecords';
import { ModuleBarChart, StatusPieChart, TimelineChart } from '@/components/dashboard/Charts';
import { supabase } from '@/integrations/supabase/client';
import { CrudRecord, CrudModule } from '@/lib/types';
import { Database, FileText, CheckCircle, Clock } from 'lucide-react';

export default function Dashboard() {
  const [records, setRecords] = useState<(CrudRecord & { module?: CrudModule })[]>([]);
  const [modules, setModules] = useState<CrudModule[]>([]);
  const [stats, setStats] = useState({ total: 0, pending: 0, approved: 0, rejected: 0 });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    const [recordsRes, modulesRes] = await Promise.all([
      supabase.from('crud_records').select('*').order('created_at', { ascending: false }).limit(10),
      supabase.from('crud_modules').select('*').eq('is_active', true),
    ]);

    const recordsData = (recordsRes.data || []) as CrudRecord[];
    const modulesData = (modulesRes.data || []) as CrudModule[];

    const enrichedRecords = recordsData.map((r) => ({
      ...r,
      module: modulesData.find((m) => m.id === r.crud_module_id),
    }));

    setRecords(enrichedRecords);
    setModules(modulesData);

    const allRecords = (await supabase.from('crud_records').select('status')).data || [];
    setStats({
      total: allRecords.length,
      pending: allRecords.filter((r: any) => r.status === 'pending').length,
      approved: allRecords.filter((r: any) => r.status === 'approved').length,
      rejected: allRecords.filter((r: any) => r.status === 'rejected').length,
    });
  };

  const statusData = [
    { name: 'Pendentes', value: stats.pending, color: 'hsl(45, 93%, 47%)' },
    { name: 'Aprovados', value: stats.approved, color: 'hsl(145, 63%, 42%)' },
    { name: 'Rejeitados', value: stats.rejected, color: 'hsl(0, 72%, 51%)' },
  ];

  const moduleStats = modules.map((m) => ({
    name: m.name.slice(0, 15),
    total: records.filter((r) => r.crud_module_id === m.id).length,
    pending: records.filter((r) => r.crud_module_id === m.id && r.status === 'pending').length,
    approved: records.filter((r) => r.crud_module_id === m.id && r.status === 'approved').length,
    rejected: records.filter((r) => r.crud_module_id === m.id && r.status === 'rejected').length,
  }));

  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const date = new Date();
    date.setDate(date.getDate() - (6 - i));
    return { date: date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }), registros: Math.floor(Math.random() * 10) };
  });

  return (
    <Layout>
      <div className="page-header">
        <motion.h1 initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="page-title">
          Dashboard
        </motion.h1>
        <p className="page-description">Visão geral do sistema de gestão municipal</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 mb-8">
        <StatCard title="Total de Registros" value={stats.total} icon={FileText} variant="primary" />
        <StatCard title="Módulos Ativos" value={modules.length} icon={Database} variant="secondary" />
        <StatCard title="Pendentes" value={stats.pending} icon={Clock} variant="accent" />
        <StatCard title="Aprovados" value={stats.approved} icon={CheckCircle} variant="default" />
      </div>

      <div className="grid gap-6 lg:grid-cols-2 mb-8">
        <ModuleBarChart data={moduleStats} />
        <StatusPieChart data={statusData} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <TimelineChart data={last7Days} />
        <RecentRecords records={records} />
      </div>
    </Layout>
  );
}
