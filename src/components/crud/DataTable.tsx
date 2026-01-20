import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Search,
  MoreHorizontal,
  Edit,
  Trash2,
  CheckCircle,
  XCircle,
  Eye,
  Download,
  FileText,
} from 'lucide-react';
import { CrudField, CrudRecord } from '@/lib/types';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface DataTableProps {
  records: CrudRecord[];
  fields: CrudField[];
  onEdit?: (record: CrudRecord) => void;
  onDelete?: (id: string) => void;
  onApprove?: (id: string) => void;
  onReject?: (id: string, reason: string) => void;
  onExportCSV?: () => void;
  onExportPDF?: () => void;
  showActions?: boolean;
  canApprove?: boolean;
}

export function DataTable({
  records,
  fields,
  onEdit,
  onDelete,
  onApprove,
  onReject,
  onExportCSV,
  onExportPDF,
  showActions = true,
  canApprove = false,
}: DataTableProps) {
  const [search, setSearch] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const sortedFields = [...fields].sort((a, b) => a.order_index - b.order_index);
  const displayFields = sortedFields.slice(0, 5);

  const filteredRecords = records.filter((record) => {
    const searchLower = search.toLowerCase();
    return Object.values(record.data).some((value) =>
      String(value).toLowerCase().includes(searchLower)
    );
  });

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

  const formatFieldValue = (field: CrudField, value: any) => {
    if (value === null || value === undefined) return '-';

    switch (field.field_type) {
      case 'currency':
        const amount = parseInt(value) / 100;
        return amount.toLocaleString('pt-BR', {
          style: 'currency',
          currency: 'BRL',
        });
      case 'date':
        return format(new Date(value), 'dd/MM/yyyy', { locale: ptBR });
      case 'cpf':
        return value
          .replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
      case 'cnpj':
        return value
          .replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
      case 'phone':
        if (value.length === 11) {
          return value.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
        }
        return value.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3');
      case 'select':
        const option = field.options?.find((o) => o.value === value);
        return option?.label || value;
      default:
        return String(value);
    }
  };

  const handleReject = () => {
    if (rejectId && rejectReason.trim()) {
      onReject?.(rejectId, rejectReason);
      setRejectId(null);
      setRejectReason('');
    }
  };

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar registros..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>

        {(onExportCSV || onExportPDF) && (
          <div className="flex gap-2">
            {onExportCSV && (
              <Button variant="outline" onClick={onExportCSV}>
                <Download className="mr-2 h-4 w-4" />
                CSV
              </Button>
            )}
            {onExportPDF && (
              <Button variant="outline" onClick={onExportPDF}>
                <FileText className="mr-2 h-4 w-4" />
                PDF
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Table */}
      <div className="rounded-xl border border-border overflow-hidden bg-card">
        <Table>
          <TableHeader>
            <TableRow className="table-header hover:bg-muted/50">
              {displayFields.map((field) => (
                <TableHead key={field.id} className="font-semibold">
                  {field.label}
                </TableHead>
              ))}
              <TableHead className="font-semibold">Status</TableHead>
              <TableHead className="font-semibold">Data</TableHead>
              {showActions && <TableHead className="text-right">Ações</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredRecords.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={displayFields.length + (showActions ? 3 : 2)}
                  className="h-32 text-center text-muted-foreground"
                >
                  Nenhum registro encontrado
                </TableCell>
              </TableRow>
            ) : (
              filteredRecords.map((record, index) => (
                <motion.tr
                  key={record.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: index * 0.02 }}
                  className="border-b border-border hover:bg-muted/30 transition-colors"
                >
                  {displayFields.map((field) => (
                    <TableCell key={field.id} className="py-3">
                      {formatFieldValue(field, record.data[field.name])}
                    </TableCell>
                  ))}
                  <TableCell>
                    <span className={cn(getStatusClass(record.status))}>
                      {getStatusLabel(record.status)}
                    </span>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {format(new Date(record.created_at), 'dd/MM/yyyy', { locale: ptBR })}
                  </TableCell>
                  {showActions && (
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="bg-popover">
                          {onEdit && (
                            <DropdownMenuItem onClick={() => onEdit(record)}>
                              <Edit className="mr-2 h-4 w-4" />
                              Editar
                            </DropdownMenuItem>
                          )}
                          {canApprove && record.status === 'pending' && (
                            <>
                              {onApprove && (
                                <DropdownMenuItem onClick={() => onApprove(record.id)}>
                                  <CheckCircle className="mr-2 h-4 w-4 text-success" />
                                  Aprovar
                                </DropdownMenuItem>
                              )}
                              {onReject && (
                                <DropdownMenuItem onClick={() => setRejectId(record.id)}>
                                  <XCircle className="mr-2 h-4 w-4 text-destructive" />
                                  Rejeitar
                                </DropdownMenuItem>
                              )}
                            </>
                          )}
                          {onDelete && (
                            <DropdownMenuItem
                              onClick={() => setDeleteId(record.id)}
                              className="text-destructive focus:text-destructive"
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Excluir
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  )}
                </motion.tr>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Delete Dialog */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir este registro? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteId) onDelete?.(deleteId);
                setDeleteId(null);
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reject Dialog */}
      <AlertDialog open={!!rejectId} onOpenChange={() => setRejectId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Rejeitar registro</AlertDialogTitle>
            <AlertDialogDescription>
              Informe o motivo da rejeição para este registro.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <Input
              placeholder="Motivo da rejeição..."
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleReject}
              disabled={!rejectReason.trim()}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Rejeitar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
