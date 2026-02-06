import { useState } from 'react';
import { useAuditLogs, LogFilters } from '@/hooks/useAuditLogs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Search, History, Loader2, FilePlus, FilePen, Trash2, 
  AlertCircle, ChevronRight, X, Calendar, Filter, LogIn, Upload, Download, ListFilter
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Separator } from '@/components/ui/separator';

// --- UTILITÁRIOS VISUAIS ---
const formatFieldName = (key: string) => key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());

const formatValue = (value: any) => {
  if (value === null || value === undefined) return <span className="text-slate-300 italic">Vazio</span>;
  if (typeof value === 'boolean') return value ? 'Sim' : 'Não';
  if (typeof value === 'string' && value.match(/^\d{4}-\d{2}-\d{2}/)) {
     try { return format(parseISO(value), "dd/MM/yyyy HH:mm", { locale: ptBR }); } catch { return value; }
  }
  return String(value);
};

export default function AuditLogsPage() {
  const [filters, setFilters] = useState<LogFilters>({
    searchTerm: '',
    operation: 'ALL',
    dateStart: '',
    dateEnd: ''
  });

  const { 
    data, 
    fetchNextPage, 
    hasNextPage, 
    isFetchingNextPage, 
    isLoading,
    isError
  } = useAuditLogs(filters);

  const allLogs: any[] = data?.pages.flatMap((page) => page) || [];

  const handleClearFilters = () => setFilters({ searchTerm: '', operation: 'ALL', dateStart: '', dateEnd: '' });

  return (
    <div className="space-y-6 animate-in fade-in pb-20 pt-6 px-4 md:px-8 max-w-7xl mx-auto">
      
      {/* HEADER */}
      <div className="flex flex-col gap-2 mb-6">
        <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
            <div className="p-2.5 bg-[#003B8F] rounded-xl text-white shadow-lg shadow-blue-900/20">
                <History className="h-6 w-6" />
            </div>
            Auditoria e Rastreabilidade
        </h1>
        <p className="text-slate-500 text-sm ml-1 pl-14 -mt-2">
            Histórico completo de segurança e alterações de dados no sistema.
        </p>
      </div>

      {/* BARRA DE FILTROS REFORMULADA */}
      <Card className="bg-white border-slate-200 shadow-sm overflow-hidden">
        <CardHeader className="bg-slate-50/50 border-b border-slate-100 py-3 px-4">
            <CardTitle className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                <ListFilter className="w-4 h-4"/> Filtros de Pesquisa
            </CardTitle>
        </CardHeader>
        <CardContent className="p-4 grid gap-6">
            
            {/* LINHA 1: BUSCA GLOBAL */}
            <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                <Input 
                    placeholder="Buscar por nome do usuário, tabela afetada ou ID..." 
                    className="pl-10 h-10 bg-white border-slate-200 text-slate-700 placeholder:text-slate-400 focus-visible:ring-[#003B8F]" 
                    value={filters.searchTerm} 
                    onChange={e => setFilters({...filters, searchTerm: e.target.value})} 
                />
            </div>

            <Separator className="bg-slate-100" />

            {/* LINHA 2: FILTROS ESPECÍFICOS (Grid Responsivo) */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
                
                {/* TIPO DE AÇÃO */}
                <div className="md:col-span-4 space-y-1.5">
                    <label className="text-xs font-semibold text-slate-500 ml-1">Tipo de Ação</label>
                    <Select value={filters.operation} onValueChange={v => setFilters({...filters, operation: v})}>
                        <SelectTrigger className="h-9 bg-white border-slate-200"><SelectValue placeholder="Todas" /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="ALL">Todas as Ações</SelectItem>
                            <SelectItem value="LOGIN">🔐 Acesso (Login)</SelectItem>
                            <SelectItem value="CRIACAO">✨ Criação de Registro</SelectItem>
                            <SelectItem value="EDICAO">✏️ Edição de Dados</SelectItem>
                            <SelectItem value="EXCLUSAO">🗑️ Exclusão</SelectItem>
                            <SelectItem value="IMPORTACAO">📂 Importação CSV</SelectItem>
                            <SelectItem value="EXPORTACAO">⬇️ Exportação</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                {/* DATAS */}
                <div className="md:col-span-6 space-y-1.5">
                     <label className="text-xs font-semibold text-slate-500 ml-1 flex items-center gap-1">
                        Período da Ocorrência
                     </label>
                     <div className="flex items-center gap-2">
                        <div className="relative flex-1">
                            <Calendar className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400 pointer-events-none"/>
                            <Input type="date" className="pl-9 h-9 bg-white border-slate-200" value={filters.dateStart} onChange={e => setFilters({...filters, dateStart: e.target.value})} />
                        </div>
                        <span className="text-slate-300">-</span>
                        <div className="relative flex-1">
                            <Calendar className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400 pointer-events-none"/>
                            <Input type="date" className="pl-9 h-9 bg-white border-slate-200" value={filters.dateEnd} onChange={e => setFilters({...filters, dateEnd: e.target.value})} />
                        </div>
                     </div>
                </div>

                {/* BOTÃO LIMPAR */}
                <div className="md:col-span-2">
                    <Button 
                        variant="ghost" 
                        onClick={handleClearFilters} 
                        className="w-full h-9 text-slate-500 hover:text-red-600 hover:bg-red-50 border border-transparent hover:border-red-100 transition-colors"
                    >
                        <X className="h-4 w-4 mr-2" /> Limpar
                    </Button>
                </div>
            </div>
        </CardContent>
      </Card>

      {/* LISTAGEM DE LOGS */}
      <div className="space-y-4 min-h-[400px]">
        {isLoading ? (
            <div className="p-16 flex flex-col items-center justify-center gap-4 bg-white/50 rounded-xl border border-slate-100">
                <Loader2 className="animate-spin h-10 w-10 text-[#003B8F]" />
                <span className="text-sm font-medium text-slate-500">Buscando registros de auditoria...</span>
            </div>
        ) : isError ? (
            <div className="p-8 text-center bg-red-50 border border-red-100 rounded-xl text-red-600 flex flex-col items-center gap-2">
                <AlertCircle className="h-8 w-8 text-red-400"/>
                <p className="font-semibold">Não foi possível carregar os registros.</p>
                <p className="text-xs opacity-80">Verifique sua conexão ou contate o suporte.</p>
            </div>
        ) : allLogs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 bg-slate-50/50 rounded-xl border-2 border-dashed border-slate-200 text-slate-400">
                <div className="bg-white p-4 rounded-full shadow-sm mb-3">
                    <Filter className="h-8 w-8 text-slate-300"/>
                </div>
                <p className="font-medium text-slate-600">Nenhum registro encontrado</p>
                <p className="text-sm">Tente ajustar os filtros de busca.</p>
            </div>
        ) : (
            <>
                <div className="relative space-y-0 pb-6">
                    {/* Linha vertical contínua de fundo */}
                    <div className="absolute left-[27px] top-4 bottom-4 w-px bg-slate-200 z-0 hidden md:block" />
                    
                    {allLogs.map((log) => <SmartLogCard key={log.id} log={log} />)}
                </div>
                
                {hasNextPage && (
                    <div className="flex justify-center pt-2 pb-8">
                        <Button 
                            variant="outline" 
                            onClick={() => fetchNextPage()} 
                            disabled={isFetchingNextPage}
                            className="bg-white hover:bg-slate-50 text-slate-600 border-slate-300 min-w-[200px] shadow-sm"
                        >
                            {isFetchingNextPage ? <Loader2 className="h-4 w-4 animate-spin mr-2"/> : <History className="h-4 w-4 mr-2"/>}
                            {isFetchingNextPage ? 'Carregando...' : 'Carregar Registros Antigos'}
                        </Button>
                    </div>
                )}
            </>
        )}
      </div>
    </div>
  );
}

// --- CARD INTELIGENTE (Visualização Detalhada) ---
function SmartLogCard({ log }: { log: any }) {
    const [isOpen, setIsOpen] = useState(false);

    const oldData = log.dados_anteriores || {};
    const newData = log.dados_novos || {};
    
    // DIFF Generator
    const changes: any[] = [];
    if (log.acao === 'EDICAO') {
        const allKeys = Array.from(new Set([...Object.keys(oldData), ...Object.keys(newData)]));
        allKeys.forEach(key => {
            if (['id', 'criado_em', 'atualizado_em', 'senha_hash'].includes(key)) return;
            if (JSON.stringify(oldData[key]) !== JSON.stringify(newData[key])) {
                changes.push({ field: key, from: oldData[key], to: newData[key] });
            }
        });
    }

    const getConfig = () => {
        const target = log.tabela_alvo === 'versoes_registro' ? 'Dados Municipais' : formatFieldName(log.tabela_alvo || 'Sistema');
        
        switch(log.acao) {
            case 'CRIACAO': return { 
                icon: FilePlus, color: 'text-emerald-600', bg: 'bg-emerald-50', 
                border: 'border-emerald-200', title: 'Registro Criado', desc: `Novo registro em ${target}` 
            };
            case 'EDICAO': return { 
                icon: FilePen, color: 'text-blue-600', bg: 'bg-blue-50', 
                border: 'border-blue-200', title: 'Registro Alterado', desc: `Modificação em ${target}` 
            };
            case 'EXCLUSAO': return { 
                icon: Trash2, color: 'text-rose-600', bg: 'bg-rose-50', 
                border: 'border-rose-200', title: 'Registro Removido', desc: `Exclusão em ${target}` 
            };
            case 'LOGIN': return { 
                icon: LogIn, color: 'text-violet-600', bg: 'bg-violet-50', 
                border: 'border-violet-200', title: 'Acesso', desc: `Login no sistema` 
            };
            case 'IMPORTACAO': return { 
                icon: Upload, color: 'text-orange-600', bg: 'bg-orange-50', 
                border: 'border-orange-200', title: 'Importação', desc: `Carga de dados CSV` 
            };
            case 'EXPORTACAO': return { 
                icon: Download, color: 'text-indigo-600', bg: 'bg-indigo-50', 
                border: 'border-indigo-200', title: 'Exportação', desc: `Download de dados` 
            };
            default: return { 
                icon: AlertCircle, color: 'text-slate-600', bg: 'bg-slate-50', 
                border: 'border-slate-200', title: 'Log', desc: `Ação: ${log.acao}` 
            };
        }
    };

    const conf = getConfig();
    const Icon = conf.icon;
    const hasDetails = (log.acao === 'EDICAO' && changes.length > 0) || 
                       ((log.acao === 'CRIACAO' || log.acao === 'EXCLUSAO') && (Object.keys(newData).length > 0 || Object.keys(oldData).length > 0));

    return (
        <div className="relative pl-0 md:pl-14 group z-10">
            {/* Ícone Lateral (Desktop) */}
            <div className={`hidden md:flex absolute left-3 top-4 w-10 h-10 rounded-full border-4 border-white shadow-md items-center justify-center z-10 transition-colors ${conf.bg} ${conf.color}`}>
                <Icon className="h-5 w-5" />
            </div>

            <Collapsible open={isOpen} onOpenChange={setIsOpen}>
                <Card className={`overflow-hidden transition-all duration-300 border bg-white shadow-sm hover:shadow-md ${isOpen ? `ring-1 ring-offset-2 ${conf.border}` : 'border-slate-200'}`}>
                    <div 
                        className={`p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 ${hasDetails ? 'cursor-pointer hover:bg-slate-50/50' : ''}`} 
                        onClick={() => hasDetails && setIsOpen(!isOpen)}
                    >
                        <div className="flex-1 space-y-1">
                            <div className="flex items-center flex-wrap gap-2">
                                {/* Ícone Mobile */}
                                <div className={`md:hidden flex w-6 h-6 rounded-full items-center justify-center ${conf.bg} ${conf.color}`}>
                                    <Icon className="h-3 w-3" />
                                </div>

                                <Badge variant="outline" className={`${conf.bg} ${conf.color} border-transparent font-bold text-[10px] uppercase tracking-wider`}>
                                    {conf.title}
                                </Badge>
                                <span className="text-xs text-slate-400 font-medium flex items-center gap-1 ml-auto md:ml-0">
                                    <Calendar className="h-3 w-3"/>
                                    {format(parseISO(log.data_hora), "dd 'de' MMM, HH:mm", { locale: ptBR })}
                                </span>
                            </div>
                            
                            <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                                <span className="font-semibold text-slate-800 text-sm">{conf.desc}</span>
                                <span className="hidden sm:inline text-slate-300">|</span>
                                <div className="flex items-center gap-2 text-sm text-slate-600 bg-slate-50 px-2 py-0.5 rounded-full w-fit">
                                    <div className="w-5 h-5 rounded-full bg-slate-200 flex items-center justify-center text-[10px] font-bold text-slate-600 shadow-inner">
                                        {log.usuarios?.nome_completo?.charAt(0) || '?'}
                                    </div>
                                    <span className="truncate max-w-[150px] font-medium">{log.usuarios?.nome_completo || 'Sistema'}</span>
                                    {/* <Badge variant="secondary" className="text-[9px] h-4 px-1 bg-white border border-slate-100">{log.usuarios?.perfis?.nome || 'Auto'}</Badge> */}
                                </div>
                            </div>
                        </div>
                        
                        {hasDetails && (
                            <CollapsibleTrigger asChild>
                                <Button variant="ghost" size="sm" className="h-8 w-8 p-0 rounded-full self-end md:self-center bg-slate-50 hover:bg-slate-100 border border-slate-100">
                                    <ChevronRight className={`h-4 w-4 text-slate-400 transition-transform duration-200 ${isOpen ? 'rotate-90' : ''}`} />
                                </Button>
                            </CollapsibleTrigger>
                        )}
                    </div>

                    <CollapsibleContent className="border-t border-slate-100 bg-slate-50/30">
                        <div className="p-5 text-sm animate-in slide-in-from-top-2">
                            {/* EDICAO: Diff Visual */}
                            {log.acao === 'EDICAO' && (
                                <div className="space-y-4">
                                    <div className="flex items-center gap-2">
                                        <div className="h-px bg-slate-200 flex-1"></div>
                                        <span className="text-[10px] font-bold text-slate-400 uppercase">Alterações Realizadas</span>
                                        <div className="h-px bg-slate-200 flex-1"></div>
                                    </div>
                                    <div className="grid gap-2">
                                        {changes.map((change, idx) => (
                                            <div key={idx} className="grid grid-cols-1 md:grid-cols-12 gap-0 md:gap-4 items-center bg-white p-3 rounded-lg border border-slate-200 shadow-sm">
                                                <div className="md:col-span-3 font-semibold text-slate-600 text-xs uppercase tracking-wide mb-1 md:mb-0">
                                                    {formatFieldName(change.field)}
                                                </div>
                                                <div className="md:col-span-4 bg-red-50 text-red-600 px-3 py-1.5 rounded-md text-xs break-all line-through opacity-80 border border-red-100">
                                                    {formatValue(change.from)}
                                                </div>
                                                <div className="md:col-span-1 text-center text-slate-300 py-1 md:py-0">➜</div>
                                                <div className="md:col-span-4 bg-green-50 text-green-700 px-3 py-1.5 rounded-md text-xs break-all font-medium border border-green-100">
                                                    {formatValue(change.to)}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* CRIACAO / EXCLUSAO: Grid de Dados */}
                            {(log.acao === 'CRIACAO' || log.acao === 'EXCLUSAO') && (
                                <div>
                                    <div className="flex items-center gap-2 mb-4">
                                        <div className="h-px bg-slate-200 flex-1"></div>
                                        <span className="text-[10px] font-bold text-slate-400 uppercase">
                                            Dados {log.acao === 'CRIACAO' ? 'Registrados' : 'Removidos'}
                                        </span>
                                        <div className="h-px bg-slate-200 flex-1"></div>
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                                        {Object.entries(log.acao === 'CRIACAO' ? newData : oldData).map(([k, v]) => {
                                            if(['id', 'senha_hash', 'criado_em', 'auth_id'].includes(k)) return null;
                                            return (
                                                <div key={k} className="flex flex-col p-2 bg-white rounded border border-slate-100">
                                                    <span className="text-[9px] text-slate-400 uppercase font-bold tracking-wide mb-1">{formatFieldName(k)}</span>
                                                    <span className="text-xs text-slate-700 break-words font-medium">{formatValue(v)}</span>
                                                </div>
                                            )
                                        })}
                                    </div>
                                </div>
                            )}

                            {/* RODAPÉ TÉCNICO */}
                            <div className="mt-4 pt-3 border-t border-dashed border-slate-200 flex justify-between items-center text-[10px] text-slate-400 font-mono">
                                <div className="flex gap-4">
                                    <span>IP: <span className="text-slate-600">{log.ip || 'Local'}</span></span>
                                    <span>ID Ref: <span className="text-slate-600">{log.id_alvo}</span></span>
                                </div>
                                <span className="opacity-50">Log ID: {log.id}</span>
                            </div>
                        </div>
                    </CollapsibleContent>
                </Card>
            </Collapsible>
        </div>
    );
}