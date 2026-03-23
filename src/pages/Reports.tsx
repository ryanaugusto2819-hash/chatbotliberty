import TopBar from '@/components/layout/TopBar';
import MetricCard from '@/components/dashboard/MetricCard';
import { useReportMetrics } from '@/hooks/useReportMetrics';
import { useFunnelMetrics } from '@/hooks/useFunnelMetrics';
import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  MessageSquare, CheckCircle2, Clock, Send, Inbox, Bot,
  TrendingUp, BarChart3, Filter, ArrowDown, Zap, Target,
  AlertTriangle,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, PieChart, Pie, Cell, LineChart, Line,
  FunnelChart, Funnel, LabelList,
} from 'recharts';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';

const PERIOD_OPTIONS = [
  { label: '7 dias', value: 7 },
  { label: '14 dias', value: 14 },
  { label: '30 dias', value: 30 },
];

const STATUS_COLORS: Record<string, string> = {
  new: 'hsl(var(--info))',
  pending: 'hsl(var(--warning))',
  active: 'hsl(var(--primary))',
  resolved: 'hsl(var(--success))',
};

const STEP_COLORS = [
  'hsl(var(--primary))',
  'hsl(var(--info))',
  'hsl(var(--warning))',
  'hsl(var(--success))',
  'hsl(var(--accent-foreground))',
  'hsl(var(--muted-foreground))',
];

const NODE_TYPE_LABELS: Record<string, string> = {
  message: '💬 Mensagem',
  delay: '⏱️ Delay',
  condition: '🔀 Condição',
  ai_response: '🤖 IA',
  webhook: '🔗 Webhook',
  assign_agent: '👤 Atribuir',
  tag: '🏷️ Tag',
  media: '📎 Mídia',
};

export default function Reports() {
  const [period, setPeriod] = useState(14);
  const { metrics, daily, statusDistribution, isLoading } = useReportMetrics(period);
  const { flowSummaries, funnels, isLoading: funnelLoading } = useFunnelMetrics(period);

  const metricCards = metrics
    ? [
        { title: 'Total de Conversas', value: metrics.totalConversations, icon: MessageSquare },
        { title: 'Resolvidas', value: metrics.resolvedConversations, icon: CheckCircle2, changeType: 'positive' as const, change: `${metrics.resolutionRate}% de resolução` },
        { title: 'Pendentes', value: metrics.pendingConversations, icon: Clock, changeType: 'neutral' as const },
        { title: 'Total de Mensagens', value: metrics.totalMessages, icon: Send },
        { title: 'Msgs de Clientes', value: metrics.customerMessages, icon: Inbox },
        { title: 'Msgs de Atendentes', value: metrics.agentMessages, icon: TrendingUp },
        { title: 'Msgs do Bot', value: metrics.botMessages, icon: Bot },
        { title: 'Média Msgs/Conversa', value: metrics.avgMessagesPerConversation, icon: BarChart3 },
      ]
    : [];

  return (
    <div>
      <TopBar title="Relatórios" subtitle="Análises e métricas detalhadas" />
      <div className="p-6 space-y-6">
        {/* Period selector */}
        <div className="flex items-center gap-2">
          {PERIOD_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => setPeriod(opt.value)}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                period === opt.value
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-secondary text-secondary-foreground hover:bg-accent'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <Tabs defaultValue="general" className="w-full">
          <TabsList className="mb-4">
            <TabsTrigger value="general">📊 Geral</TabsTrigger>
            <TabsTrigger value="funnel">🔄 Funil de Conversão</TabsTrigger>
          </TabsList>

          {/* ===== GENERAL TAB ===== */}
          <TabsContent value="general">
            {isLoading ? (
              <div className="flex items-center justify-center py-20">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
              </div>
            ) : (
              <div className="space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {metricCards.map((m, i) => (
                    <MetricCard key={m.title} {...m} index={i} />
                  ))}
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  <motion.div
                    initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: 0.2 }}
                    className="lg:col-span-2 rounded-xl border border-border bg-card p-5"
                  >
                    <h3 className="text-sm font-semibold text-card-foreground mb-4">Atividade Diária</h3>
                    <div className="h-72">
                      {daily && daily.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={daily} barGap={4}>
                            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                            <XAxis dataKey="day" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                            <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                            <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '12px' }} />
                            <Legend iconType="circle" wrapperStyle={{ fontSize: '12px' }} />
                            <Bar dataKey="received" name="Recebidas" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                            <Bar dataKey="sent" name="Enviadas" fill="hsl(var(--info))" radius={[4, 4, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      ) : (
                        <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Nenhuma atividade no período</div>
                      )}
                    </div>
                  </motion.div>

                  <motion.div
                    initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: 0.3 }}
                    className="rounded-xl border border-border bg-card p-5"
                  >
                    <h3 className="text-sm font-semibold text-card-foreground mb-4">Distribuição por Status</h3>
                    <div className="h-72">
                      {statusDistribution && statusDistribution.some(s => s.count > 0) ? (
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie data={statusDistribution} dataKey="count" nameKey="label" cx="50%" cy="50%" outerRadius={80} label={({ label, count }) => `${label}: ${count}`} labelLine={false}>
                              {statusDistribution.map(entry => (<Cell key={entry.status} fill={STATUS_COLORS[entry.status]} />))}
                            </Pie>
                            <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '12px' }} />
                          </PieChart>
                        </ResponsiveContainer>
                      ) : (
                        <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Nenhuma conversa registrada</div>
                      )}
                    </div>
                  </motion.div>
                </div>

                <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.4 }} className="rounded-xl border border-border bg-card p-5">
                  <h3 className="text-sm font-semibold text-card-foreground mb-4">Resoluções por Dia</h3>
                  <div className="h-64">
                    {daily && daily.some(d => d.resolved > 0) ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={daily}>
                          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                          <XAxis dataKey="day" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                          <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                          <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '12px' }} />
                          <Line type="monotone" dataKey="resolved" name="Resolvidas" stroke="hsl(var(--success))" strokeWidth={2} dot={{ fill: 'hsl(var(--success))', r: 4 }} />
                        </LineChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Nenhuma resolução no período</div>
                    )}
                  </div>
                </motion.div>
              </div>
            )}
          </TabsContent>

          {/* ===== FUNNEL TAB ===== */}
          <TabsContent value="funnel">
            {funnelLoading ? (
              <div className="flex items-center justify-center py-20">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
              </div>
            ) : (
              <div className="space-y-6">
                {/* Flow summary cards */}
                {flowSummaries.length > 0 ? (
                  <>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                      <MetricCard
                        title="Fluxos Executados"
                        value={flowSummaries.reduce((sum, f) => sum + f.totalExecutions, 0)}
                        icon={Zap}
                        index={0}
                      />
                      <MetricCard
                        title="Concluídos"
                        value={flowSummaries.reduce((sum, f) => sum + f.completed, 0)}
                        icon={CheckCircle2}
                        index={1}
                        changeType="positive"
                        change={`${flowSummaries.length > 0 ? Math.round(flowSummaries.reduce((s, f) => s + f.completed, 0) / Math.max(1, flowSummaries.reduce((s, f) => s + f.totalExecutions, 0)) * 1000) / 10 : 0}% taxa geral`}
                      />
                      <MetricCard
                        title="Falharam"
                        value={flowSummaries.reduce((sum, f) => sum + f.failed, 0)}
                        icon={AlertTriangle}
                        index={2}
                        changeType="negative"
                      />
                      <MetricCard
                        title="Em Andamento"
                        value={flowSummaries.reduce((sum, f) => sum + f.running, 0)}
                        icon={Clock}
                        index={3}
                      />
                    </div>

                    {/* Per-flow performance table */}
                    <motion.div
                      initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3, delay: 0.1 }}
                      className="rounded-xl border border-border bg-card p-5"
                    >
                      <h3 className="text-sm font-semibold text-card-foreground mb-4 flex items-center gap-2">
                        <Target className="h-4 w-4" /> Performance por Fluxo
                      </h3>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-border">
                              <th className="text-left py-3 px-2 text-muted-foreground font-medium">Fluxo</th>
                              <th className="text-center py-3 px-2 text-muted-foreground font-medium">Execuções</th>
                              <th className="text-center py-3 px-2 text-muted-foreground font-medium">Concluídos</th>
                              <th className="text-center py-3 px-2 text-muted-foreground font-medium">Falhas</th>
                              <th className="text-center py-3 px-2 text-muted-foreground font-medium">Taxa de Conversão</th>
                            </tr>
                          </thead>
                          <tbody>
                            {flowSummaries.map(flow => (
                              <tr key={flow.flowId} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                                <td className="py-3 px-2 font-medium text-card-foreground">{flow.flowName}</td>
                                <td className="py-3 px-2 text-center text-card-foreground">{flow.totalExecutions}</td>
                                <td className="py-3 px-2 text-center text-success font-medium">{flow.completed}</td>
                                <td className="py-3 px-2 text-center text-destructive font-medium">{flow.failed}</td>
                                <td className="py-3 px-2 text-center">
                                  <div className="flex items-center justify-center gap-2">
                                    <div className="h-2 w-16 rounded-full bg-muted overflow-hidden">
                                      <div
                                        className="h-full rounded-full bg-primary transition-all"
                                        style={{ width: `${Math.min(100, flow.completionRate)}%` }}
                                      />
                                    </div>
                                    <span className="font-semibold text-card-foreground">{flow.completionRate}%</span>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </motion.div>

                    {/* Funnel visualization per flow */}
                    {funnels.map((funnel, fi) => (
                      <motion.div
                        key={funnel.flowId}
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.3, delay: 0.2 + fi * 0.1 }}
                        className="rounded-xl border border-border bg-card p-5"
                      >
                        <div className="flex items-center justify-between mb-5">
                          <div>
                            <h3 className="text-sm font-semibold text-card-foreground flex items-center gap-2">
                              <Filter className="h-4 w-4" /> Funil: {funnel.flowName}
                            </h3>
                            <p className="text-xs text-muted-foreground mt-1">
                              {funnel.totalStarted} iniciaram → {funnel.totalCompleted} concluíram ({funnel.overallConversion}% conversão geral)
                            </p>
                          </div>
                          <div className={`rounded-lg px-3 py-1.5 text-xs font-bold ${
                            funnel.overallConversion >= 50 ? 'bg-success/10 text-success' :
                            funnel.overallConversion >= 20 ? 'bg-warning/10 text-warning' :
                            'bg-destructive/10 text-destructive'
                          }`}>
                            {funnel.overallConversion}%
                          </div>
                        </div>

                        {/* Step-by-step funnel bars */}
                        <div className="space-y-2">
                          {funnel.steps.map((step, idx) => {
                            const maxReached = funnel.steps[0]?.reached || funnel.totalStarted;
                            const barWidth = maxReached > 0 ? Math.max(5, (step.reached / maxReached) * 100) : 0;

                            return (
                              <div key={step.nodeId} className="relative">
                                <div className="flex items-center gap-3">
                                  {/* Step number */}
                                  <div className="flex-shrink-0 w-7 h-7 rounded-full bg-muted flex items-center justify-center text-xs font-bold text-muted-foreground">
                                    {idx + 1}
                                  </div>

                                  {/* Bar + info */}
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center justify-between mb-1">
                                      <span className="text-xs font-medium text-card-foreground truncate">
                                        {NODE_TYPE_LABELS[step.nodeType] ?? step.nodeType} — {step.label}
                                      </span>
                                      <div className="flex items-center gap-3 text-xs text-muted-foreground flex-shrink-0 ml-2">
                                        <span>{step.reached} alcançaram</span>
                                        {step.dropOffRate > 0 && (
                                          <span className="text-destructive flex items-center gap-0.5">
                                            <ArrowDown className="h-3 w-3" />
                                            {step.dropOffRate}% abandono
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                    <div className="h-6 rounded-md bg-muted/50 overflow-hidden relative">
                                      <motion.div
                                        initial={{ width: 0 }}
                                        animate={{ width: `${barWidth}%` }}
                                        transition={{ duration: 0.6, delay: idx * 0.08 }}
                                        className="h-full rounded-md"
                                        style={{ backgroundColor: STEP_COLORS[idx % STEP_COLORS.length] }}
                                      />
                                      <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-card-foreground mix-blend-difference">
                                        {step.conversionRate}%
                                      </span>
                                    </div>
                                  </div>
                                </div>

                                {/* Connector line */}
                                {idx < funnel.steps.length - 1 && (
                                  <div className="ml-3.5 w-px h-2 bg-border" />
                                )}
                              </div>
                            );
                          })}
                        </div>

                        {/* Summary footer */}
                        <div className="mt-4 pt-4 border-t border-border grid grid-cols-3 gap-4 text-center">
                          <div>
                            <p className="text-lg font-bold text-card-foreground">{funnel.totalStarted}</p>
                            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Iniciaram</p>
                          </div>
                          <div>
                            <p className="text-lg font-bold text-success">{funnel.totalCompleted}</p>
                            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Concluíram</p>
                          </div>
                          <div>
                            <p className="text-lg font-bold text-destructive">{funnel.totalStarted - funnel.totalCompleted}</p>
                            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Abandonaram</p>
                          </div>
                        </div>
                      </motion.div>
                    ))}

                    {funnels.length === 0 && flowSummaries.length > 0 && (
                      <div className="rounded-xl border border-border bg-card p-10 text-center text-sm text-muted-foreground">
                        Execuções registradas, mas nenhum log detalhado por etapa foi encontrado.
                      </div>
                    )}
                  </>
                ) : (
                  <div className="rounded-xl border border-border bg-card p-16 text-center">
                    <Filter className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                    <p className="text-sm font-medium text-card-foreground">Nenhum fluxo executado no período</p>
                    <p className="text-xs text-muted-foreground mt-1">Execute fluxos de automação para ver as métricas de funil aqui.</p>
                  </div>
                )}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
