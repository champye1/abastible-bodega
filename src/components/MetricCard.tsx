import type { LucideIcon } from 'lucide-react';
import { formatNumber } from '../lib/utils';

interface Props {
  label: string;
  value: number | string;
  icon: LucideIcon;
  iconColor?: string;
  iconBg?: string;
  trend?: { value: number; positive: boolean };
  unit?: string;
}

export default function MetricCard({
  label, value, icon: Icon,
  iconColor = '#60a5fa', iconBg = '#1e3a5f',
  trend, unit,
}: Props) {
  const displayValue = typeof value === 'number' ? formatNumber(value) : value;

  return (
    <div
      className="rounded-xl p-5 flex flex-col gap-3"
      style={{ background: '#1e2432', border: '1px solid #2d3748' }}
    >
      <div className="flex items-start justify-between">
        <p className="text-sm font-medium" style={{ color: '#8892a4' }}>
          {label}
        </p>
        <div
          className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ background: iconBg }}
        >
          <Icon size={18} style={{ color: iconColor }} />
        </div>
      </div>

      <div className="flex items-end gap-2">
        <span className="text-2xl font-bold text-white">{displayValue}</span>
        {unit && <span className="text-sm mb-0.5" style={{ color: '#8892a4' }}>{unit}</span>}
      </div>

      {trend && (
        <p className="text-xs" style={{ color: trend.positive ? '#34d399' : '#f87171' }}>
          {trend.positive ? '▲' : '▼'} {Math.abs(trend.value)}% vs semana anterior
        </p>
      )}
    </div>
  );
}
