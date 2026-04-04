import { conversations } from '@/data/mockData';
import { useNavigate } from 'react-router-dom';
import StatusBadge from '@/components/shared/StatusBadge';
import { MessageSquare, ArrowRight, Clock } from 'lucide-react';
import { motion } from 'framer-motion';

const avatarColors = [
  { from: '#7c3aed', to: '#9333ea' },
  { from: '#059669', to: '#10b981' },
  { from: '#2563eb', to: '#3b82f6' },
  { from: '#d97706', to: '#f59e0b' },
  { from: '#0d9488', to: '#14b8a6' },
  { from: '#dc2626', to: '#ef4444' },
];

export default function RecentConversations() {
  const navigate = useNavigate();
  const recent = conversations.slice(0, 5);

  return (
    <div className="cfo-card accent-teal flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-border/70">
        <div className="flex items-center gap-2.5">
          <div
            className="icon-box icon-box-teal"
            style={{ width: 36, height: 36, borderRadius: 10 }}
          >
            <MessageSquare className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-card-foreground">Conversas Recentes</h3>
            <p className="text-[11px] text-muted-foreground font-medium">
              {recent.length} conversas ativas
            </p>
          </div>
        </div>
        <button
          onClick={() => navigate('/conversations')}
          className="flex items-center gap-1 text-xs font-semibold transition-all duration-150 rounded-xl px-3 py-1.5 group"
          style={{ color: '#7c3aed', background: 'rgba(124,58,237,0.07)', border: '1px solid rgba(124,58,237,0.12)' }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.background = 'rgba(124,58,237,0.14)';
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.background = 'rgba(124,58,237,0.07)';
          }}
        >
          Ver todas
          <ArrowRight className="h-3 w-3 transition-transform duration-150 group-hover:translate-x-0.5" />
        </button>
      </div>

      {/* List */}
      <div className="flex-1 divide-y divide-border/50">
        {recent.map((c, i) => {
          const avatarColor = avatarColors[i % avatarColors.length];
          const initials = c.contactName
            .split(' ')
            .map((n: string) => n[0])
            .join('')
            .slice(0, 2)
            .toUpperCase();

          return (
            <motion.button
              key={c.id}
              onClick={() => navigate(`/conversations/${c.id}`)}
              className="flex items-center gap-3 w-full px-5 py-3.5 text-left transition-colors hover:bg-secondary/40 group"
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.06, duration: 0.3 }}
            >
              {/* Avatar */}
              <div
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
                style={{
                  background: `linear-gradient(135deg, ${avatarColor.from}, ${avatarColor.to})`,
                  boxShadow: `0 2px 8px ${avatarColor.from}35`,
                }}
              >
                {initials}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-0.5">
                  <p className="text-sm font-semibold text-card-foreground truncate group-hover:text-primary transition-colors">
                    {c.contactName}
                  </p>
                  <div className="flex items-center gap-1 shrink-0 ml-2">
                    <Clock className="h-3 w-3 text-muted-foreground/60" />
                    <span className="text-[10px] text-muted-foreground font-medium">
                      {c.lastMessageTime}
                    </span>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground truncate leading-relaxed">
                  {c.lastMessage}
                </p>
              </div>

              {/* Status */}
              <div className="shrink-0 ml-1">
                <StatusBadge status={c.status} />
              </div>
            </motion.button>
          );
        })}
      </div>

      {/* Footer */}
      <div
        className="px-5 py-3 border-t border-border/50"
        style={{ background: 'hsl(var(--muted) / 0.3)' }}
      >
        <button
          onClick={() => navigate('/conversations')}
          className="w-full flex items-center justify-center gap-1.5 text-xs font-semibold transition-all duration-150 py-1.5 rounded-lg group"
          style={{ color: '#7c3aed' }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.background = 'rgba(124,58,237,0.06)';
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.background = '';
          }}
        >
          Ver todas as conversas
          <ArrowRight className="h-3.5 w-3.5 transition-transform duration-150 group-hover:translate-x-0.5" />
        </button>
      </div>
    </div>
  );
}
