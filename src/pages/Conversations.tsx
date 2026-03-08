import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import TopBar from '@/components/layout/TopBar';
import StatusBadge from '@/components/shared/StatusBadge';
import { conversations } from '@/data/mockData';
import { Search, Filter } from 'lucide-react';
import { motion } from 'framer-motion';

const statusFilters = ['all', 'new', 'pending', 'active', 'resolved'] as const;
const statusLabels: Record<string, string> = { all: 'Todos', new: 'Novos', pending: 'Pendentes', active: 'Em atendimento', resolved: 'Resolvidos' };

export default function Conversations() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState<string>('all');

  const filtered = conversations.filter((c) => {
    const matchesSearch = c.contactName.toLowerCase().includes(search.toLowerCase()) || c.contactPhone.includes(search);
    const matchesFilter = activeFilter === 'all' || c.status === activeFilter;
    return matchesSearch && matchesFilter;
  });

  return (
    <div>
      <TopBar title="Conversas" subtitle={`${conversations.length} conversas totais`} />
      <div className="p-6 space-y-4">
        {/* Search & Filters */}
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
        </div>

        {/* Conversations List */}
        <div className="rounded-xl border border-border bg-card shadow-elevated overflow-hidden">
          <div className="divide-y divide-border">
            {filtered.map((c, i) => (
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
                    {c.contactName.split(' ').map(n => n[0]).join('')}
                  </div>
                  {c.unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
                      {c.unreadCount}
                    </span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-0.5">
                    <p className="text-sm font-semibold text-card-foreground truncate">{c.contactName}</p>
                    <span className="text-[11px] text-muted-foreground shrink-0 ml-2">{c.lastMessageTime}</span>
                  </div>
                  <p className="text-xs text-muted-foreground truncate">{c.lastMessage}</p>
                  <div className="flex items-center gap-2 mt-1.5">
                    <StatusBadge status={c.status} />
                    {c.tags.map(t => (
                      <span key={t} className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-medium text-secondary-foreground">{t}</span>
                    ))}
                  </div>
                </div>
              </motion.button>
            ))}
            {filtered.length === 0 && (
              <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
                Nenhuma conversa encontrada
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
