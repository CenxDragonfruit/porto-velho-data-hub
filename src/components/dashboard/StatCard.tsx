import { motion } from 'framer-motion';
import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StatCardProps {
  title: string;
  value: string | number;
  description?: string;
  icon: LucideIcon;
  variant?: 'default' | 'primary' | 'secondary' | 'accent';
  trend?: {
    value: number;
    isPositive: boolean;
  };
}

export function StatCard({
  title,
  value,
  description,
  icon: Icon,
  variant = 'default',
  trend,
}: StatCardProps) {
  const variantClasses = {
    default: 'stat-card',
    primary: 'stat-card-primary',
    secondary: 'stat-card-secondary',
    accent: 'stat-card-accent',
  };

  const iconBgClasses = {
    default: 'bg-muted',
    primary: 'bg-primary/15',
    secondary: 'bg-secondary/15',
    accent: 'bg-accent/15',
  };

  const iconColorClasses = {
    default: 'text-muted-foreground',
    primary: 'text-primary',
    secondary: 'text-secondary',
    accent: 'text-accent',
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={variantClasses[variant]}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <p className="text-3xl font-bold text-foreground mt-1">{value}</p>
          {description && (
            <p className="text-sm text-muted-foreground mt-1">{description}</p>
          )}
          {trend && (
            <div className="flex items-center gap-1 mt-2">
              <span
                className={cn(
                  'text-xs font-medium',
                  trend.isPositive ? 'text-success' : 'text-destructive'
                )}
              >
                {trend.isPositive ? '+' : ''}{trend.value}%
              </span>
              <span className="text-xs text-muted-foreground">vs. mês anterior</span>
            </div>
          )}
        </div>
        <div className={cn('p-3 rounded-xl', iconBgClasses[variant])}>
          <Icon className={cn('h-6 w-6', iconColorClasses[variant])} />
        </div>
      </div>
    </motion.div>
  );
}
