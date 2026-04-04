import TopBar from '@/components/layout/TopBar';
import MetricCard from '@/components/dashboard/MetricCard';
import ActivityChart from '@/components/dashboard/ActivityChart';
import RecentConversations from '@/components/dashboard/RecentConversations';
import { dashboardMetrics } from '@/data/mockData';
import { useDashboardMetrics } from '@/hooks/useDashboardMetrics';
import { MessageSquare, Send, Inbox, Clock, CheckCircle2, Users, Zap } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { motion } from 'framer-motion';

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Bom dia';
  if (h < 18) return 'Boa tarde';
  return 'Boa noite';
}

export default function Index() {
  const { user } = useAuth();
  const firstName =
    user?.user_metadata?.full_name?.split(' ')[0] ||
    user?.email?.split('@')[0] ||
    'Usuário';

  const { data: realMetrics, isLoading: metricsLoading } = useDashboardMetrics();

  const metrics = [
    {
      title: 'Total de Conversas',
      value: metricsLoading ? '...' : (realMetrics?.totalConversations ?? dashboardMetrics.totalConversations).toLocaleString('pt-BR'),
      change: '+12% esta semana',
      changeType: 'positive' as const,
      icon: MessageSquare,
      accentColor: 'purple' as const,
    },
    {
      title: 'Mensagens Enviadas',
      value: metricsLoading ? '...' : (realMetrics?.messagesSent ?? dashboardMetrics.messagesSent).toLocaleString('pt-BR'),
      change: '+8% esta semana',
      changeType: 'positive' as const,
      icon: Send,
      accentColor: 'green' as const,
    },
    {
      title: 'Mensagens Recebidas',
      value: metricsLoading ? '...' : (realMetrics?.messagesReceived ?? dashboardMetrics.messagesReceived).toLocaleString('pt-BR'),
      change: '+15% esta semana',
      changeType: 'positive' as const,
      icon: Inbox,
      accentColor: 'blue' as const,
    },
    {
      title: 'Tempo Médio de Resposta',
      value: dashboardMetrics.avgResponseTime,
      change: '-18% esta semana',
      changeType: 'positive' as const,
      icon: Clock,
      accentColor: 'amber' as const,
    },
    {
      title: 'Taxa de Resolução',
      value: metricsLoading ? '...' : `${realMetrics?.resolutionRate ?? dashboardMetrics.resolutionRate}%`,
      change: '+2.1% esta semana',
      changeType: 'positive' as const,
      icon: CheckCircle2,
      accentColor: 'teal' as const,
    },
    {
      title: 'Atendentes Ativos',
      value: metricsLoading ? '...' : (realMetrics?.activeAgents ?? dashboardMetrics.activeAgents),
      change: '2 online agora',
      changeType: 'neutral' as const,
      icon: Users,
      accentColor: 'red' as const,
    },
  ];

  return (
    <div>
      <TopBar title="Dashboard" subtitle="Visão geral do atendimento" />

      {/* Welcome banner */}
      <motion.div
        className="px-6 pt-5 pb-1"
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <div
          className="flex items-center justify-between rounded-2xl px-5 py-4 relative overflow-hidden"
          style={{
            background: 'linear-gradient(135deg, rgba(124,58,237,0.08) 0%, rgba(124,58,237,0.03) 100%)',
            border: '1px solid rgba(124,58,237,0.12)',
          }}
        >
          {/* Decorative glow */}
          <div
            className="absolute -top-6 -left-6 h-24 w-24 rounded-full blur-2xl pointer-events-none"
            style={{ background: 'rgba(124,58,237,0.15)' }}
          />

          <div className="relative z-10">
            <p className="text-base font-bold text-foreground">
              {getGreeting()}, {firstName}! 👋
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Aqui está o resumo do seu atendimento hoje.
            </p>
          </div>

          <div className="relative z-10 flex items-center gap-2">
            <div
              className="flex items-center gap-1.5 rounded-full px-3 py-1.5"
              style={{
                background: 'rgba(124,58,237,0.1)',
                border: '1px solid rgba(124,58,237,0.18)',
              }}
            >
              <Zap className="h-3 w-3" style={{ color: '#A78BFA' }} />
              <span className="text-[11px] font-semibold" style={{ color: '#7C3AED' }}>
                IA Processando
              </span>
              <span
                className="h-1.5 w-1.5 rounded-full animate-pulse-dot"
                style={{ background: '#7C3AED' }}
              />
            </div>
          </div>
        </div>
      </motion.div>

      <div className="p-6 space-y-6">
        {/* Metrics grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {metrics.map((m, i) => (
            <MetricCard key={m.title} {...m} index={i} />
          ))}
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
          <div className="lg:col-span-3">
            <ActivityChart />
          </div>
          <div className="lg:col-span-2">
            <RecentConversations />
          </div>
        </div>
      </div>
    </div>
  );
}
