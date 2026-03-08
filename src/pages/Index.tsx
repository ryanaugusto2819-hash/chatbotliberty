import TopBar from '@/components/layout/TopBar';
import MetricCard from '@/components/dashboard/MetricCard';
import ActivityChart from '@/components/dashboard/ActivityChart';
import RecentConversations from '@/components/dashboard/RecentConversations';
import { dashboardMetrics } from '@/data/mockData';
import { MessageSquare, Send, Inbox, Clock, CheckCircle2, Users } from 'lucide-react';

const metrics = [
  { title: 'Total de Conversas', value: dashboardMetrics.totalConversations.toLocaleString('pt-BR'), change: '+12% esta semana', changeType: 'positive' as const, icon: MessageSquare },
  { title: 'Mensagens Enviadas', value: dashboardMetrics.messagesSent.toLocaleString('pt-BR'), change: '+8% esta semana', changeType: 'positive' as const, icon: Send },
  { title: 'Mensagens Recebidas', value: dashboardMetrics.messagesReceived.toLocaleString('pt-BR'), change: '+15% esta semana', changeType: 'positive' as const, icon: Inbox },
  { title: 'Tempo Médio de Resposta', value: dashboardMetrics.avgResponseTime, change: '-18% esta semana', changeType: 'positive' as const, icon: Clock },
  { title: 'Taxa de Resolução', value: `${dashboardMetrics.resolutionRate}%`, change: '+2.1% esta semana', changeType: 'positive' as const, icon: CheckCircle2 },
  { title: 'Agentes Ativos', value: dashboardMetrics.activeAgents, change: '2 online agora', changeType: 'neutral' as const, icon: Users },
];

export default function Index() {
  return (
    <div>
      <TopBar title="Dashboard" subtitle="Visão geral do atendimento" />
      <div className="p-6 space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {metrics.map((m, i) => (
            <MetricCard key={m.title} {...m} index={i} />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
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
