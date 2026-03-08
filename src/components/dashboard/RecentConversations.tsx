import { conversations } from '@/data/mockData';
import { useNavigate } from 'react-router-dom';
import StatusBadge from '@/components/shared/StatusBadge';

export default function RecentConversations() {
  const navigate = useNavigate();
  const recent = conversations.slice(0, 5);

  return (
    <div className="rounded-xl border border-border bg-card shadow-elevated">
      <div className="flex items-center justify-between px-5 py-4 border-b border-border">
        <h3 className="text-sm font-semibold text-card-foreground">Conversas Recentes</h3>
        <button
          onClick={() => navigate('/conversations')}
          className="text-xs font-medium text-primary hover:underline"
        >
          Ver todas
        </button>
      </div>
      <div className="divide-y divide-border">
        {recent.map((c) => (
          <button
            key={c.id}
            onClick={() => navigate(`/conversations/${c.id}`)}
            className="flex items-center gap-3 w-full px-5 py-3 text-left hover:bg-secondary/50 transition-colors"
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-semibold text-accent-foreground">
              {c.contactName.split(' ').map(n => n[0]).join('')}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-card-foreground truncate">{c.contactName}</p>
                <span className="text-[11px] text-muted-foreground shrink-0 ml-2">{c.lastMessageTime}</span>
              </div>
              <p className="text-xs text-muted-foreground truncate">{c.lastMessage}</p>
            </div>
            <div className="shrink-0 ml-2">
              <StatusBadge status={c.status} />
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
