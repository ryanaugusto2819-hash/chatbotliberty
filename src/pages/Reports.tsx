import TopBar from '@/components/layout/TopBar';
import MetricCard from '@/components/dashboard/MetricCard';
import { useReportMetrics } from '@/hooks/useReportMetrics';
import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  MessageSquare, CheckCircle2, Clock, Send, Inbox, Bot,
  TrendingUp, BarChart3,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, PieChart, Pie, Cell, LineChart, Line,
} from 'recharts';

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

export default function Reports() {
  const [period, setPeriod] = useState(14);
  const { metrics, daily, statusDistribution, isLoading } = useReportMetrics(period);

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

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          </div>
        ) : (
          <>
            {/* Metric cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {metricCards.map((m, i) => (
                <MetricCard key={m.title} {...m} index={i} />
              ))}
            </div>

            {/* Charts row */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Daily activity */}
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
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
                    <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                      Nenhuma atividade no período
                    </div>
                  )}
                </div>
              </motion.div>

              {/* Status distribution pie */}
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0.3 }}
                className="rounded-xl border border-border bg-card p-5"
              >
                <h3 className="text-sm font-semibold text-card-foreground mb-4">Distribuição por Status</h3>
                <div className="h-72">
                  {statusDistribution && statusDistribution.some(s => s.count > 0) ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={statusDistribution}
                          dataKey="count"
                          nameKey="label"
                          cx="50%"
                          cy="50%"
                          outerRadius={80}
                          label={({ label, count }) => `${label}: ${count}`}
                          labelLine={false}
                        >
                          {statusDistribution.map(entry => (
                            <Cell key={entry.status} fill={STATUS_COLORS[entry.status]} />
                          ))}
                        </Pie>
                        <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '12px' }} />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                      Nenhuma conversa registrada
                    </div>
                  )}
                </div>
              </motion.div>
            </div>

            {/* Resolution trend */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.4 }}
              className="rounded-xl border border-border bg-card p-5"
            >
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
                  <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                    Nenhuma resolução no período
                  </div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </div>
    </div>
  );
}
