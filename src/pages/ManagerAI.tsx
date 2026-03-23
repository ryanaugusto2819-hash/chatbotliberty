import TopBar from '@/components/layout/TopBar';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ShieldCheck, AlertTriangle, CheckCircle2, Info, Lightbulb,
  TrendingUp, ArrowRight, Clock, RefreshCw,
} from 'lucide-react';
import { toast } from 'sonner';

interface Issue {
  type: 'error' | 'warning' | 'info';
  title: string;
  description: string;
  excerpt?: string;
}

interface Suggestion {
  priority: 'high' | 'medium' | 'low';
  title: string;
  description: string;
}

interface FlowAnalyzed {
  flow_name: string;
  was_appropriate: boolean;
  reason: string;
}

interface Analysis {
  id: string;
  conversation_id: string;
  overall_score: number;
  flow_accuracy_score: number;
  response_quality_score: number;
  context_adherence_score: number;
  summary: string;
  issues: Issue[];
  suggestions: Suggestion[];
  flows_analyzed: FlowAnalyzed[];
  created_at: string;
  conversations?: { contact_name: string; contact_phone: string; status: string };
}

function ScoreCircle({ score, label, size = 'md' }: { score: number; label: string; size?: 'sm' | 'md' | 'lg' }) {
  const color = score >= 80 ? 'text-success' : score >= 50 ? 'text-warning' : 'text-destructive';
  const bgColor = score >= 80 ? 'bg-success/10' : score >= 50 ? 'bg-warning/10' : 'bg-destructive/10';
  const sizeClasses = size === 'lg' ? 'h-24 w-24 text-3xl' : size === 'md' ? 'h-16 w-16 text-xl' : 'h-12 w-12 text-sm';

  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className={`${sizeClasses} ${bgColor} ${color} rounded-full flex items-center justify-center font-bold`}>
        {score}
      </div>
      <span className="text-xs text-muted-foreground text-center">{label}</span>
    </div>
  );
}

function IssueIcon({ type }: { type: string }) {
  if (type === 'error') return <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />;
  if (type === 'warning') return <AlertTriangle className="h-4 w-4 text-warning shrink-0" />;
  return <Info className="h-4 w-4 text-info shrink-0" />;
}

function PriorityBadge({ priority }: { priority: string }) {
  const styles = {
    high: 'bg-destructive/10 text-destructive',
    medium: 'bg-warning/10 text-warning',
    low: 'bg-info/10 text-info',
  };
  const labels = { high: 'Alta', medium: 'Média', low: 'Baixa' };
  return (
    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${styles[priority as keyof typeof styles] || ''}`}>
      {labels[priority as keyof typeof labels] || priority}
    </span>
  );
}

export default function ManagerAI() {
  const navigate = useNavigate();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);

  const { data: analyses, isLoading, refetch } = useQuery({
    queryKey: ['manager-analyses'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('manager_analyses')
        .select('*, conversations(contact_name, contact_phone, status)')
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data || []) as unknown as Analysis[];
    },
  });

  const selected = analyses?.find(a => a.id === selectedId);

  // Aggregate metrics
  const avgScore = analyses?.length
    ? Math.round(analyses.reduce((s, a) => s + a.overall_score, 0) / analyses.length)
    : 0;
  const totalIssues = analyses?.reduce((s, a) => s + (a.issues?.length || 0), 0) || 0;
  const totalErrors = analyses?.reduce((s, a) => s + (a.issues?.filter(i => i.type === 'error').length || 0), 0) || 0;

  const handleManualAnalyze = async () => {
    setAnalyzing(true);
    try {
      const res = await supabase.functions.invoke('ai-manager-cron', { body: {} });
      if (res.error) throw res.error;
      toast.success(`Análise concluída: ${res.data?.analyzed || 0} conversas analisadas`);
      refetch();
    } catch (e: any) {
      toast.error('Erro ao analisar: ' + (e.message || 'Erro desconhecido'));
    } finally {
      setAnalyzing(false);
    }
  };

  return (
    <div>
      <TopBar title="IA Gerente" subtitle="Análise automática de qualidade do atendimento" />
      <div className="p-6 space-y-6">
        {/* Header metrics */}
        <div className="flex items-center justify-between">
          <div className="grid grid-cols-3 gap-4">
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="rounded-xl border border-border bg-card p-4 flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <ShieldCheck className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Score Médio</p>
                <p className="text-xl font-bold text-card-foreground">{avgScore}</p>
              </div>
            </motion.div>
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="rounded-xl border border-border bg-card p-4 flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-warning/10 flex items-center justify-center">
                <AlertTriangle className="h-5 w-5 text-warning" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Problemas</p>
                <p className="text-xl font-bold text-card-foreground">{totalIssues}</p>
              </div>
            </motion.div>
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="rounded-xl border border-border bg-card p-4 flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-destructive/10 flex items-center justify-center">
                <AlertTriangle className="h-5 w-5 text-destructive" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Erros Críticos</p>
                <p className="text-xl font-bold text-card-foreground">{totalErrors}</p>
              </div>
            </motion.div>
          </div>
          <button
            onClick={handleManualAnalyze}
            disabled={analyzing}
            className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            <RefreshCw className={`h-4 w-4 ${analyzing ? 'animate-spin' : ''}`} />
            {analyzing ? 'Analisando...' : 'Analisar Agora'}
          </button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          </div>
        ) : !analyses?.length ? (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
            <ShieldCheck className="h-12 w-12 mb-3 opacity-40" />
            <p className="text-sm">Nenhuma análise realizada ainda</p>
            <p className="text-xs mt-1">A IA Gerente analisa automaticamente conversas inativas há 3+ horas</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* List */}
            <div className="lg:col-span-1 space-y-2 max-h-[calc(100vh-280px)] overflow-y-auto pr-1">
              {analyses.map((a, i) => (
                <motion.button
                  key={a.id}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.03 }}
                  onClick={() => setSelectedId(a.id)}
                  className={`w-full text-left rounded-xl border p-4 transition-all ${
                    selectedId === a.id ? 'border-primary bg-primary/5' : 'border-border bg-card hover:border-primary/30'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-medium text-card-foreground truncate">
                      {a.conversations?.contact_name || 'Desconhecido'}
                    </p>
                    <ScoreCircle score={a.overall_score} label="" size="sm" />
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-2">{a.summary}</p>
                  <div className="flex items-center gap-2 mt-2">
                    <Clock className="h-3 w-3 text-muted-foreground" />
                    <span className="text-[10px] text-muted-foreground">
                      {new Date(a.created_at).toLocaleString('pt-BR')}
                    </span>
                    {(a.issues?.filter(i => i.type === 'error').length || 0) > 0 && (
                      <span className="text-[10px] text-destructive font-medium ml-auto">
                        {a.issues.filter(i => i.type === 'error').length} erro(s)
                      </span>
                    )}
                  </div>
                </motion.button>
              ))}
            </div>

            {/* Detail */}
            <div className="lg:col-span-2">
              {selected ? (
                <motion.div
                  key={selected.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-5"
                >
                  {/* Scores */}
                  <div className="rounded-xl border border-border bg-card p-5">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-sm font-semibold text-card-foreground">
                        Análise: {selected.conversations?.contact_name}
                      </h3>
                      <button
                        onClick={() => navigate(`/conversations/${selected.conversation_id}`)}
                        className="flex items-center gap-1 text-xs text-primary hover:underline"
                      >
                        Ver conversa <ArrowRight className="h-3 w-3" />
                      </button>
                    </div>
                    <div className="flex items-center justify-around">
                      <ScoreCircle score={selected.overall_score} label="Geral" size="lg" />
                      <ScoreCircle score={selected.response_quality_score} label="Qualidade" />
                      <ScoreCircle score={selected.flow_accuracy_score} label="Fluxos" />
                      <ScoreCircle score={selected.context_adherence_score} label="Contexto" />
                    </div>
                    <p className="text-sm text-muted-foreground mt-4 text-center">{selected.summary}</p>
                  </div>

                  {/* Issues */}
                  {selected.issues?.length > 0 && (
                    <div className="rounded-xl border border-border bg-card p-5">
                      <h3 className="text-sm font-semibold text-card-foreground mb-3 flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4" /> Problemas Identificados
                      </h3>
                      <div className="space-y-3">
                        {selected.issues.map((issue, i) => (
                          <div key={i} className="flex gap-3 p-3 rounded-lg bg-secondary/50">
                            <IssueIcon type={issue.type} />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-card-foreground">{issue.title}</p>
                              <p className="text-xs text-muted-foreground mt-0.5">{issue.description}</p>
                              {issue.excerpt && (
                                <p className="text-xs text-muted-foreground mt-1 italic border-l-2 border-border pl-2">
                                  "{issue.excerpt}"
                                </p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Flow analysis */}
                  {selected.flows_analyzed?.length > 0 && (
                    <div className="rounded-xl border border-border bg-card p-5">
                      <h3 className="text-sm font-semibold text-card-foreground mb-3 flex items-center gap-2">
                        <TrendingUp className="h-4 w-4" /> Análise dos Fluxos
                      </h3>
                      <div className="space-y-2">
                        {selected.flows_analyzed.map((flow, i) => (
                          <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-secondary/50">
                            {flow.was_appropriate
                              ? <CheckCircle2 className="h-4 w-4 text-success shrink-0 mt-0.5" />
                              : <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                            }
                            <div>
                              <p className="text-sm font-medium text-card-foreground">{flow.flow_name}</p>
                              <p className="text-xs text-muted-foreground">{flow.reason}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Suggestions */}
                  {selected.suggestions?.length > 0 && (
                    <div className="rounded-xl border border-border bg-card p-5">
                      <h3 className="text-sm font-semibold text-card-foreground mb-3 flex items-center gap-2">
                        <Lightbulb className="h-4 w-4" /> Sugestões de Melhoria
                      </h3>
                      <div className="space-y-2">
                        {selected.suggestions.map((sug, i) => (
                          <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-secondary/50">
                            <PriorityBadge priority={sug.priority} />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-card-foreground">{sug.title}</p>
                              <p className="text-xs text-muted-foreground">{sug.description}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </motion.div>
              ) : (
                <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
                  <ShieldCheck className="h-10 w-10 mb-2 opacity-40" />
                  <p className="text-sm">Selecione uma análise para ver os detalhes</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
