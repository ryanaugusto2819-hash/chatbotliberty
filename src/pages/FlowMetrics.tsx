import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import TopBar from '@/components/layout/TopBar';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, ArrowLeft, GitBranch, CheckCircle2, XCircle, ArrowDown, Users, TrendingDown } from 'lucide-react';
import { motion } from 'framer-motion';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface FlowInfo {
  id: string;
  name: string;
  description: string | null;
  trigger_count: number;
  is_active: boolean;
}

interface NodeMetric {
  node_id: string;
  node_label: string;
  node_type: string;
  sort_order: number;
  total: number;
  completed: number;
  failed: number;
  skipped: number;
}

interface ExecutionRow {
  id: string;
  status: string;
  total_nodes: number;
  completed_nodes: number;
  started_at: string;
  completed_at: string | null;
}

export default function FlowMetrics() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [flow, setFlow] = useState<FlowInfo | null>(null);
  const [nodeMetrics, setNodeMetrics] = useState<NodeMetric[]>([]);
  const [executions, setExecutions] = useState<ExecutionRow[]>([]);
  const [totalExecs, setTotalExecs] = useState(0);
  const [completedExecs, setCompletedExecs] = useState(0);
  const [failedExecs, setFailedExecs] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) fetchMetrics();
  }, [id]);

  const fetchMetrics = async () => {
    if (!id) return;

    const [flowRes, execsRes, stepsRes, recentRes] = await Promise.all([
      supabase.from('automation_flows').select('id, name, description, trigger_count, is_active').eq('id', id).single(),
      supabase.from('flow_executions').select('id, status', { count: 'exact' }).eq('flow_id', id),
      supabase.from('flow_step_logs').select('node_id, node_type, node_label, sort_order, status, execution_id')
        .in('execution_id', 
          (await supabase.from('flow_executions').select('id').eq('flow_id', id)).data?.map(e => e.id) || []
        ),
      supabase.from('flow_executions').select('id, status, total_nodes, completed_nodes, started_at, completed_at')
        .eq('flow_id', id).order('started_at', { ascending: false }).limit(20),
    ]);

    if (flowRes.data) setFlow(flowRes.data);

    const allExecs = execsRes.data || [];
    setTotalExecs(execsRes.count ?? 0);
    setCompletedExecs(allExecs.filter(e => e.status === 'completed').length);
    setFailedExecs(allExecs.filter(e => e.status === 'failed').length);
    setExecutions(recentRes.data || []);

    // Build node metrics from steps
    const steps = stepsRes.data || [];
    const nodeMap = new Map<string, NodeMetric>();

    for (const step of steps) {
      if (!nodeMap.has(step.node_id)) {
        nodeMap.set(step.node_id, {
          node_id: step.node_id,
          node_label: step.node_label,
          node_type: step.node_type,
          sort_order: step.sort_order,
          total: 0,
          completed: 0,
          failed: 0,
          skipped: 0,
        });
      }
      const m = nodeMap.get(step.node_id)!;
      m.total++;
      if (step.status === 'completed') m.completed++;
      else if (step.status === 'failed') m.failed++;
      else if (step.status === 'skipped') m.skipped++;
    }

    const sorted = Array.from(nodeMap.values()).sort((a, b) => a.sort_order - b.sort_order);
    setNodeMetrics(sorted);
    setLoading(false);
  };

  if (loading) {
    return (
      <div>
        <TopBar title="Métricas do Fluxo" subtitle="Carregando..." />
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  if (!flow) {
    return (
      <div>
        <TopBar title="Métricas do Fluxo" subtitle="Fluxo não encontrado" />
        <div className="p-6">
          <button onClick={() => navigate('/automation')} className="text-sm text-primary hover:underline">
            ← Voltar para Automação
          </button>
        </div>
      </div>
    );
  }

  const completionRate = totalExecs > 0 ? Math.round((completedExecs / totalExecs) * 100) : 0;
  const abandonRate = totalExecs > 0 ? Math.round((failedExecs / totalExecs) * 100) : 0;

  return (
    <div>
      <TopBar title="Métricas do Fluxo" subtitle={flow.name} />
      <div className="p-6 max-w-3xl space-y-6">
        {/* Back button */}
        <button
          onClick={() => navigate('/automation')}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar para Automação
        </button>

        {/* Overview cards */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="grid grid-cols-2 md:grid-cols-4 gap-3"
        >
          <div className="rounded-xl border border-border bg-card p-4 shadow-elevated">
            <div className="flex items-center gap-2 mb-2">
              <Users className="h-4 w-4 text-primary" />
              <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Execuções</span>
            </div>
            <p className="text-2xl font-bold text-card-foreground">{totalExecs}</p>
          </div>

          <div className="rounded-xl border border-border bg-card p-4 shadow-elevated">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle2 className="h-4 w-4 text-success" />
              <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Concluídas</span>
            </div>
            <p className="text-2xl font-bold text-card-foreground">{completedExecs}</p>
            <p className="text-[10px] text-muted-foreground">{completionRate}% taxa</p>
          </div>

          <div className="rounded-xl border border-border bg-card p-4 shadow-elevated">
            <div className="flex items-center gap-2 mb-2">
              <XCircle className="h-4 w-4 text-destructive" />
              <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Falharam</span>
            </div>
            <p className="text-2xl font-bold text-card-foreground">{failedExecs}</p>
            <p className="text-[10px] text-muted-foreground">{abandonRate}% abandono</p>
          </div>

          <div className="rounded-xl border border-border bg-card p-4 shadow-elevated">
            <div className="flex items-center gap-2 mb-2">
              <GitBranch className="h-4 w-4 text-primary" />
              <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Disparos</span>
            </div>
            <p className="text-2xl font-bold text-card-foreground">{flow.trigger_count}</p>
          </div>
        </motion.div>

        {/* Funnel Visualization */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
          className="rounded-xl border border-border bg-card p-6 shadow-elevated"
        >
          <div className="flex items-center gap-3 mb-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent">
              <TrendingDown className="h-5 w-5 text-accent-foreground" />
            </div>
            <div>
              <p className="text-sm font-semibold text-card-foreground">Funil de Conversão</p>
              <p className="text-xs text-muted-foreground">
                Visualize a conversão e abandono em cada etapa do fluxo
              </p>
            </div>
          </div>

          {nodeMetrics.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border p-8 text-center">
              <TrendingDown className="h-8 w-8 text-muted-foreground/40 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">Nenhuma execução registrada ainda</p>
              <p className="text-xs text-muted-foreground mt-1">
                Os dados aparecerão após o fluxo ser executado
              </p>
            </div>
          ) : (
            <div className="space-y-1">
              {nodeMetrics.map((node, i) => {
                const maxTotal = nodeMetrics[0]?.total || 1;
                const barWidth = Math.max((node.total / maxTotal) * 100, 8);
                const conversionFromPrev = i > 0 && nodeMetrics[i - 1].total > 0
                  ? Math.round((node.completed / nodeMetrics[i - 1].total) * 100)
                  : node.total > 0 ? Math.round((node.completed / node.total) * 100) : 0;
                const dropoff = i > 0 ? nodeMetrics[i - 1].total - node.total : 0;

                const typeLabels: Record<string, string> = {
                  trigger: 'Gatilho',
                  message: 'Mensagem',
                  delay: 'Espera',
                  image: 'Imagem',
                  audio: 'Áudio',
                  video: 'Vídeo',
                };

                return (
                  <div key={node.node_id}>
                    {/* Drop-off indicator between steps */}
                    {i > 0 && dropoff > 0 && (
                      <div className="flex items-center gap-2 py-1.5 pl-4">
                        <ArrowDown className="h-3 w-3 text-destructive/60" />
                        <span className="text-[10px] text-destructive/80 font-medium">
                          -{dropoff} abandonaram ({Math.round((dropoff / nodeMetrics[i - 1].total) * 100)}%)
                        </span>
                      </div>
                    )}

                    <div className="rounded-lg border border-border bg-background p-3">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">
                            {i + 1}
                          </span>
                          <span className="text-xs font-medium text-foreground">
                            {node.node_label || typeLabels[node.node_type] || node.node_type}
                          </span>
                          <span className="rounded-full bg-secondary px-1.5 py-0.5 text-[9px] text-muted-foreground">
                            {typeLabels[node.node_type] || node.node_type}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 text-[10px]">
                          <span className="text-muted-foreground">{node.total} execuções</span>
                          <span className="font-semibold text-primary">{conversionFromPrev}%</span>
                        </div>
                      </div>

                      {/* Funnel bar */}
                      <div className="relative h-6 w-full rounded-md bg-muted overflow-hidden">
                        <div
                          className="absolute inset-y-0 left-0 rounded-md bg-primary/20 transition-all duration-500"
                          style={{ width: `${barWidth}%` }}
                        />
                        {node.completed > 0 && (
                          <div
                            className="absolute inset-y-0 left-0 rounded-md bg-primary/60 transition-all duration-500"
                            style={{ width: `${(node.completed / maxTotal) * 100}%` }}
                          />
                        )}
                        {node.failed > 0 && (
                          <div
                            className="absolute inset-y-0 rounded-md bg-destructive/40 transition-all duration-500"
                            style={{
                              left: `${(node.completed / maxTotal) * 100}%`,
                              width: `${(node.failed / maxTotal) * 100}%`,
                            }}
                          />
                        )}
                      </div>

                      {/* Stats row */}
                      <div className="flex items-center gap-4 mt-1.5">
                        <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                          <span className="h-2 w-2 rounded-full bg-primary/60" /> {node.completed} sucesso
                        </span>
                        {node.failed > 0 && (
                          <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                            <span className="h-2 w-2 rounded-full bg-destructive/40" /> {node.failed} falhas
                          </span>
                        )}
                        {node.skipped > 0 && (
                          <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                            <span className="h-2 w-2 rounded-full bg-muted-foreground/30" /> {node.skipped} pulados
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </motion.div>

        {/* Recent Executions */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.2 }}
          className="rounded-xl border border-border bg-card p-6 shadow-elevated"
        >
          <p className="text-sm font-semibold text-card-foreground mb-4">Execuções Recentes</p>

          {executions.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-6">Nenhuma execução registrada</p>
          ) : (
            <div className="space-y-2 max-h-72 overflow-y-auto">
              {executions.map((exec) => (
                <div key={exec.id} className="flex items-center justify-between rounded-lg border border-border bg-background p-3">
                  <div className="flex items-center gap-3">
                    {exec.status === 'completed' ? (
                      <CheckCircle2 className="h-4 w-4 text-success shrink-0" />
                    ) : exec.status === 'failed' ? (
                      <XCircle className="h-4 w-4 text-destructive shrink-0" />
                    ) : (
                      <Loader2 className="h-4 w-4 text-primary animate-spin shrink-0" />
                    )}
                    <div>
                      <p className="text-xs font-medium text-foreground capitalize">
                        {exec.status === 'completed' ? 'Concluída' : exec.status === 'failed' ? 'Falhou' : 'Executando'}
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        {exec.completed_nodes}/{exec.total_nodes} etapas · {formatDistanceToNow(new Date(exec.started_at), { addSuffix: true, locale: ptBR })}
                      </p>
                    </div>
                  </div>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                      exec.status === 'completed'
                        ? 'bg-success/10 text-success'
                        : exec.status === 'failed'
                        ? 'bg-destructive/10 text-destructive'
                        : 'bg-primary/10 text-primary'
                    }`}
                  >
                    {exec.status === 'completed' ? '100%' : `${Math.round((exec.completed_nodes / exec.total_nodes) * 100)}%`}
                  </span>
                </div>
              ))}
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}
