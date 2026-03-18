import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { BarChart3, Coins, Zap, TrendingUp, Calendar } from 'lucide-react';
import { motion } from 'framer-motion';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface UsageSummary {
  totalTokens: number;
  totalCalls: number;
  autoReplyTokens: number;
  autoReplyCalls: number;
  flowSelectorTokens: number;
  flowSelectorCalls: number;
  todayTokens: number;
  todayCalls: number;
  last7DaysTokens: number;
  last30DaysTokens: number;
}

interface DailyUsage {
  day: string;
  tokens: number;
  calls: number;
}

export default function AiUsageControl() {
  const [summary, setSummary] = useState<UsageSummary | null>(null);
  const [dailyUsage, setDailyUsage] = useState<DailyUsage[]>([]);
  const [period, setPeriod] = useState<7 | 30>(7);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchUsage();
  }, [period]);

  const fetchUsage = async () => {
    setLoading(true);
    const now = new Date();
    const todayStart = startOfDay(now).toISOString();
    const todayEnd = endOfDay(now).toISOString();
    const last7 = subDays(now, 7).toISOString();
    const last30 = subDays(now, 30).toISOString();
    const periodStart = subDays(now, period).toISOString();

    const [allTime, today7, today30, autoReply, flowSelector, todayData] = await Promise.all([
      supabase.from('ai_usage_logs').select('total_tokens', { count: 'exact' }),
      supabase.from('ai_usage_logs').select('total_tokens').gte('created_at', last7),
      supabase.from('ai_usage_logs').select('total_tokens').gte('created_at', last30),
      supabase.from('ai_usage_logs').select('total_tokens', { count: 'exact' }).eq('function_name', 'ai-auto-reply'),
      supabase.from('ai_usage_logs').select('total_tokens', { count: 'exact' }).eq('function_name', 'ai-flow-selector'),
      supabase.from('ai_usage_logs').select('total_tokens').gte('created_at', todayStart).lte('created_at', todayEnd),
    ]);

    const sumTokens = (data: { total_tokens: number }[] | null) =>
      (data || []).reduce((acc, r) => acc + (r.total_tokens || 0), 0);

    setSummary({
      totalTokens: sumTokens(allTime.data),
      totalCalls: allTime.count ?? 0,
      autoReplyTokens: sumTokens(autoReply.data),
      autoReplyCalls: autoReply.count ?? 0,
      flowSelectorTokens: sumTokens(flowSelector.data),
      flowSelectorCalls: flowSelector.count ?? 0,
      todayTokens: sumTokens(todayData.data),
      todayCalls: todayData.data?.length ?? 0,
      last7DaysTokens: sumTokens(today7.data),
      last30DaysTokens: sumTokens(today30.data),
    });

    // Daily breakdown
    const daily: DailyUsage[] = [];
    for (let i = period - 1; i >= 0; i--) {
      const date = subDays(now, i);
      const dayStart = startOfDay(date).toISOString();
      const dayEnd = endOfDay(date).toISOString();

      const { data } = await supabase
        .from('ai_usage_logs')
        .select('total_tokens')
        .gte('created_at', dayStart)
        .lte('created_at', dayEnd);

      daily.push({
        day: format(date, 'dd/MM', { locale: ptBR }),
        tokens: sumTokens(data),
        calls: data?.length ?? 0,
      });
    }
    setDailyUsage(daily);
    setLoading(false);
  };

  const formatTokens = (n: number) => {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
    return n.toString();
  };

  const maxTokens = Math.max(...dailyUsage.map((d) => d.tokens), 1);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.15 }}
      className="rounded-xl border border-border bg-card p-6 shadow-elevated"
    >
      <div className="flex items-center gap-3 mb-6">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent">
          <Coins className="h-5 w-5 text-accent-foreground" />
        </div>
        <div>
          <p className="text-sm font-semibold text-card-foreground">Controle de Uso da IA</p>
          <p className="text-xs text-muted-foreground">
            Monitore o consumo de tokens e custos das chamadas de IA
          </p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-10">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      ) : summary ? (
        <div className="space-y-5">
          {/* Metric cards */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg border border-border bg-background p-3">
              <div className="flex items-center gap-2 mb-1">
                <Zap className="h-3.5 w-3.5 text-primary" />
                <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Hoje</span>
              </div>
              <p className="text-lg font-bold text-foreground">{formatTokens(summary.todayTokens)}</p>
              <p className="text-[10px] text-muted-foreground">{summary.todayCalls} chamadas</p>
            </div>

            <div className="rounded-lg border border-border bg-background p-3">
              <div className="flex items-center gap-2 mb-1">
                <TrendingUp className="h-3.5 w-3.5 text-primary" />
                <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Últimos 7 dias</span>
              </div>
              <p className="text-lg font-bold text-foreground">{formatTokens(summary.last7DaysTokens)}</p>
              <p className="text-[10px] text-muted-foreground">tokens consumidos</p>
            </div>

            <div className="rounded-lg border border-border bg-background p-3">
              <div className="flex items-center gap-2 mb-1">
                <Calendar className="h-3.5 w-3.5 text-primary" />
                <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Últimos 30 dias</span>
              </div>
              <p className="text-lg font-bold text-foreground">{formatTokens(summary.last30DaysTokens)}</p>
              <p className="text-[10px] text-muted-foreground">tokens consumidos</p>
            </div>

            <div className="rounded-lg border border-border bg-background p-3">
              <div className="flex items-center gap-2 mb-1">
                <BarChart3 className="h-3.5 w-3.5 text-primary" />
                <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Total geral</span>
              </div>
              <p className="text-lg font-bold text-foreground">{formatTokens(summary.totalTokens)}</p>
              <p className="text-[10px] text-muted-foreground">{summary.totalCalls} chamadas</p>
            </div>
          </div>

          {/* Breakdown by function */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Consumo por Função</label>
            <div className="space-y-2">
              <div className="flex items-center justify-between rounded-lg border border-border bg-background p-3">
                <div>
                  <p className="text-xs font-medium text-foreground">Resposta Automática</p>
                  <p className="text-[10px] text-muted-foreground">{summary.autoReplyCalls} chamadas</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-foreground">{formatTokens(summary.autoReplyTokens)}</p>
                  <p className="text-[10px] text-muted-foreground">tokens</p>
                </div>
              </div>

              <div className="flex items-center justify-between rounded-lg border border-border bg-background p-3">
                <div>
                  <p className="text-xs font-medium text-foreground">Selecionador de Fluxo</p>
                  <p className="text-[10px] text-muted-foreground">{summary.flowSelectorCalls} chamadas</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-foreground">{formatTokens(summary.flowSelectorTokens)}</p>
                  <p className="text-[10px] text-muted-foreground">tokens</p>
                </div>
              </div>
            </div>
          </div>

          {/* Daily chart */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-foreground">Uso Diário</label>
              <div className="flex rounded-md border border-border overflow-hidden">
                <button
                  onClick={() => setPeriod(7)}
                  className={`px-2.5 py-1 text-[10px] font-medium transition-colors ${
                    period === 7 ? 'bg-primary text-primary-foreground' : 'bg-background text-muted-foreground hover:text-foreground'
                  }`}
                >
                  7 dias
                </button>
                <button
                  onClick={() => setPeriod(30)}
                  className={`px-2.5 py-1 text-[10px] font-medium transition-colors ${
                    period === 30 ? 'bg-primary text-primary-foreground' : 'bg-background text-muted-foreground hover:text-foreground'
                  }`}
                >
                  30 dias
                </button>
              </div>
            </div>

            <div className="rounded-lg border border-border bg-background p-3">
              <div className="flex items-end gap-[2px] h-24">
                {dailyUsage.map((d, i) => (
                  <div key={i} className="flex-1 flex flex-col items-center gap-1 group relative">
                    <div className="absolute -top-7 left-1/2 -translate-x-1/2 hidden group-hover:block z-10">
                      <div className="rounded bg-popover border border-border px-2 py-1 text-[9px] text-popover-foreground shadow-sm whitespace-nowrap">
                        {d.day}: {formatTokens(d.tokens)} tokens · {d.calls} chamadas
                      </div>
                    </div>
                    <div
                      className="w-full rounded-t bg-primary/80 hover:bg-primary transition-colors min-h-[2px]"
                      style={{ height: `${Math.max((d.tokens / maxTokens) * 100, 2)}%` }}
                    />
                  </div>
                ))}
              </div>
              <div className="flex justify-between mt-1">
                <span className="text-[8px] text-muted-foreground">{dailyUsage[0]?.day}</span>
                <span className="text-[8px] text-muted-foreground">{dailyUsage[dailyUsage.length - 1]?.day}</span>
              </div>
            </div>
          </div>

          {/* Info box */}
          <div className="rounded-lg border border-border/50 bg-muted/30 p-3">
            <p className="text-xs text-muted-foreground">
              <strong className="text-foreground">Sobre custos:</strong> O consumo de IA é cobrado por uso no Lovable Cloud.
              Acompanhe o uso em <strong>Settings → Workspace → Usage</strong> para ver o consumo real em créditos.
            </p>
          </div>
        </div>
      ) : null}
    </motion.div>
  );
}
