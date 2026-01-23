import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Search, History, Loader2, FilePlus, FilePen, Trash2, 
  AlertCircle, ChevronRight, X, Calendar, Filter 
} from 'lucide-react';
import { format, parseISO, isValid, isWithinInterval, startOfDay, endOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

// ==================================================================================
// 1. CONFIGURAÇÕES: LISTA NEGRA E DICIONÁRIO
// ==================================================================================

// Lista de campos técnicos que NUNCA devem aparecer para o usuário
const IGNORED_FIELDS = [
  'id', 'user_id', 'batch_id', 'crud_table_id', 'record_id', 
  'search_vector', 'deleted_at', 'password', 'token', 
  'created_by', 'updated_by', 'approved_by', '_batch_id', 
  'company_id', 'tenant_id'
];

// Dicionário para traduzir nomes de campos técnicos para Português
const FIELD_LABELS: Record<string, string> = {
  'created_at': 'Data de Criação',
  'updated_at': 'Última Alteração',
  'status': 'Situação',
  'name': 'Nome',
  'full_name': 'Nome Completo',
  'description': 'Descrição',
  'email': 'E-mail',
  'phone': 'Telefone',
  'cpf': 'CPF',
  'cnpj': 'CNPJ',
  'address': 'Endereço',
  'city': 'Cidade',
  'state': 'Estado',
  'birth_date': 'Data de Nascimento',
  'role': 'Permissão / Cargo',
  'table_name': 'Módulo'
};

// ==================================================================================
// 2. FUNÇÕES AUXILIARES (GLOBAL)
// ==================================================================================

// Formata o NOME do campo (Ex: created_at -> Data de Criação)
const formatFieldName = (key: string) => {
  if (FIELD_LABELS[key]) return FIELD_LABELS[key];
  // Se não tiver tradução, limpa o snake_case (ex: nome_mae -> Nome Mae)
  return key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
};

// Formata o VALOR do campo (Datas, Booleanos, Nulos)
const formatValue = (value: any) => {
  if (value === null || value === undefined) return <span className="text-slate-300 italic">Vazio</span>;
  if (typeof value === 'boolean') return value ? 'Sim' : 'Não';
  
  // Detecta e formata datas ISO (ex: 2024-01-01T...)
  if (typeof value === 'string' && value.length > 10 && (value.includes('T') || value.includes('-'))) {
    const date = parseISO(value);
    if (isValid(date)) return format(date, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
  }
  
  return String(value);
};

// Limpa o objeto de dados (Remove campos ignorados e extrai dados aninhados)
const cleanDataObj = (data: any) => {
  if (!data) return {};
  // Se os dados vierem encapsulados em "data", extrai
  const content = (data.data && typeof data.data === 'object') ? { ...data.data, ...data } : data;
  if (content.data) delete content.data; // remove duplicidade

  const cleaned: Record<string, any> = {};
  Object.keys(content).forEach(key => {
    // Só aceita se não estiver na lista negra e tiver valor
    if (!IGNORED_FIELDS.includes(key) && content[key] !== null && content[key] !== '') {
      cleaned[key] = content[key];
    }
  });
  return cleaned;
};

// ==================================================================================
// 3. COMPONENTE PRINCIPAL: AUDIT LOGS
// ==================================================================================

export default function AuditLogs() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Estados de Filtro
  const [searchTerm, setSearchTerm] = useState('');
  const [filterOp, setFilterOp] = useState<string>('ALL'); // ALL, INSERT, UPDATE, DELETE
  const [dateStart, setDateStart] = useState<string>('');
  const [dateEnd, setDateEnd] = useState<string>('');

  useEffect(() => { fetchLogs(); }, []);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('audit_logs')
        .select(`*, profiles:changed_by ( full_name, email )`)
        .order('timestamp', { ascending: false })
        .limit(100);

      if (error) throw error;
      setLogs(data || []);
    } catch (e: any) {
      console.error("Erro fetch:", e);
      toast.error("Erro ao carregar histórico.");
    } finally {
      setLoading(false);
    }
  };

  // Lógica de Filtragem (Memoizada para performance)
  const filteredLogs = useMemo(() => {
    return logs.filter(log => {
      // 1. Busca textual (Nome, Email ou Conteúdo JSON)
      const searchMatch = 
        searchTerm === '' ||
        (log.profiles?.full_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        JSON.stringify(log.new_data).toLowerCase().includes(searchTerm.toLowerCase()) ||
        JSON.stringify(log.old_data).toLowerCase().includes(searchTerm.toLowerCase());

      // 2. Filtro de Operação
      const opMatch = filterOp === 'ALL' || log.operation === filterOp;

      // 3. Filtro de Data
      let dateMatch = true;
      if (dateStart || dateEnd) {
        const logDate = parseISO(log.timestamp);
        const start = dateStart ? startOfDay(parseISO(dateStart)) : new Date(2000, 0, 1);
        const end = dateEnd ? endOfDay(parseISO(dateEnd)) : new Date(2100, 0, 1);
        dateMatch = isWithinInterval(logDate, { start, end });
      }

      return searchMatch && opMatch && dateMatch;
    });
  }, [logs, searchTerm, filterOp, dateStart, dateEnd]);

  const clearFilters = () => {
    setSearchTerm('');
    setFilterOp('ALL');
    setDateStart('');
    setDateEnd('');
  };

  return (
    <div className="space-y-6 animate-in fade-in pb-20 pt-6 px-4 md:px-8 max-w-7xl mx-auto">
      
      {/* --- CABEÇALHO --- */}
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
            <div className="p-2 bg-[#003B8F] rounded-lg text-white shadow-sm">
                <History className="h-6 w-6" />
            </div>
            Auditoria e Rastreabilidade
        </h1>
        <p className="text-slate-500 text-sm ml-1">
            Linha do tempo de todas as ações realizadas no sistema.
        </p>
      </div>

      {/* --- BARRA DE FILTROS --- */}
      <Card className="p-4 bg-slate-50 border-slate-200 shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
            {/* Busca */}
            <div className="md:col-span-4 space-y-1">
                <label className="text-xs font-semibold text-slate-500 uppercase">Buscar</label>
                <div className="relative">
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                    <Input 
                        placeholder="Nome do usuário, dados..." 
                        className="pl-9 bg-white"
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                    />
                </div>
            </div>

            {/* Tipo de Ação */}
            <div className="md:col-span-3 space-y-1">
                <label className="text-xs font-semibold text-slate-500 uppercase">Ação</label>
                <select 
                    className="flex h-10 w-full rounded-md border border-input bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    value={filterOp}
                    onChange={e => setFilterOp(e.target.value)}
                >
                    <option value="ALL">Todas as Ações</option>
                    <option value="INSERT">Criação (Novo)</option>
                    <option value="UPDATE">Edição (Alteração)</option>
                    <option value="DELETE">Exclusão (Remoção)</option>
                </select>
            </div>

            {/* Período */}
            <div className="md:col-span-3 space-y-1">
                 <label className="text-xs font-semibold text-slate-500 uppercase flex items-center gap-1">
                    <Calendar className="h-3 w-3"/> Período
                 </label>
                 <div className="flex gap-2">
                    <Input type="date" className="bg-white" value={dateStart} onChange={e => setDateStart(e.target.value)} />
                    <Input type="date" className="bg-white" value={dateEnd} onChange={e => setDateEnd(e.target.value)} />
                 </div>
            </div>

            {/* Botão Limpar */}
            <div className="md:col-span-2">
                <Button variant="outline" onClick={clearFilters} className="w-full text-slate-500 hover:text-red-500 hover:bg-red-50">
                    <X className="h-4 w-4 mr-2" /> Limpar
                </Button>
            </div>
        </div>
      </Card>

      {/* --- LISTAGEM DE LOGS --- */}
      <div className="space-y-4">
        {loading ? (
            <div className="p-12 flex flex-col items-center gap-3">
                <Loader2 className="animate-spin h-8 w-8 text-[#003B8F]" />
                <span className="text-sm text-slate-400">Carregando histórico...</span>
            </div>
        ) : filteredLogs.length === 0 ? (
            <div className="text-center py-16 text-slate-400 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200">
                <Filter className="h-10 w-10 mx-auto mb-2 opacity-20"/>
                <p>Nenhum registro encontrado com estes filtros.</p>
            </div>
        ) : (
            <div className="relative space-y-0 pb-10">
                {filteredLogs.map((log) => <HumanLogCard key={log.id} log={log} />)}
            </div>
        )}
      </div>
    </div>
  );
}

// ==================================================================================
// 4. COMPONENTE: CARD DO LOG (HUMANIZADO)
// ==================================================================================

function HumanLogCard({ log }: { log: any }) {
    const [isOpen, setIsOpen] = useState(false);

    // 1. Preparação dos Dados
    const oldValues = cleanDataObj(log.old_data);
    const newValues = cleanDataObj(log.new_data);
    
    // Define qual dado exibir baseado na operação
    let displayData = {};
    if (log.operation === 'DELETE') displayData = oldValues; 
    else if (log.operation === 'INSERT') displayData = newValues; 
    else displayData = newValues; // Para update, usamos lógica específica abaixo

    // Nome do Módulo legível
    const moduleName = log.table_name === 'crud_records' ? 'Registros' : formatFieldName(log.table_name);

    // 2. Configuração Visual (Ícones e Cores)
    const getConfig = () => {
        switch(log.operation) {
            case 'INSERT': return { 
                icon: FilePlus, color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200', 
                action: 'Novo Cadastro', desc: `Adicionou um registro em ${moduleName}`
            };
            case 'UPDATE': return { 
                icon: FilePen, color: 'text-blue-700', bg: 'bg-blue-50', border: 'border-blue-200', 
                action: 'Edição', desc: `Alterou dados em ${moduleName}`
            };
            case 'DELETE': return { 
                icon: Trash2, color: 'text-red-700', bg: 'bg-red-50', border: 'border-red-200', 
                action: 'Exclusão', desc: `Removeu um registro de ${moduleName}`
            };
            default: return { 
                icon: AlertCircle, color: 'text-gray-700', bg: 'bg-gray-50', border: 'border-gray-200', 
                action: 'Sistema', desc: 'Ação do sistema' 
            };
        }
    };
    const config = getConfig();
    const Icon = config.icon;

    // 3. Detectar Mudanças (Apenas para UPDATE)
    const changes: any[] = [];
    if (log.operation === 'UPDATE') {
        Object.keys(newValues).forEach(key => {
            // Compara valores stringificados para evitar falsos positivos de objetos
            if (JSON.stringify(newValues[key]) !== JSON.stringify(oldValues[key])) {
                changes.push({ field: key, from: oldValues[key], to: newValues[key] });
            }
        });
    }

    // Verifica se tem detalhes para mostrar (para habilitar o clique)
    const hasDetails = (log.operation === 'UPDATE' ? changes.length > 0 : Object.keys(displayData).length > 0);

    return (
        <div className="relative pl-8 pb-6 group">
             {/* Linha vertical da timeline */}
            <div className="absolute left-[11px] top-8 bottom-0 w-px bg-slate-200 group-last:hidden" />
            
            {/* Ícone Bolinha */}
            <div className={`absolute left-0 top-1 w-6 h-6 rounded-full border-2 border-white shadow-sm flex items-center justify-center z-10 ${config.bg} ${config.color}`}>
                <Icon className="h-3 w-3" />
            </div>

            <Collapsible open={isOpen} onOpenChange={setIsOpen}>
                <Card className={`overflow-hidden transition-all duration-200 border ${isOpen ? 'ring-1 ring-blue-200 border-blue-300' : 'border-slate-200 hover:border-blue-200'}`}>
                    
                    {/* --- HEADER DO CARD (Sempre Visível) --- */}
                    <div 
                        className={`p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 ${hasDetails ? 'cursor-pointer hover:bg-slate-50/50' : ''}`}
                        onClick={() => hasDetails && setIsOpen(!isOpen)}
                    >
                        <div className="flex-1 space-y-1">
                            {/* Badges e Data */}
                            <div className="flex items-center gap-2 mb-1">
                                <Badge variant="outline" className={`${config.bg} ${config.color} border-transparent font-bold text-[10px] uppercase tracking-wider`}>
                                    {config.action}
                                </Badge>
                                <span className="text-xs text-slate-400 font-medium">
                                    {format(parseISO(log.timestamp), "dd 'de' MMM 'às' HH:mm", { locale: ptBR })}
                                </span>
                            </div>

                            {/* Descrição Principal */}
                            <div className="text-sm text-slate-700">
                                <span className="font-medium text-slate-900">{config.desc}</span>
                                <span className="text-slate-400 mx-1">•</span>
                                <span className="text-slate-500">por {log.profiles?.full_name || 'Sistema'}</span>
                            </div>
                        </div>

                        {/* Seta indicadora */}
                        {hasDetails && (
                            <CollapsibleTrigger asChild>
                                <Button variant="ghost" size="sm" className="h-8 w-8 p-0 rounded-full">
                                    <ChevronRight className={`h-4 w-4 text-slate-400 transition-transform duration-200 ${isOpen ? 'rotate-90' : ''}`} />
                                </Button>
                            </CollapsibleTrigger>
                        )}
                    </div>

                    {/* --- CONTEÚDO EXPANSÍVEL (Detalhes) --- */}
                    <CollapsibleContent className="border-t border-slate-100 bg-slate-50/40">
                        <div className="p-5 text-sm animate-in slide-in-from-top-1 space-y-4">
                            
                            {/* Caso 1: EXCLUSÃO ou CRIAÇÃO (Grid de Dados) */}
                            {log.operation !== 'UPDATE' && (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-4">
                                    {Object.entries(displayData).map(([key, value]: any) => (
                                        <div key={key} className="flex flex-col border-b border-dashed border-slate-200 pb-2 last:border-0">
                                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-0.5">
                                                {formatFieldName(key)}
                                            </span>
                                            <span className="text-slate-700 font-medium break-words leading-tight">
                                                {formatValue(value)}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Caso 2: EDIÇÃO (Comparativo De -> Para) */}
                            {log.operation === 'UPDATE' && (
                                <div className="space-y-3">
                                    {changes.map((change, idx) => (
                                        <div key={idx} className="bg-white p-3 rounded-lg border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center gap-3">
                                            {/* Nome do Campo */}
                                            <div className="md:w-1/4 border-b md:border-b-0 md:border-r border-slate-100 pb-2 md:pb-0">
                                                <span className="text-xs font-bold text-slate-500 uppercase">
                                                    {formatFieldName(change.field)}
                                                </span>
                                            </div>
                                            
                                            {/* Comparação */}
                                            <div className="flex-1 flex flex-col md:flex-row md:items-center gap-2 text-xs">
                                                <div className="flex items-center gap-2 flex-1">
                                                    <span className="bg-red-50 text-red-600 px-2 py-1 rounded line-through decoration-red-300 w-full md:w-auto">
                                                        {formatValue(change.from)}
                                                    </span>
                                                </div>
                                                
                                                <div className="hidden md:block text-slate-300">➜</div>
                                                <div className="md:hidden text-slate-300 text-center">⬇</div>

                                                <div className="flex items-center gap-2 flex-1">
                                                    <span className="bg-blue-50 text-blue-700 font-semibold px-2 py-1 rounded border border-blue-100 w-full md:w-auto">
                                                        {formatValue(change.to)}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Rodapé Técnico (Discreto) */}
                            <div className="mt-6 pt-3 border-t border-slate-100 text-[10px] text-slate-300 flex justify-end gap-4 font-mono select-none">
                                <span>ID: {log.record_id?.substring(0,8)}...</span>
                                <span>Tabela: {log.table_name}</span>
                            </div>

                        </div>
                    </CollapsibleContent>
                </Card>
            </Collapsible>
        </div>
    );
}