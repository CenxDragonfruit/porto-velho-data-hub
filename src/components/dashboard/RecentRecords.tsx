import { motion } from 'framer-motion';
import { FileText, Clock, CheckCircle, XCircle } from 'lucide-react';
import { CrudRecord, CrudModule } from '@/lib/types';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface RecentRecordsProps {
  records: (CrudRecord & { module?: CrudModule })[];
}

export function RecentRecords({ records }: RecentRecordsProps) {
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'approved':
        return <CheckCircle className="h-4 w-4 text-success" />;
      case 'rejected':
        return <XCircle className="h-4 w-4 text-destructive" />;
      default:
        return <Clock className="h-4 w-4 text-warning" />;
    }
  };

  const getStatusClass = (status: string) => {
    switch (status) {
      case 'approved':
        return 'status-approved';
      case 'rejected':
        return 'status-rejected';
      default:
        return 'status-pending';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'approved':
        return 'Aprovado';
      case 'rejected':
        return 'Rejeitado';
      default:
        return 'Pendente';
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.2 }}
      className="bg-card rounded-xl shadow-card border border-border/50"
    >
      <div className="p-6 border-b border-border">
        <h3 className="text-lg font-semibold text-foreground">Registros Recentes</h3>
        <p className="text-sm text-muted-foreground">Últimas entradas no sistema</p>
      </div>

      <div className="divide-y divide-border">
        {records.length === 0 ? (
          <div className="p-8 text-center">
            <FileText className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-muted-foreground">Nenhum registro encontrado</p>
          </div>
        ) : (
          records.map((record, index) => (
            <motion.div
              key={record.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.05 }}
              className="p-4 flex items-center gap-4 hover:bg-muted/30 transition-colors"
            >
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <FileText className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-foreground truncate">
                  {record.module?.name || 'Módulo'}
                </p>
                <p className="text-sm text-muted-foreground">
                  {formatDistanceToNow(new Date(record.created_at), {
                    addSuffix: true,
                    locale: ptBR,
                  })}
                </p>
              </div>
              <div className={cn(getStatusClass(record.status))}>
                {getStatusIcon(record.status)}
                <span className="ml-1">{getStatusLabel(record.status)}</span>
              </div>
            </motion.div>
          ))
        )}
      </div>
    </motion.div>
  );
}
