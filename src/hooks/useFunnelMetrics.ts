import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { subDays } from 'date-fns';

export interface FlowSummary {
  flowId: string;
  flowName: string;
  totalExecutions: number;
  completed: number;
  failed: number;
  running: number;
  completionRate: number;
}

export interface FunnelStep {
  nodeId: string;
  label: string;
  nodeType: string;
  sortOrder: number;
  reached: number;
  completed: number;
  failed: number;
  dropOffRate: number;
  conversionRate: number;
}

export interface FlowFunnel {
  flowId: string;
  flowName: string;
  steps: FunnelStep[];
  overallConversion: number;
  totalStarted: number;
  totalCompleted: number;
}

export function useFunnelMetrics(days: number = 30) {
  const since = subDays(new Date(), days).toISOString();

  const flowSummaryQuery = useQuery({
    queryKey: ['funnel-flow-summary', days],
    queryFn: async (): Promise<FlowSummary[]> => {
      const { data: executions, error } = await supabase
        .from('flow_executions')
        .select('flow_id, status')
        .gte('created_at', since);

      if (error) throw error;

      const { data: flows } = await supabase
        .from('automation_flows')
        .select('id, name');

      const flowMap = new Map<string, string>();
      (flows ?? []).forEach(f => flowMap.set(f.id, f.name));

      const grouped = new Map<string, { total: number; completed: number; failed: number; running: number }>();

      (executions ?? []).forEach(e => {
        const existing = grouped.get(e.flow_id) ?? { total: 0, completed: 0, failed: 0, running: 0 };
        existing.total++;
        if (e.status === 'completed') existing.completed++;
        else if (e.status === 'failed') existing.failed++;
        else existing.running++;
        grouped.set(e.flow_id, existing);
      });

      return Array.from(grouped.entries()).map(([flowId, stats]) => ({
        flowId,
        flowName: flowMap.get(flowId) ?? 'Fluxo desconhecido',
        totalExecutions: stats.total,
        completed: stats.completed,
        failed: stats.failed,
        running: stats.running,
        completionRate: stats.total > 0 ? Math.round((stats.completed / stats.total) * 1000) / 10 : 0,
      })).sort((a, b) => b.totalExecutions - a.totalExecutions);
    },
  });

  const funnelQuery = useQuery({
    queryKey: ['funnel-steps', days],
    queryFn: async (): Promise<FlowFunnel[]> => {
      // Get all executions in period
      const { data: executions } = await supabase
        .from('flow_executions')
        .select('id, flow_id, status')
        .gte('created_at', since);

      if (!executions || executions.length === 0) return [];

      const executionIds = executions.map(e => e.id);
      const flowIds = [...new Set(executions.map(e => e.flow_id))];

      // Get flows
      const { data: flows } = await supabase
        .from('automation_flows')
        .select('id, name')
        .in('id', flowIds);

      const flowMap = new Map<string, string>();
      (flows ?? []).forEach(f => flowMap.set(f.id, f.name));

      // Get nodes for these flows
      const { data: nodes } = await supabase
        .from('automation_nodes')
        .select('id, flow_id, label, node_type, sort_order')
        .in('flow_id', flowIds)
        .order('sort_order', { ascending: true });

      // Get step logs - batch in chunks to avoid query limit
      const allLogs: Array<{ execution_id: string; node_id: string; status: string; sort_order: number; node_label: string; node_type: string }> = [];
      const chunkSize = 50;
      for (let i = 0; i < executionIds.length; i += chunkSize) {
        const chunk = executionIds.slice(i, i + chunkSize);
        const { data: logs } = await supabase
          .from('flow_step_logs')
          .select('execution_id, node_id, status, sort_order, node_label, node_type')
          .in('execution_id', chunk);
        if (logs) allLogs.push(...logs);
      }

      // Group executions by flow
      const execByFlow = new Map<string, string[]>();
      executions.forEach(e => {
        const list = execByFlow.get(e.flow_id) ?? [];
        list.push(e.id);
        execByFlow.set(e.flow_id, list);
      });

      const completedByFlow = new Map<string, number>();
      executions.forEach(e => {
        if (e.status === 'completed') {
          completedByFlow.set(e.flow_id, (completedByFlow.get(e.flow_id) ?? 0) + 1);
        }
      });

      // Build funnels per flow
      const funnels: FlowFunnel[] = [];

      for (const [flowId, execIds] of execByFlow.entries()) {
        const flowNodes = (nodes ?? []).filter(n => n.flow_id === flowId).sort((a, b) => a.sort_order - b.sort_order);
        if (flowNodes.length === 0) continue;

        const totalStarted = execIds.length;
        const logsForFlow = allLogs.filter(l => execIds.includes(l.execution_id));

        const steps: FunnelStep[] = flowNodes.map((node, idx) => {
          const nodeLogs = logsForFlow.filter(l => l.node_id === node.id);
          const reached = nodeLogs.length;
          const completed = nodeLogs.filter(l => l.status === 'completed').length;
          const failed = nodeLogs.filter(l => l.status === 'failed').length;

          const previousReached = idx === 0 ? totalStarted : (() => {
            const prevNode = flowNodes[idx - 1];
            return logsForFlow.filter(l => l.node_id === prevNode.id).length;
          })();

          const dropOffRate = previousReached > 0 ? Math.round(((previousReached - reached) / previousReached) * 1000) / 10 : 0;
          const conversionRate = totalStarted > 0 ? Math.round((reached / totalStarted) * 1000) / 10 : 0;

          return {
            nodeId: node.id,
            label: node.label || `Etapa ${idx + 1}`,
            nodeType: node.node_type,
            sortOrder: node.sort_order,
            reached,
            completed,
            failed,
            dropOffRate: Math.max(0, dropOffRate),
            conversionRate,
          };
        });

        funnels.push({
          flowId,
          flowName: flowMap.get(flowId) ?? 'Fluxo desconhecido',
          steps,
          totalStarted,
          totalCompleted: completedByFlow.get(flowId) ?? 0,
          overallConversion: totalStarted > 0
            ? Math.round(((completedByFlow.get(flowId) ?? 0) / totalStarted) * 1000) / 10
            : 0,
        });
      }

      return funnels.sort((a, b) => b.totalStarted - a.totalStarted);
    },
  });

  return {
    flowSummaries: flowSummaryQuery.data ?? [],
    funnels: funnelQuery.data ?? [],
    isLoading: flowSummaryQuery.isLoading || funnelQuery.isLoading,
  };
}
