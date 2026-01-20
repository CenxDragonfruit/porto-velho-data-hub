import { motion } from 'framer-motion';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  Area,
  AreaChart,
} from 'recharts';

interface ModuleStats {
  name: string;
  total: number;
  pending: number;
  approved: number;
  rejected: number;
}

interface ChartProps {
  moduleStats: ModuleStats[];
  statusData: { name: string; value: number; color: string }[];
  timelineData: { date: string; registros: number }[];
}

const COLORS = {
  primary: 'hsl(213, 94%, 30%)',
  secondary: 'hsl(145, 63%, 32%)',
  accent: 'hsl(45, 93%, 47%)',
  destructive: 'hsl(0, 72%, 51%)',
  muted: 'hsl(215, 15%, 45%)',
};

export function ModuleBarChart({ data }: { data: ModuleStats[] }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.3 }}
      className="bg-card rounded-xl shadow-card border border-border/50 p-6"
    >
      <h3 className="text-lg font-semibold text-foreground mb-1">Registros por Módulo</h3>
      <p className="text-sm text-muted-foreground mb-6">Distribuição de registros entre módulos</p>

      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis
              dataKey="name"
              tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
              axisLine={{ stroke: 'hsl(var(--border))' }}
            />
            <YAxis
              tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
              axisLine={{ stroke: 'hsl(var(--border))' }}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '8px',
              }}
            />
            <Bar dataKey="approved" name="Aprovados" fill={COLORS.secondary} radius={[4, 4, 0, 0]} />
            <Bar dataKey="pending" name="Pendentes" fill={COLORS.accent} radius={[4, 4, 0, 0]} />
            <Bar dataKey="rejected" name="Rejeitados" fill={COLORS.destructive} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </motion.div>
  );
}

export function StatusPieChart({ data }: { data: { name: string; value: number; color: string }[] }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.4 }}
      className="bg-card rounded-xl shadow-card border border-border/50 p-6"
    >
      <h3 className="text-lg font-semibold text-foreground mb-1">Status dos Registros</h3>
      <p className="text-sm text-muted-foreground mb-6">Proporção por status de aprovação</p>

      <div className="h-64 flex items-center justify-center">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={90}
              paddingAngle={4}
              dataKey="value"
              label={({ name, percent }) =>
                `${name} ${(percent * 100).toFixed(0)}%`
              }
              labelLine={false}
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                backgroundColor: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '8px',
              }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>

      <div className="flex justify-center gap-6 mt-4">
        {data.map((item) => (
          <div key={item.name} className="flex items-center gap-2">
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: item.color }}
            />
            <span className="text-sm text-muted-foreground">{item.name}</span>
          </div>
        ))}
      </div>
    </motion.div>
  );
}

export function TimelineChart({ data }: { data: { date: string; registros: number }[] }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.5 }}
      className="bg-card rounded-xl shadow-card border border-border/50 p-6"
    >
      <h3 className="text-lg font-semibold text-foreground mb-1">Evolução de Registros</h3>
      <p className="text-sm text-muted-foreground mb-6">Registros criados ao longo do tempo</p>

      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
            <defs>
              <linearGradient id="colorRegistros" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={COLORS.primary} stopOpacity={0.3} />
                <stop offset="95%" stopColor={COLORS.primary} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis
              dataKey="date"
              tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
              axisLine={{ stroke: 'hsl(var(--border))' }}
            />
            <YAxis
              tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
              axisLine={{ stroke: 'hsl(var(--border))' }}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '8px',
              }}
            />
            <Area
              type="monotone"
              dataKey="registros"
              stroke={COLORS.primary}
              strokeWidth={2}
              fillOpacity={1}
              fill="url(#colorRegistros)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </motion.div>
  );
}
