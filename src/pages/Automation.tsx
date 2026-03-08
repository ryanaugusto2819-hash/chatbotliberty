import TopBar from '@/components/layout/TopBar';
import { GitBranch, Plus, Play, Pause, MoreVertical } from 'lucide-react';
import { motion } from 'framer-motion';

const flows = [
  { id: '1', name: 'Boas-vindas', description: 'Mensagem automática para novos contatos', active: true, triggers: 142, nodes: 5 },
  { id: '2', name: 'Horário de Atendimento', description: 'Informa horário quando fora do expediente', active: true, triggers: 89, nodes: 3 },
  { id: '3', name: 'Menu Principal', description: 'Menu interativo com opções de atendimento', active: false, triggers: 0, nodes: 8 },
  { id: '4', name: 'Pesquisa de Satisfação', description: 'NPS após resolução de conversa', active: true, triggers: 56, nodes: 4 },
];

export default function Automation() {
  return (
    <div>
      <TopBar title="Automação" subtitle="Construtor de fluxos automatizados" />
      <div className="p-6 space-y-4">
        <div className="flex justify-end">
          <button className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors">
            <Plus className="h-4 w-4" />
            Novo Fluxo
          </button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {flows.map((flow, i) => (
            <motion.div
              key={flow.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: i * 0.05 }}
              className="rounded-xl border border-border bg-card p-5 shadow-elevated"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent">
                    <GitBranch className="h-5 w-5 text-accent-foreground" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-card-foreground">{flow.name}</p>
                    <p className="text-xs text-muted-foreground">{flow.description}</p>
                  </div>
                </div>
                <button className="text-muted-foreground hover:text-foreground transition-colors">
                  <MoreVertical className="h-4 w-4" />
                </button>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <span>{flow.nodes} nós</span>
                  <span>{flow.triggers} disparos</span>
                </div>
                <button className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-semibold transition-colors ${
                  flow.active ? 'bg-success/15 text-success' : 'bg-secondary text-muted-foreground'
                }`}>
                  {flow.active ? <Play className="h-3 w-3" /> : <Pause className="h-3 w-3" />}
                  {flow.active ? 'Ativo' : 'Inativo'}
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}
