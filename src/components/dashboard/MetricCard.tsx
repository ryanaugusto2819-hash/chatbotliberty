import { LucideIcon, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { motion } from 'framer-motion';

interface MetricCardProps {
  title: string;
  value: string | number;
  change?: string;
  changeType?: 'positive' | 'negative' | 'neutral';
  icon: LucideIcon;
  index?: number;
  accentColor?: 'purple' | 'green' | 'blue' | 'amber' | 'red' | 'teal';
}

const accentMap = {
  purple: { accent: 'accent-purple', iconBox: 'icon-box-purple', bar: '#7c3aed', progress: 78 },
  green:  { accent: 'accent-green',  iconBox: 'icon-box-green',  bar: '#059669', progress: 65 },
  blue:   { accent: 'accent-blue',   iconBox: 'icon-box-blue',   bar: '#2563eb', progress: 82 },
  amber:  { accent: 'accent-amber',  iconBox: 'icon-box-amber',  bar: '#d97706', progress: 54 },
  red:    { accent: 'accent-red',    iconBox: 'icon-box-red',    bar: '#dc2626', progress: 40 },
  teal:   { accent: 'accent-teal',   iconBox: 'icon-box-teal',   bar: '#0d9488', progress: 91 },
};

const defaultAccents: Array<MetricCardProps['accentColor']> = [
  'purple', 'green', 'blue', 'amber', 'teal', 'red',
];

const changePalette = {
  positive: { color: '#059669', bg: 'rgba(5,150,105,0.08)', border: 'rgba(5,150,105,0.15)' },
  negative: { color: '#dc2626', bg: 'rgba(220,38,38,0.08)',  border: 'rgba(220,38,38,0.15)'  },
  neutral:  { color: 'hsl(var(--muted-foreground))', bg: 'hsl(var(--muted))', border: 'hsl(var(--border))' },
};

export default function MetricCard({
  title,
  value,
  change,
  changeType = 'neutral',
  icon: Icon,
  index = 0,
  accentColor,
}: MetricCardProps) {
  const color = accentColor ?? defaultAccents[index % defaultAccents.length]!;
  const { accent, iconBox, bar, progress } = accentMap[color];
  const cp = changePalette[changeType];

  const TrendIcon =
    changeType === 'positive' ? TrendingUp :
    changeType === 'negative' ? TrendingDown : Minus;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.38, delay: index * 0.07, ease: [0.25, 0.46, 0.45, 0.94] }}
      className={`cfo-card p-5 group ${accent}`}
    >
      {/* Top row */}
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="flex-1 min-w-0 space-y-1.5 pt-0.5">
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider truncate">
            {title}
          </p>
          <motion.p
            className="text-2xl font-bold text-card-foreground leading-none tabular-nums"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.42, delay: index * 0.07 + 0.12 }}
          >
            {value}
          </motion.p>
        </div>
        <div className={`icon-box ${iconBox} shrink-0`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>

      {/* Progress bar */}
      <div className="mb-3">
        <div
          className="h-1 w-full rounded-full overflow-hidden"
          style={{ background: 'hsl(var(--muted))' }}
        >
          <motion.div
            className="h-full rounded-full"
            style={{ background: `linear-gradient(90deg, ${bar}, ${bar}88)` }}
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.7, delay: index * 0.07 + 0.2, ease: 'easeOut' }}
          />
        </div>
      </div>

      {/* Change badge */}
      {change && (
        <div
          className="inline-flex items-center gap-1 rounded-full px-2 py-0.5"
          style={{ background: cp.bg, border: `1px solid ${cp.border}` }}
        >
          <TrendIcon className="h-2.5 w-2.5 shrink-0" style={{ color: cp.color }} />
          <p className="text-[11px] font-semibold" style={{ color: cp.color }}>
            {change}
          </p>
        </div>
      )}
    </motion.div>
  );
}
