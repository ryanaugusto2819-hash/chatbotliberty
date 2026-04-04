import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { chartData } from '@/data/mockData';
import { Activity, TrendingUp } from 'lucide-react';
import { useState } from 'react';

const periods = ['7D', '30D', '90D'];

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div
      className="rounded-xl border px-4 py-3 shadow-xl"
      style={{
        background: 'hsl(var(--card))',
        borderColor: 'rgba(124,58,237,0.2)',
        fontFamily: 'Inter, sans-serif',
        backdropFilter: 'blur(12px)',
      }}
    >
      <p className="text-xs font-semibold text-muted-foreground mb-2.5 uppercase tracking-wide">
        {label}
      </p>
      {payload.map((entry: any) => (
        <div key={entry.name} className="flex items-center gap-2.5 text-sm mb-1 last:mb-0">
          <span
            className="h-2.5 w-2.5 rounded-full inline-block shrink-0"
            style={{ background: entry.color }}
          />
          <span className="text-muted-foreground font-medium">{entry.name}:</span>
          <span className="font-bold text-card-foreground ml-auto pl-3">{entry.value}</span>
        </div>
      ))}
    </div>
  );
};

export default function ActivityChart() {
  const [activePeriod, setActivePeriod] = useState('7D');

  return (
    <div className="cfo-card accent-purple p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2.5">
          <div
            className="icon-box icon-box-purple"
            style={{ width: 36, height: 36, borderRadius: 10 }}
          >
            <Activity className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-card-foreground">Atividade de Mensagens</h3>
            <p className="text-[11px] text-muted-foreground font-medium flex items-center gap-1">
              <TrendingUp className="h-3 w-3 text-emerald-500" />
              <span className="text-emerald-600 dark:text-emerald-400 font-semibold">+12%</span>
              <span>em relação à semana anterior</span>
            </p>
          </div>
        </div>

        {/* Period selector */}
        <div
          className="flex items-center gap-0.5 rounded-xl p-1"
          style={{ background: 'hsl(var(--muted))', border: '1px solid hsl(var(--border))' }}
        >
          {periods.map((p) => (
            <button
              key={p}
              onClick={() => setActivePeriod(p)}
              className="rounded-lg px-2.5 py-1 text-[11px] font-semibold transition-all duration-150"
              style={
                activePeriod === p
                  ? {
                      background: 'linear-gradient(135deg, #7c3aed, #9333ea)',
                      color: 'white',
                      boxShadow: '0 2px 8px rgba(124,58,237,0.35)',
                    }
                  : { color: 'hsl(var(--muted-foreground))' }
              }
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {/* Chart */}
      <div className="h-60">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 4, right: 4, left: -12, bottom: 0 }}>
            <defs>
              <linearGradient id="gradReceived" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#7c3aed" stopOpacity={0.25} />
                <stop offset="95%" stopColor="#7c3aed" stopOpacity={0.01} />
              </linearGradient>
              <linearGradient id="gradSent" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#a78bfa" stopOpacity={0.2} />
                <stop offset="95%" stopColor="#a78bfa" stopOpacity={0.01} />
              </linearGradient>
            </defs>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="hsl(var(--border))"
              vertical={false}
              opacity={0.5}
            />
            <XAxis
              dataKey="day"
              tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))', fontWeight: 500 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))', fontWeight: 500 }}
              axisLine={false}
              tickLine={false}
              width={32}
            />
            <Tooltip
              content={<CustomTooltip />}
              cursor={{
                stroke: 'rgba(124,58,237,0.25)',
                strokeWidth: 1,
                strokeDasharray: '4 4',
              }}
            />
            <Area
              type="monotone"
              dataKey="received"
              name="Recebidas"
              stroke="#7c3aed"
              strokeWidth={2.5}
              fill="url(#gradReceived)"
              dot={false}
              activeDot={{ r: 5, fill: '#7c3aed', stroke: 'white', strokeWidth: 2 }}
            />
            <Area
              type="monotone"
              dataKey="sent"
              name="Enviadas"
              stroke="#a78bfa"
              strokeWidth={2}
              fill="url(#gradSent)"
              dot={false}
              activeDot={{ r: 5, fill: '#a78bfa', stroke: 'white', strokeWidth: 2 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 mt-3 pt-3 border-t border-border/50">
        <div className="flex items-center gap-1.5">
          <span className="h-2 w-5 rounded-full inline-block" style={{ background: '#7c3aed' }} />
          <span className="text-xs font-medium text-muted-foreground">Recebidas</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-2 w-5 rounded-full inline-block" style={{ background: '#a78bfa' }} />
          <span className="text-xs font-medium text-muted-foreground">Enviadas</span>
        </div>
        <div
          className="ml-auto flex items-center gap-1.5 rounded-full px-2.5 py-1"
          style={{ background: 'rgba(124,58,237,0.06)', border: '1px solid rgba(124,58,237,0.12)' }}
        >
          <span
            className="h-1.5 w-1.5 rounded-full animate-pulse-dot"
            style={{ background: '#7c3aed' }}
          />
          <span className="text-[11px] font-semibold" style={{ color: '#7c3aed' }}>Ao vivo</span>
        </div>
      </div>
    </div>
  );
}
