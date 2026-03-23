import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import TopBar from '@/components/layout/TopBar';
import StatusBadge from '@/components/shared/StatusBadge';
import { supabase } from '@/integrations/supabase/client';
import { Search, Loader2, Tag, Filter, X, Smartphone, Globe, Wifi, MessageCircle } from 'lucide-react';
import { motion } from 'framer-motion';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface ConversationRow {
  id: string;
  contact_name: string;
  contact_phone: string;
  status: string;
  tags: string[] | null;
  updated_at: string;
  last_message?: string;
  unread_count?: number;
  assigned_agent_id: string | null;
  niche_id: string | null;
  last_message_sender?: string;
}

interface TagOption {
  id: string;
  name: string;
  color: string;
}

interface AgentOption {
  id: string;
  full_name: string;
}

interface ConnectionInfo {
  id: string;
  label: string;
  connection_id: string; // 'whatsapp' or 'zapi'
}

// Maps niche_id -> connection info
type NicheConnectionMap = Record<string, ConnectionInfo>;

const statusFilters = ['all', 'new', 'pending', 'active', 'last_customer'] as const;
const statusLabels: Record<string, string> = { all: 'Todos', new: 'Novos', pending: 'Pendentes', active: 'Em atendimento', last_customer: 'Última Msg Cliente' };

function ConnectionBadge({ conn }: { conn: ConnectionInfo | null }) {
  if (!conn) return null;

  const isMeta = conn.connection_id === 'whatsapp';
  const Icon = isMeta ? Globe : Smartphone;

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
            isMeta
              ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400'
              : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
          }`}>
            <Icon className="h-2.5 w-2.5" />
            <span className="max-w-[80px] truncate">{conn.label}</span>
          </span>
        </TooltipTrigger>
        <TooltipContent>
          {conn.label} ({isMeta ? 'Meta Cloud API' : 'Z-API'})
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export default function Conversations() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState<string>('all');
  const [selectedTag, setSelectedTag] = useState<string>('all');
  const [selectedAgent, setSelectedAgent] = useState<string>('all');
  const [selectedConnection, setSelectedConnection] = useState<string>('all');
  const [onlyUnread, setOnlyUnread] = useState(false);
  const [conversations, setConversations] = useState<ConversationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [tags, setTags] = useState<TagOption[]>([]);
  const [agents, setAgents] = useState<AgentOption[]>([]);
  const [allConnections, setAllConnections] = useState<ConnectionInfo[]>([]);
  const [nicheConnectionMap, setNicheConnectionMap] = useState<NicheConnectionMap>({});
  const [contactTagMap, setContactTagMap] = useState<Record<string, TagOption[]>>({});
  const [showFilters, setShowFilters] = useState(false);

  const fetchTags = async () => {
    const { data } = await supabase.from('tags').select('id, name, color');
    if (data) setTags(data);
  };

  const fetchAgents = async () => {
    const { data } = await supabase.from('profiles').select('id, full_name');
    if (data) setAgents(data);
  };

  const fetchConnections = async () => {
    // Fetch all active connections
    const { data: configs } = await supabase
      .from('connection_configs')
      .select('id, label, connection_id')
      .eq('is_connected', true);

    if (configs) {
      setAllConnections(configs.map(c => ({ id: c.id, label: c.label, connection_id: c.connection_id })));
    }

    // Fetch niche_connections to map niche_id -> connection
    const { data: nicheConns } = await supabase
      .from('niche_connections')
      .select('niche_id, connection_config_id');

    if (nicheConns && configs) {
      const map: NicheConnectionMap = {};
      nicheConns.forEach((nc: any) => {
        const conn = configs.find((c: any) => c.id === nc.connection_config_id);
        if (conn) {
          map[nc.niche_id] = { id: conn.id, label: conn.label, connection_id: conn.connection_id };
        }
      });
      setNicheConnectionMap(map);
    }
  };

  const fetchContactTags = async () => {
    const { data } = await supabase.from('contact_tags').select('contact_phone, tag_id, tags(id, name, color)');
    if (data) {
      const map: Record<string, TagOption[]> = {};
      data.forEach((ct: any) => {
        if (!map[ct.contact_phone]) map[ct.contact_phone] = [];
        if (ct.tags) map[ct.contact_phone].push(ct.tags);
      });
      setContactTagMap(map);
    }
  };

  const fetchConversations = async () => {
    const { data, error } = await supabase.rpc('get_conversations_with_last_message');

    if (error) {
      console.error('Error fetching conversations:', error);
      setLoading(false);
      return;
    }

    setConversations(
      (data || []).map((c: any) => ({
        ...c,
        unread_count: c.unread_count || 0,
      }))
    );
    setLoading(false);
  };

  useEffect(() => {
    fetchConversations();
    fetchTags();
    fetchAgents();
    fetchContactTags();
    fetchConnections();

    const channel = supabase
      .channel('conversations-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'conversations' }, () => {
        fetchConversations();
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, () => {
        fetchConversations();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const getConversationConnection = (nicheId: string | null): ConnectionInfo | null => {
    if (!nicheId) return null;
    return nicheConnectionMap[nicheId] || null;
  };

  const activeFiltersCount = (selectedTag !== 'all' ? 1 : 0) + (selectedAgent !== 'all' ? 1 : 0) + (selectedConnection !== 'all' ? 1 : 0);

  const filtered = conversations.filter((c) => {
    const matchesSearch = c.contact_name.toLowerCase().includes(search.toLowerCase()) || c.contact_phone.includes(search);
    const matchesStatus = activeFilter === 'all' 
      || (activeFilter === 'last_customer' ? c.last_message_sender === 'customer' : c.status === activeFilter);
    const matchesTag = selectedTag === 'all' || (contactTagMap[c.contact_phone] || []).some(t => t.id === selectedTag);
    const matchesAgent = selectedAgent === 'all' || c.assigned_agent_id === selectedAgent;
    const conn = getConversationConnection(c.niche_id);
    const matchesConnection = selectedConnection === 'all' || conn?.id === selectedConnection;
    const matchesUnread = !onlyUnread || (c.unread_count && c.unread_count > 0);
    return matchesSearch && matchesStatus && matchesTag && matchesAgent && matchesConnection && matchesUnread;
  });

  const clearFilters = () => {
    setSelectedTag('all');
    setSelectedAgent('all');
    setSelectedConnection('all');
  };

  return (
    <div>
      <TopBar title="Conversas" subtitle={`${conversations.length} conversas totais`} />
      <div className="p-6 space-y-4">
        <div className="flex flex-col gap-3">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por nome ou número..."
                className="w-full rounded-lg border border-input bg-card pl-10 pr-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`shrink-0 flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition-colors ${
                  showFilters || activeFiltersCount > 0
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
                }`}
              >
                <Filter className="h-3.5 w-3.5" />
                Filtros
                {activeFiltersCount > 0 && (
                  <span className="flex h-4 w-4 items-center justify-center rounded-full bg-primary-foreground/20 text-[10px]">
                    {activeFiltersCount}
                  </span>
                )}
              </button>
            </div>
          </div>

          {/* Status Filters + Inline Advanced Filters */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
            {statusFilters.map((f) => (
              <button
                key={f}
                onClick={() => setActiveFilter(f)}
                className={`shrink-0 rounded-lg px-3 py-2 text-xs font-medium transition-colors ${
                  activeFilter === f
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
                }`}
              >
                {statusLabels[f]}
              </button>
            ))}
            <button
              onClick={() => setOnlyUnread(!onlyUnread)}
              className={`shrink-0 flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition-colors ${
                onlyUnread
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
              }`}
            >
              <MessageCircle className="h-3 w-3" />
              Não lidas
            </button>

            <div className="h-5 w-px bg-border mx-1 shrink-0" />

            <select
              value={selectedTag}
              onChange={(e) => setSelectedTag(e.target.value)}
              className={`shrink-0 rounded-lg border px-2.5 py-2 text-xs font-medium transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-ring ${
                selectedTag !== 'all'
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-input bg-secondary text-secondary-foreground'
              }`}
            >
              <option value="all">🏷️ Etiqueta</option>
              {tags.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>

            <select
              value={selectedAgent}
              onChange={(e) => setSelectedAgent(e.target.value)}
              className={`shrink-0 rounded-lg border px-2.5 py-2 text-xs font-medium transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-ring ${
                selectedAgent !== 'all'
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-input bg-secondary text-secondary-foreground'
              }`}
            >
              <option value="all">👤 Agente</option>
              {agents.map((a) => (
                <option key={a.id} value={a.id}>{a.full_name}</option>
              ))}
            </select>

            <select
              value={selectedConnection}
              onChange={(e) => setSelectedConnection(e.target.value)}
              className={`shrink-0 rounded-lg border px-2.5 py-2 text-xs font-medium transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-ring ${
                selectedConnection !== 'all'
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-input bg-secondary text-secondary-foreground'
              }`}
            >
              <option value="all">📡 Conexão</option>
              {allConnections.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label} ({c.connection_id === 'whatsapp' ? 'Meta' : 'Z-API'})
                </option>
              ))}
            </select>

            {activeFiltersCount > 0 && (
              <button
                onClick={clearFilters}
                className="shrink-0 flex items-center gap-1 rounded-lg px-2.5 py-2 text-xs font-medium text-destructive hover:bg-destructive/10 transition-colors"
              >
                <X className="h-3 w-3" /> Limpar
              </button>
            )}
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card shadow-elevated overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="divide-y divide-border">
              {filtered.map((c, i) => {
                const cTags = contactTagMap[c.contact_phone] || [];
                const conn = getConversationConnection(c.niche_id);
                return (
                  <motion.button
                    key={c.id}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.2, delay: i * 0.03 }}
                    onClick={() => navigate(`/conversations/${c.id}`)}
                    className="flex items-center gap-4 w-full px-5 py-4 text-left hover:bg-secondary/40 transition-colors"
                  >
                    <div className="relative shrink-0">
                      <div className="flex h-11 w-11 items-center justify-center rounded-full bg-accent text-sm font-semibold text-accent-foreground">
                        {c.contact_name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-0.5">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <p className={`text-sm font-semibold truncate ${c.unread_count && c.unread_count > 0 ? 'text-card-foreground' : 'text-card-foreground/80'}`}>{c.contact_name}</p>
                          <ConnectionBadge conn={conn} />
                        </div>
                        <span className="text-[11px] text-muted-foreground shrink-0 ml-2">
                          {formatDistanceToNow(new Date(c.updated_at), { addSuffix: true, locale: ptBR })}
                        </span>
                      </div>
                      <p className={`text-xs truncate ${c.unread_count && c.unread_count > 0 ? 'text-card-foreground font-medium' : 'text-muted-foreground'}`}>{c.last_message}</p>
                      <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                        <StatusBadge status={c.status as 'new' | 'pending' | 'active' | 'resolved'} />
                        {cTags.map(t => (
                          <span
                            key={t.id}
                            className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium text-white"
                            style={{ backgroundColor: t.color }}
                          >
                            {t.name}
                          </span>
                        ))}
                        {c.unread_count != null && c.unread_count > 0 && (
                          <span className="ml-auto h-2.5 w-2.5 rounded-full bg-primary shrink-0" />
                        )}
                      </div>
                    </div>
                  </motion.button>
                );
              })}
              {filtered.length === 0 && (
                <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
                  Nenhuma conversa encontrada
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
