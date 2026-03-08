import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import TopBar from '@/components/layout/TopBar';
import StatusBadge from '@/components/shared/StatusBadge';
import { supabase } from '@/integrations/supabase/client';
import { Search, Loader2, Tag, Filter, X } from 'lucide-react';
import { motion } from 'framer-motion';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

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

const statusFilters = ['all', 'new', 'pending', 'active', 'resolved'] as const;
const statusLabels: Record<string, string> = { all: 'Todos', new: 'Novos', pending: 'Pendentes', active: 'Em atendimento', resolved: 'Resolvidos' };

export default function Conversations() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState<string>('all');
  const [selectedTag, setSelectedTag] = useState<string>('all');
  const [selectedAgent, setSelectedAgent] = useState<string>('all');
  const [conversations, setConversations] = useState<ConversationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [tags, setTags] = useState<TagOption[]>([]);
  const [agents, setAgents] = useState<AgentOption[]>([]);
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
    const { data, error } = await supabase
      .from('conversations')
      .select('*')
      .order('updated_at', { ascending: false });

    if (error) {
      console.error('Error fetching conversations:', error);
      return;
    }

    const convs: ConversationRow[] = [];
    for (const c of data || []) {
      const { data: msgs } = await supabase
        .from('messages')
        .select('content')
        .eq('conversation_id', c.id)
        .order('created_at', { ascending: false })
        .limit(1);

      convs.push({
        ...c,
        last_message: msgs?.[0]?.content || '',
        unread_count: 0,
      });
    }
    setConversations(convs);
    setLoading(false);
  };

  useEffect(() => {
    fetchConversations();
    fetchTags();
    fetchAgents();
    fetchContactTags();

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

  const activeFiltersCount = (selectedTag !== 'all' ? 1 : 0) + (selectedAgent !== 'all' ? 1 : 0);

  const filtered = conversations.filter((c) => {
    const matchesSearch = c.contact_name.toLowerCase().includes(search.toLowerCase()) || c.contact_phone.includes(search);
    const matchesStatus = activeFilter === 'all' || c.status === activeFilter;
    const matchesTag = selectedTag === 'all' || (contactTagMap[c.contact_phone] || []).some(t => t.id === selectedTag);
    const matchesAgent = selectedAgent === 'all' || c.assigned_agent_id === selectedAgent;
    return matchesSearch && matchesStatus && matchesTag && matchesAgent;
  });

  const clearFilters = () => {
    setSelectedTag('all');
    setSelectedAgent('all');
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

          {/* Status Filters */}
          <div className="flex items-center gap-1.5 overflow-x-auto">
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
          </div>

          {/* Advanced Filters */}
          {showFilters && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="flex flex-col sm:flex-row gap-3 p-3 rounded-lg border border-border bg-card"
            >
              <div className="flex-1 space-y-1.5">
                <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                  <Tag className="h-3 w-3" /> Etiqueta
                </label>
                <select
                  value={selectedTag}
                  onChange={(e) => setSelectedTag(e.target.value)}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="all">Todas as etiquetas</option>
                  {tags.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>
              <div className="flex-1 space-y-1.5">
                <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                  <Filter className="h-3 w-3" /> Agente / Departamento
                </label>
                <select
                  value={selectedAgent}
                  onChange={(e) => setSelectedAgent(e.target.value)}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="all">Todos os agentes</option>
                  {agents.map((a) => (
                    <option key={a.id} value={a.id}>{a.full_name}</option>
                  ))}
                </select>
              </div>
              {activeFiltersCount > 0 && (
                <div className="flex items-end">
                  <button
                    onClick={clearFilters}
                    className="flex items-center gap-1 rounded-lg px-3 py-2 text-xs font-medium text-destructive hover:bg-destructive/10 transition-colors"
                  >
                    <X className="h-3 w-3" /> Limpar
                  </button>
                </div>
              )}
            </motion.div>
          )}
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
                        <p className="text-sm font-semibold text-card-foreground truncate">{c.contact_name}</p>
                        <span className="text-[11px] text-muted-foreground shrink-0 ml-2">
                          {formatDistanceToNow(new Date(c.updated_at), { addSuffix: true, locale: ptBR })}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground truncate">{c.last_message}</p>
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
