import TopBar from '@/components/layout/TopBar';
import { agents } from '@/data/mockData';
import { motion } from 'framer-motion';
import { MessageSquare, CheckCircle2, Clock, Plus } from 'lucide-react';

const statusColors = { online: 'bg-success', offline: 'bg-muted-foreground', away: 'bg-warning' };
const statusLabels = { online: 'Online', offline: 'Offline', away: 'Ausente' };

export default function Agents() {
  return (
    <div>
      <TopBar title="Atendentes" subtitle={`${agents.length} atendentes cadastrados`} />
      <div className="p-6 space-y-4">
        <div className="flex justify-end">
          <button className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors">
            <Plus className="h-4 w-4" />
            Adicionar Agente
          </button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {agents.map((agent, i) => (
            <motion.div
              key={agent.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: i * 0.05 }}
              className="rounded-xl border border-border bg-card p-5 shadow-elevated"
            >
              <div className="flex items-start gap-4">
                <div className="relative">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-accent text-sm font-bold text-accent-foreground">
                    {agent.name.split(' ').map(n => n[0]).join('')}
                  </div>
                  <span className={`absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-card ${statusColors[agent.status]}`} />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-card-foreground">{agent.name}</p>
                    <span className={`text-[10px] font-semibold uppercase tracking-wider ${agent.status === 'online' ? 'text-success' : agent.status === 'away' ? 'text-warning' : 'text-muted-foreground'}`}>
                      {statusLabels[agent.status]}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mb-3">{agent.email}</p>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="text-center rounded-lg bg-secondary p-2">
                      <MessageSquare className="h-3.5 w-3.5 text-muted-foreground mx-auto mb-1" />
                      <p className="text-sm font-bold text-card-foreground">{agent.activeConversations}</p>
                      <p className="text-[10px] text-muted-foreground">Ativas</p>
                    </div>
                    <div className="text-center rounded-lg bg-secondary p-2">
                      <CheckCircle2 className="h-3.5 w-3.5 text-muted-foreground mx-auto mb-1" />
                      <p className="text-sm font-bold text-card-foreground">{agent.resolvedToday}</p>
                      <p className="text-[10px] text-muted-foreground">Resolvidas</p>
                    </div>
                    <div className="text-center rounded-lg bg-secondary p-2">
                      <Clock className="h-3.5 w-3.5 text-muted-foreground mx-auto mb-1" />
                      <p className="text-sm font-bold text-card-foreground">{agent.avgResponseTime}</p>
                      <p className="text-[10px] text-muted-foreground">Resp.</p>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}
