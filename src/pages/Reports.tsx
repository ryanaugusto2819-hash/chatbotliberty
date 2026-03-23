import TopBar from '@/components/layout/TopBar';
import MetricCard from '@/components/dashboard/MetricCard';
import { useReportMetrics } from '@/hooks/useReportMetrics';
import { useFunnelMetrics } from '@/hooks/useFunnelMetrics';
import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  MessageSquare, CheckCircle2, Clock, Send, Inbox, Bot,
  TrendingUp, BarChart3, Filter, ArrowDown, Zap, Target,
  AlertTriangle, Users, Reply, UserCheck, ShieldCheck,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, PieChart, Pie, Cell, LineChart, Line,
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

const STAGE_COLORS = [
  'hsl(var(--primary))',
  'hsl(var(--info))',
  'hsl(210 70% 55%)',
  'hsl(var(--warning))',
  'hsl(30 80% 55%)',
  'hsl(var(--success))',
];

const STAGE_ICONS = [Users, Send, Reply, MessageSquare, UserCheck, ShieldCheck];

export default function Reports() {
  const [period, setPeriod] = useState(14);
  const { metrics, daily, statusDistribution, isLoading } = useReportMetrics(period);
  const { stages, responseMetrics, followUp, isLoading: funnelLoading } = useFunnelMetrics(period);

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

        <Tabs defaultValue="funnel" className="w-full">
          <TabsList className="mb-4">
            <TabsTrigger value="funnel">🔄 Funil do Lead</TabsTrigger>
            <TabsTrigger value="general">📊 Geral</TabsTrigger>
          </TabsList>

          {/* ===== FUNNEL TAB ===== */}
          <TabsContent value="funnel">
            {funnelLoading ? (
              <div className="flex items-center justify-center py-20">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
              </div>
            ) : (
              <div className="space-y-6">
                {stages.length > 0 && stages[0].count > 0 ? (
                  <>
                    {/* Summary cards */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                      <MetricCard title="Leads Recebidos" value={stages[0]?.count ?? 0} icon={Users} index={0} />
                      <MetricCard
                        title="Taxa de Resposta"
                        value={`${responseMetrics?.replyRate ?? 0}%`}
                        icon={Reply}
                        index={1}
                        changeType={responseMetrics && responseMetrics.replyRate >= 50 ? 'positive' : 'negative'}
                        change={`${responseMetrics?.conversationsWithCustomerReply ?? 0} de ${stages[0]?.count ?? 0} responderam`}
                      />
                      <MetricCard
                        title="Taxa de Conversão"
                        value={`${stages[stages.length - 1]?.rate ?? 0}%`}
                        icon={Target}
                        index={2}
                        changeType={stages[stages.length - 1]?.rate >= 10 ? 'positive' : 'negative'}
                        change={`${stages[stages.length - 1]?.count ?? 0} vendas/resoluções`}
                      />
                      <MetricCard
                        title="Follow-ups Respondidos"
                        value={followUp ? `${followUp.responseRate}%` : '—'}
                        icon={Zap}
                        index={3}
                        change={followUp ? `${followUp.responded} de ${followUp.sent} enviados` : undefined}
                      />
                    </div>

                    {/* Main funnel visualization */}
                    <motion.div
                      initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3, delay: 0.15 }}
                      className="rounded-xl border border-border bg-card p-6"
                    >
                      <h3 className="text-sm font-semibold text-card-foreground mb-6 flex items-center gap-2">
                        <Filter className="h-4 w-4" /> Jornada do Lead no Funil
                      </h3>

                      <div className="space-y-1">
                        {stages.map((stage, idx) => {
                          const Icon = STAGE_ICONS[idx] ?? Users;
                          const barWidth = Math.max(8, stage.rate);

                          return (
                            <div key={stage.key}>
                              <div className="flex items-center gap-4">
                                {/* Icon */}
                                <div
                                  className="flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center"
                                  style={{ backgroundColor: `${STAGE_COLORS[idx]}20` }}
                                >
                                  <Icon className="h-4 w-4" style={{ color: STAGE_COLORS[idx] }} />
                                </div>

                                {/* Content */}
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center justify-between mb-1.5">
                                    <span className="text-xs font-semibold text-card-foreground">{stage.label}</span>
                                    <div className="flex items-center gap-3 text-xs flex-shrink-0 ml-3">
                                      <span className="font-bold text-card-foreground">{stage.count}</span>
                                      <span className="text-muted-foreground">({stage.rate}%)</span>
                                      {stage.dropOff > 0 && (
                                        <span className="text-destructive flex items-center gap-0.5 font-medium">
                                          <ArrowDown className="h-3 w-3" />
                                          {stage.dropOff}%
                                        </span>
                                      )}
                                    </div>
                                  </div>

                                  {/* Funnel bar */}
                                  <div className="h-8 rounded-lg bg-muted/40 overflow-hidden relative flex items-center justify-center mx-auto"
                                    style={{ width: '100%' }}
                                  >
                                    <motion.div
                                      initial={{ width: 0 }}
                                      animate={{ width: `${barWidth}%` }}
                                      transition={{ duration: 0.7, delay: idx * 0.1, ease: 'easeOut' }}
                                      className="absolute left-0 top-0 h-full rounded-lg"
                                      style={{ backgroundColor: STAGE_COLORS[idx], opacity: 0.85 }}
                                    />
                                    <span className="relative z-10 text-[11px] font-bold text-card-foreground">
                                      {stage.rate}%
                                    </span>
                                  </div>
                                </div>
                              </div>

                              {/* Connector */}
                              {idx < stages.length - 1 && (
                                <div className="flex items-center ml-[18px] h-4">
                                  <div className="w-px h-full bg-border" />
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </motion.div>

                    {/* Bottom row: response details + follow-up */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      {/* Response breakdown */}
                      {responseMetrics && (
                        <motion.div
                          initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.3, delay: 0.3 }}
                          className="rounded-xl border border-border bg-card p-5"
                        >
                          <h3 className="text-sm font-semibold text-card-foreground mb-4">Engajamento dos Leads</h3>
                          <div className="space-y-4">
                            <div className="flex justify-between items-center">
                              <span className="text-xs text-muted-foreground">Responderam</span>
                              <div className="flex items-center gap-2">
                                <div className="h-2 w-24 rounded-full bg-muted overflow-hidden">
                                  <div className="h-full rounded-full bg-success" style={{ width: `${responseMetrics.replyRate}%` }} />
                                </div>
                                <span className="text-xs font-bold text-card-foreground">{responseMetrics.conversationsWithCustomerReply}</span>
                              </div>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-xs text-muted-foreground">Sem resposta</span>
                              <div className="flex items-center gap-2">
                                <div className="h-2 w-24 rounded-full bg-muted overflow-hidden">
                                  <div className="h-full rounded-full bg-destructive" style={{ width: `${100 - responseMetrics.replyRate}%` }} />
                                </div>
                                <span className="text-xs font-bold text-card-foreground">{responseMetrics.conversationsWithoutReply}</span>
                              </div>
                            </div>
                            <div className="border-t border-border pt-3 grid grid-cols-3 gap-3 text-center">
                              <div>
                                <p className="text-lg font-bold text-card-foreground">{responseMetrics.avgCustomerMessages}</p>
                                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Média msgs cliente</p>
                              </div>
                              <div>
                                <p className="text-lg font-bold text-card-foreground">{responseMetrics.avgAgentMessages}</p>
                                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Média msgs atendente</p>
                              </div>
                              <div>
                                <p className="text-lg font-bold text-card-foreground">{responseMetrics.avgBotMessages}</p>
                                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Média msgs bot</p>
                              </div>
                            </div>
                          </div>
                        </motion.div>
                      )}

                      {/* Follow-up engagement */}
                      {followUp && (
                        <motion.div
                          initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.3, delay: 0.35 }}
                          className="rounded-xl border border-border bg-card p-5"
                        >
                          <h3 className="text-sm font-semibold text-card-foreground mb-4">Follow-ups</h3>
                          <div className="space-y-4">
                            <div className="flex justify-between items-center">
                              <span className="text-xs text-muted-foreground">Enviados</span>
                              <span className="text-sm font-bold text-card-foreground">{followUp.sent}</span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-xs text-muted-foreground">Respondidos</span>
                              <span className="text-sm font-bold text-success">{followUp.responded}</span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-xs text-muted-foreground">Aguardando</span>
                              <span className="text-sm font-bold text-warning">{followUp.pending}</span>
                            </div>
                            <div className="border-t border-border pt-3">
                              <div className="flex items-center justify-between">
                                <span className="text-xs text-muted-foreground">Taxa de resposta</span>
                                <div className="flex items-center gap-2">
                                  <div className="h-3 w-20 rounded-full bg-muted overflow-hidden">
                                    <div className="h-full rounded-full bg-primary" style={{ width: `${followUp.responseRate}%` }} />
                                  </div>
                                  <span className="text-sm font-bold text-card-foreground">{followUp.responseRate}%</span>
                                </div>
                              </div>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </div>

                    {/* Funnel chart */}
                    <motion.div
                      initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3, delay: 0.4 }}
                      className="rounded-xl border border-border bg-card p-5"
                    >
                      <h3 className="text-sm font-semibold text-card-foreground mb-4">Conversão por Etapa</h3>
                      <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={stages} layout="vertical" barSize={20}>
                            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
                            <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} unit="%" />
                            <YAxis type="category" dataKey="label" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} width={150} />
                            <Tooltip
                              contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '12px' }}
                              formatter={(value: number) => [`${value}%`, 'Taxa']}
                            />
                            <Bar dataKey="rate" radius={[0, 6, 6, 0]}>
                              {stages.map((_, idx) => (
                                <Cell key={idx} fill={STAGE_COLORS[idx]} />
                              ))}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </motion.div>
                  </>
                ) : (
                  <div className="rounded-xl border border-border bg-card p-16 text-center">
                    <Filter className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                    <p className="text-sm font-medium text-card-foreground">Nenhum lead no período</p>
                    <p className="text-xs text-muted-foreground mt-1">Receba conversas para acompanhar a jornada dos leads no funil.</p>
                  </div>
                )}
              </div>
            )}
          </TabsContent>

          {/* ===== GENERAL TAB ===== */}
          <TabsContent value="general">
            {isLoading ? (
              <div className="flex items-center justify-center py-20">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
              </div>
            ) : (
              <div className="space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {metricCards.map((m, i) => (<MetricCard key={m.title} {...m} index={i} />))}
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.2 }} className="lg:col-span-2 rounded-xl border border-border bg-card p-5">
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
                  <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.3 }} className="rounded-xl border border-border bg-card p-5">
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
        </Tabs>
      </div>
    </div>
  );
}
