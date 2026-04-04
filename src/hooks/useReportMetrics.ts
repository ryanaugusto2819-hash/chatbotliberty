import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { startOfWeek, subDays, format, startOfDay, endOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export interface ReportMetrics {
  totalConversations: number;
  newConversations: number;
  resolvedConversations: number;
  pendingConversations: number;
  totalMessages: number;
  customerMessages: number;
  agentMessages: number;
  botMessages: number;
  avgMessagesPerConversation: number;
  resolutionRate: number;
}

export interface DailyActivity {
  day: string;
  received: number;
  sent: number;
  resolved: number;
}

export interface StatusDistribution {
  status: string;
  count: number;
  label: string;
}

export function useReportMetrics(days: number = 30) {
  const since = subDays(new Date(), days).toISOString();

  const metricsQuery = useQuery({
    queryKey: ['report-metrics', days],
    queryFn: async (): Promise<ReportMetrics> => {
      const [convRes, msgRes, resolvedRes, pendingRes] = await Promise.all([
        supabase.from('conversations').select('id', { count: 'exact', head: true }).gte('created_at', since),
        supabase.from('messages').select('id, sender_type', { count: 'exact' }).gte('created_at', since),
        supabase.from('conversations').select('id', { count: 'exact', head: true }).eq('status', 'resolved').gte('created_at', since),
        supabase.from('conversations').select('id', { count: 'exact', head: true }).eq('status', 'pending').gte('created_at', since),
      ]);

      const totalConversations = convRes.count ?? 0;
      const totalMessages = msgRes.count ?? 0;
      const resolvedConversations = resolvedRes.count ?? 0;
      const pendingConversations = pendingRes.count ?? 0;
      const newConversations = totalConversations - resolvedConversations - pendingConversations;

      const messages = msgRes.data ?? [];
      const customerMessages = messages.filter(m => m.sender_type === 'customer').length;
      const agentMessages = messages.filter(m => m.sender_type === 'agent').length;
      const botMessages = messages.filter(m => m.sender_type === 'bot').length;

      return {
        totalConversations,
        newConversations: Math.max(0, newConversations),
        resolvedConversations,
        pendingConversations,
        totalMessages,
        customerMessages,
        agentMessages,
        botMessages,
        avgMessagesPerConversation: totalConversations > 0 ? Math.round(totalMessages / totalConversations * 10) / 10 : 0,
        resolutionRate: totalConversations > 0 ? Math.round(resolvedConversations / totalConversations * 1000) / 10 : 0,
      };
    },
  });

  const dailyQuery = useQuery({
    queryKey: ['report-daily', days],
    queryFn: async (): Promise<DailyActivity[]> => {
      const numDays = Math.min(days, 14);
      const dayIndices = Array.from({ length: numDays }, (_, idx) => numDays - 1 - idx);

      const result: DailyActivity[] = await Promise.all(
        dayIndices.map(async (i) => {
          const date = subDays(new Date(), i);
          const dayStart = startOfDay(date).toISOString();
          const dayEnd = endOfDay(date).toISOString();

          const [customerMsgs, agentMsgs, resolvedConvs] = await Promise.all([
            supabase.from('messages').select('id', { count: 'exact', head: true })
              .eq('sender_type', 'customer').gte('created_at', dayStart).lte('created_at', dayEnd),
            supabase.from('messages').select('id', { count: 'exact', head: true })
              .in('sender_type', ['agent', 'bot']).gte('created_at', dayStart).lte('created_at', dayEnd),
            supabase.from('conversations').select('id', { count: 'exact', head: true })
              .eq('status', 'resolved').gte('resolved_at', dayStart).lte('resolved_at', dayEnd),
          ]);

          return {
            day: format(date, 'dd/MM', { locale: ptBR }),
            received: customerMsgs.count ?? 0,
            sent: agentMsgs.count ?? 0,
            resolved: resolvedConvs.count ?? 0,
          };
        })
      );

      return result;
    },
  });

  const statusQuery = useQuery({
    queryKey: ['report-status-distribution'],
    queryFn: async (): Promise<StatusDistribution[]> => {
      const statuses = ['new', 'pending', 'active', 'resolved'];
      const labels: Record<string, string> = {
        new: 'Novas',
        pending: 'Pendentes',
        active: 'Em Atendimento',
        resolved: 'Resolvidas',
      };

      const results = await Promise.all(
        statuses.map(s =>
          supabase.from('conversations').select('id', { count: 'exact', head: true }).eq('status', s)
        )
      );

      return statuses.map((s, i) => ({
        status: s,
        count: results[i].count ?? 0,
        label: labels[s],
      }));
    },
  });

  return {
    metrics: metricsQuery.data,
    daily: dailyQuery.data,
    statusDistribution: statusQuery.data,
    isLoading: metricsQuery.isLoading || dailyQuery.isLoading || statusQuery.isLoading,
  };
}
