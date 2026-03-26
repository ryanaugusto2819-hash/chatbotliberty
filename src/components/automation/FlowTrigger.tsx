import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { executeFlow } from '@/lib/automation';
import { GitBranch, Loader2, X } from 'lucide-react';
import { toast } from 'sonner';

interface FlowOption {
  id: string;
  name: string;
  is_active: boolean;
}

interface FlowTriggerProps {
  conversationId: string;
}

export default function FlowTrigger({ conversationId }: FlowTriggerProps) {
  const [open, setOpen] = useState(false);
  const [flows, setFlows] = useState<FlowOption[]>([]);
  const [executing, setExecuting] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      supabase
        .from('automation_flows')
        .select('id, name, is_active')
        .order('is_active', { ascending: false })
        .order('created_at', { ascending: false })
        .then(({ data }) => setFlows(data || []));
    }
  }, [open]);

  const trigger = async (flowId: string) => {
    setExecuting(flowId);
    try {
      // Fire-and-forget: don't await the full flow execution
      supabase.functions.invoke("execute-flow", {
        body: { flowId, conversationId, senderLabel: "humano" },
      }).then(({ error }) => {
        if (error) console.error('Flow execution error:', error);
      });
      
      toast.success('Fluxo disparado com sucesso');
      setOpen(false);
    } catch (err) {
      console.error(err);
      toast.error('Erro ao disparar fluxo');
    } finally {
      setExecuting(null);
    }
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        title="Disparar automação"
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-secondary transition-colors"
      >
        <GitBranch className="h-4 w-4" />
      </button>
    );
  }

  return (
    <div className="absolute bottom-16 left-4 right-4 rounded-xl border border-border bg-card shadow-lg p-3 z-50">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-semibold text-card-foreground">Disparar Automação</p>
        <button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      {flows.length === 0 ? (
        <p className="text-xs text-muted-foreground py-2">Nenhum fluxo criado</p>
      ) : (
        <div className="space-y-1 max-h-40 overflow-y-auto">
          {flows.map((f) => (
            <button
              key={f.id}
              onClick={() => trigger(f.id)}
              disabled={!!executing}
              className="flex items-center justify-between gap-2 w-full rounded-lg px-3 py-2 text-left text-sm text-card-foreground hover:bg-secondary transition-colors disabled:opacity-50"
            >
              <div className="flex items-center gap-2 min-w-0">
                {executing === f.id ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" />
                ) : (
                  <GitBranch className="h-3.5 w-3.5 text-primary shrink-0" />
                )}
                <span className="truncate">{f.name}</span>
              </div>
              <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${f.is_active ? 'bg-primary/10 text-primary' : 'bg-secondary text-muted-foreground'}`}>
                {f.is_active ? 'Ativo' : 'Inativo'}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
