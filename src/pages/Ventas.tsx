import { useState, useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  AreaChart, Area, PieChart, Pie, Cell, ResponsiveContainer,
} from 'recharts';
import { CalendarRange, TrendingUp, TrendingDown, DollarSign, Package } from 'lucide-react';
import { conductores, tiposGalon } from '../lib/mockData';
import { useApp } from '../lib/AppContext';
import { formatNumber } from '../lib/utils';
import { format, parseISO, eachDayOfInterval, startOfDay } from 'date-fns';
import { es } from 'date-fns/locale';

const TIPO_COLORS: Record<string, string> = {
  '5 kg':  '#f97316',
  '11 kg': '#3b82f6',
  '15 kg': '#10b981',
  '45 kg': '#a855f7',
};
const TIPO_BG: Record<string, string> = {
  '5 kg':  '#431407',
  '11 kg': '#1e3a5f',
  '15 kg': '#052e16',
  '45 kg': '#3b0764',
};
const DONUT_COLORS = ['#f97316', '#3b82f6', '#10b981', '#a855f7'];

const TOOLTIP = {
  background: '#151a26',
  border: '1px solid #2d3748',
  borderRadius: 10,
  color: '#e2e8f0',
  fontSize: 12,
  boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
};
const TICK = { fill: '#4a5568', fontSize: 11 };

// Mapa tipo_galon_id → precio planta
const PRECIO_PLANTA = Object.fromEntries(tiposGalon.map(t => [t.id, t.precio_planta]));
const PRECIO_X_NOMBRE = Object.fromEntries(tiposGalon.map(t => [t.nombre, t.precio_planta]));

function toDate(iso: string) { return iso.slice(0, 10); }

function formatCLP(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n}`;
}

function formatCLPFull(n: number): string {
  return `$${new Intl.NumberFormat('es-CL').format(Math.round(n))}`;
}

// Calcular valor CLP de una ficha a precio planta
function valorFicha(items: { tipo_galon_id: string; cantidad: number }[]): number {
  return items.reduce((s, it) => s + it.cantidad * (PRECIO_PLANTA[it.tipo_galon_id] ?? 0), 0);
}

export default function Ventas() {
  const { fichasSalida } = useApp();
  const [startDate, setStartDate] = useState('2026-05-26');
  const [endDate,   setEndDate]   = useState('2026-06-22');

  const filtered = useMemo(
    () => fichasSalida.filter(f => { const d = toDate(f.fecha_salida); return d >= startDate && d <= endDate; }),
    [fichasSalida, startDate, endDate],
  );

  // ── Revenue total en CLP ──────────────────────────────────────────────────
  const revenueTotal = useMemo(
    () => filtered.reduce((s, f) => s + valorFicha(f.items), 0),
    [filtered],
  );

  // ── Métricas por tipo (unidades + CLP) ───────────────────────────────────
  const metrics = useMemo(() => {
    const t: Record<string, { unidades: number; revenue: number }> = {};
    tiposGalon.forEach(tipo => { t[tipo.nombre] = { unidades: 0, revenue: 0 }; });
    filtered.forEach(f => f.items.forEach(it => {
      const n = it.tipo_galon?.nombre ?? '';
      if (n && t[n]) {
        t[n].unidades += it.cantidad;
        t[n].revenue  += it.cantidad * (PRECIO_X_NOMBRE[n] ?? 0);
      }
    }));
    return t;
  }, [filtered]);

  const totalUnidades = useMemo(
    () => Object.values(metrics).reduce((s, v) => s + v.unidades, 0),
    [metrics],
  );

  const ticketPromedio = filtered.length > 0 ? revenueTotal / filtered.length : 0;

  // Semana anterior simulada fija
  const DELTA_REVENUE: Record<string, number> = { '5 kg': 12, '11 kg': -5, '15 kg': 8, '45 kg': 23 };

  // ── Tendencia diaria CLP (últimos 14 días) ────────────────────────────────
  const areaData = useMemo(() => {
    const end = new Date(endDate);
    const start14 = new Date(end);
    start14.setDate(start14.getDate() - 13);
    return eachDayOfInterval({ start: startOfDay(start14), end: startOfDay(end) }).map(day => {
      const ds = format(day, 'yyyy-MM-dd');
      const row: Record<string, string | number> = { fecha: format(day, 'dd/MM') };
      tiposGalon.forEach(t => {
        const rev = filtered
          .filter(f => toDate(f.fecha_salida) === ds)
          .reduce((s, f) => s + (f.items.find(i => i.tipo_galon_id === t.id)?.cantidad ?? 0) * t.precio_planta, 0);
        row[t.nombre] = rev;
      });
      row.total = tiposGalon.reduce((s, t) => s + (row[t.nombre] as number), 0);
      return row;
    });
  }, [filtered, endDate]);

  // ── Barras semanales (CLP) ────────────────────────────────────────────────
  const weeklyData = useMemo(() => {
    const map: Record<string, Record<string, number>> = {};
    filtered.forEach(f => {
      const label = `Sem ${format(parseISO(f.fecha_salida), 'w', { locale: es })}`;
      if (!map[label]) map[label] = {};
      f.items.forEach(it => {
        const n = it.tipo_galon?.nombre ?? '';
        if (n) map[label][n] = (map[label][n] ?? 0) + it.cantidad * (PRECIO_X_NOMBRE[n] ?? 0);
      });
    });
    return Object.entries(map).map(([semana, v]) => ({ semana, ...v }));
  }, [filtered]);

  // ── Donut (revenue por tipo) ──────────────────────────────────────────────
  const donutData = useMemo(
    () => tiposGalon.map(t => ({ name: t.nombre, value: metrics[t.nombre]?.revenue ?? 0 })).filter(d => d.value > 0),
    [metrics],
  );

  // ── Conductor ranking (revenue CLP) ──────────────────────────────────────
  const conductorRank = useMemo(() => {
    const map: Record<string, { name: string; total: number; unidades: number; fichas: number }> = {};
    conductores.forEach(c => { map[c.id] = { name: c.nombre.split(' ').slice(0, 2).join(' '), total: 0, unidades: 0, fichas: 0 }; });
    filtered.forEach(f => {
      if (f.conductor_id && map[f.conductor_id]) {
        map[f.conductor_id].fichas++;
        f.items.forEach(it => {
          map[f.conductor_id].unidades += it.cantidad;
          map[f.conductor_id].total    += it.cantidad * (PRECIO_PLANTA[it.tipo_galon_id] ?? 0);
        });
      }
    });
    return Object.values(map).filter(c => c.total > 0).sort((a, b) => b.total - a.total);
  }, [filtered]);

  const maxConductor = conductorRank[0]?.total ?? 1;

  return (
    <div className="space-y-6">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4 justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Dashboard de Ventas</h1>
          <p className="text-xs mt-0.5" style={{ color: '#4a5568' }}>
            {filtered.length} despacho{filtered.length !== 1 ? 's' : ''} en el período · precios planta Abastible RM
          </p>
        </div>
        <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm"
          style={{ background: '#1e2432', border: '1px solid #2d3748' }}>
          <CalendarRange size={15} style={{ color: '#fb923c' }} />
          <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
            className="bg-transparent outline-none text-sm" style={{ color: '#e2e8f0' }} />
          <span style={{ color: '#2d3748' }}>—</span>
          <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
            className="bg-transparent outline-none text-sm" style={{ color: '#e2e8f0' }} />
        </div>
      </div>

      {/* ── KPI Hero (revenue) + métricas secundarias ─────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">

        {/* Hero revenue */}
        <div className="lg:col-span-2 rounded-2xl p-6 flex flex-col justify-between relative overflow-hidden"
          style={{ background: 'linear-gradient(135deg, #ea580c 0%, #c2410c 60%, #9a3412 100%)' }}>
          <div className="absolute -right-8 -top-8 w-36 h-36 rounded-full" style={{ background: 'rgba(255,255,255,0.06)' }} />
          <div className="absolute -right-4 -bottom-6 w-24 h-24 rounded-full" style={{ background: 'rgba(255,255,255,0.04)' }} />
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: 'rgba(255,255,255,0.6)' }}>
              Facturación Total — Precio Planta
            </p>
            <p className="text-5xl font-black text-white leading-none">{formatCLP(revenueTotal)}</p>
            <p className="text-sm mt-1" style={{ color: 'rgba(255,255,255,0.7)' }}>
              {formatCLPFull(revenueTotal)} CLP en el período
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 mt-5">
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold"
              style={{ background: 'rgba(255,255,255,0.15)', color: 'white' }}>
              <Package size={11} />
              <span>{formatNumber(totalUnidades)} cilindros</span>
            </div>
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold"
              style={{ background: 'rgba(255,255,255,0.15)', color: 'white' }}>
              <DollarSign size={11} />
              <span>Ticket prom. {formatCLP(ticketPromedio)}</span>
            </div>
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold"
              style={{ background: 'rgba(255,255,255,0.15)', color: 'white' }}>
              <span>{filtered.length} fichas · {conductores.length} conductores</span>
            </div>
          </div>
        </div>

        {/* Referencia de precios */}
        <div className="rounded-2xl p-5 flex flex-col justify-between" style={{ background: '#151b2e' }}>
          <div>
            <p className="text-xs font-bold text-white mb-0.5">Precios Planta</p>
            <p className="text-[10px] mb-4" style={{ color: '#4a5568' }}>Precio mayorista bodega → distribuidor</p>
          </div>
          <div className="space-y-2.5">
            {tiposGalon.map(t => (
              <div key={t.id} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full" style={{ background: TIPO_COLORS[t.nombre] }} />
                  <span className="text-xs font-medium" style={{ color: '#8892a4' }}>Cil. {t.nombre}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-white">{formatCLPFull(t.precio_planta)}</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: TIPO_BG[t.nombre], color: TIPO_COLORS[t.nombre] }}>
                    Público {formatCLPFull(t.precio_publico)}
                  </span>
                </div>
              </div>
            ))}
          </div>
          <p className="text-[9px] mt-3" style={{ color: '#2d3748' }}>
            Fuente: CNE / Abastible RM · Junio 2026
          </p>
        </div>
      </div>

      {/* ── Cards por tipo (revenue + unidades) ──────────────────────────── */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        {tiposGalon.map(t => {
          const m     = metrics[t.nombre] ?? { unidades: 0, revenue: 0 };
          const delta = DELTA_REVENUE[t.nombre] ?? 0;
          const color = TIPO_COLORS[t.nombre];
          const bg    = TIPO_BG[t.nombre];
          const pct   = revenueTotal > 0 ? Math.round((m.revenue / revenueTotal) * 100) : 0;
          return (
            <div key={t.id} className="rounded-2xl p-4 flex flex-col justify-between"
              style={{ background: '#1e2432', border: '1px solid #2d3748' }}>
              <div className="h-1 w-10 rounded-full mb-3" style={{ background: color }} />
              <div>
                <p className="text-xs font-semibold mb-0.5" style={{ color: '#4a5568' }}>Cil. {t.nombre}</p>
                <p className="text-2xl font-black leading-none" style={{ color }}>{formatCLP(m.revenue)}</p>
                <p className="text-[10px] mt-0.5" style={{ color: '#4a5568' }}>
                  {formatNumber(m.unidades)} unidades · {formatCLPFull(t.precio_planta)}/u
                </p>
                <div className="flex items-center gap-1 mt-2">
                  <div className="flex-1 h-1 rounded-full" style={{ background: '#111827' }}>
                    <div className="h-1 rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
                  </div>
                  <span className="text-[10px] font-semibold" style={{ color: '#4a5568' }}>{pct}%</span>
                </div>
              </div>
              <div className="flex items-center gap-1 mt-2">
                <div className="flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded"
                  style={{ background: bg, color }}>
                  {delta >= 0 ? <TrendingUp size={9} /> : <TrendingDown size={9} />}
                  {delta >= 0 ? '+' : ''}{delta}% vs semana ant.
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Área chart tendencia CLP ──────────────────────────────────────── */}
      <div className="rounded-2xl p-6" style={{ background: '#1e2432', border: '1px solid #2d3748' }}>
        <div className="flex items-start justify-between mb-6">
          <div>
            <h2 className="text-sm font-bold text-white">Tendencia de Facturación</h2>
            <p className="text-xs mt-0.5" style={{ color: '#4a5568' }}>Revenue diario por tipo — últimos 14 días (CLP)</p>
          </div>
          <div className="flex flex-wrap gap-3">
            {tiposGalon.map(t => (
              <div key={t.id} className="flex items-center gap-1.5 text-xs" style={{ color: '#8892a4' }}>
                <div className="w-2 h-2 rounded-full" style={{ background: TIPO_COLORS[t.nombre] }} />
                {t.nombre}
              </div>
            ))}
          </div>
        </div>
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={areaData} margin={{ left: -10 }}>
            <defs>
              {tiposGalon.map(t => (
                <linearGradient key={t.id} id={`grad_${t.id}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={TIPO_COLORS[t.nombre]} stopOpacity={0.2} />
                  <stop offset="100%" stopColor={TIPO_COLORS[t.nombre]} stopOpacity={0} />
                </linearGradient>
              ))}
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#1a1f2e" vertical={false} />
            <XAxis dataKey="fecha" tick={{ fill: '#4a5568', fontSize: 10 }} axisLine={false} tickLine={false} interval={1} />
            <YAxis tick={TICK} axisLine={false} tickLine={false} tickFormatter={v => formatCLP(v as number)} />
            <Tooltip
              contentStyle={TOOLTIP}
              formatter={(v, name) => [formatCLPFull(Number(v)), String(name)]}
            />
            {tiposGalon.map(t => (
              <Area key={t.id} type="monotone" dataKey={t.nombre}
                stroke={TIPO_COLORS[t.nombre]} strokeWidth={2}
                fill={`url(#grad_${t.id})`}
                dot={false} activeDot={{ r: 4, strokeWidth: 0, fill: TIPO_COLORS[t.nombre] }}
              />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* ── Row 2: Barras semanales CLP + Donut revenue ──────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        {/* Barras semanales CLP */}
        <div className="xl:col-span-2 rounded-2xl p-6" style={{ background: '#1e2432', border: '1px solid #2d3748' }}>
          <h2 className="text-sm font-bold text-white mb-1">Facturación por Semana</h2>
          <p className="text-xs mb-5" style={{ color: '#4a5568' }}>Revenue semanal por tipo de cilindro (CLP)</p>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={weeklyData} barGap={2} barCategoryGap="30%">
              <CartesianGrid strokeDasharray="3 3" stroke="#1a1f2e" vertical={false} />
              <XAxis dataKey="semana" tick={TICK} axisLine={false} tickLine={false} />
              <YAxis tick={TICK} axisLine={false} tickLine={false} tickFormatter={v => formatCLP(v as number)} />
              <Tooltip contentStyle={TOOLTIP} formatter={(v, name) => [formatCLPFull(Number(v)), String(name)]} />
              <Legend wrapperStyle={{ fontSize: 11, color: '#4a5568', paddingTop: 12 }} />
              {tiposGalon.map(t => (
                <Bar key={t.id} dataKey={t.nombre} fill={TIPO_COLORS[t.nombre]}
                  radius={[4, 4, 0, 0]} maxBarSize={22} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Donut revenue */}
        <div className="rounded-2xl p-6 flex flex-col" style={{ background: '#1e2432', border: '1px solid #2d3748' }}>
          <h2 className="text-sm font-bold text-white mb-1">Distribución Revenue</h2>
          <p className="text-xs mb-4" style={{ color: '#4a5568' }}>Por tipo de cilindro (CLP)</p>
          {donutData.length === 0 ? (
            <div className="flex-1 flex items-center justify-center text-sm" style={{ color: '#4a5568' }}>Sin datos</div>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={140}>
                <PieChart>
                  <Pie data={donutData} cx="50%" cy="50%" innerRadius={42} outerRadius={65}
                    paddingAngle={4} dataKey="value" strokeWidth={0}>
                    {donutData.map((_, i) => <Cell key={i} fill={DONUT_COLORS[i % DONUT_COLORS.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={TOOLTIP} formatter={(v, n) => [formatCLPFull(Number(v)), String(n)]} />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-2 mt-2">
                {donutData.map((d, i) => {
                  const pct = revenueTotal > 0 ? ((d.value / revenueTotal) * 100).toFixed(1) : '0';
                  return (
                    <div key={d.name} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full" style={{ background: DONUT_COLORS[i] }} />
                        <span className="text-xs text-white">Cil. {d.name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-white">{formatCLP(d.value)}</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded font-semibold"
                          style={{ background: TIPO_BG[d.name], color: DONUT_COLORS[i] }}>{pct}%</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── Conductor ranking (revenue CLP) ──────────────────────────────── */}
      <div className="rounded-2xl p-6" style={{ background: '#1e2432', border: '1px solid #2d3748' }}>
        <h2 className="text-sm font-bold text-white mb-1">Ranking de Conductores</h2>
        <p className="text-xs mb-5" style={{ color: '#4a5568' }}>Revenue generado por conductor en el período</p>
        {conductorRank.length === 0 ? (
          <p className="text-sm text-center py-6" style={{ color: '#4a5568' }}>Sin datos</p>
        ) : (
          <div className="space-y-3">
            {conductorRank.map((c, i) => {
              const pct   = Math.round((c.total / maxConductor) * 100);
              const isTop = i === 0;
              return (
                <div key={c.name} className="flex items-center gap-4">
                  <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                    style={{ background: isTop ? '#ea580c' : '#252b3b', color: isTop ? 'white' : '#4a5568' }}>
                    {i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-semibold text-white truncate">{c.name}</span>
                      <div className="flex items-center gap-2 ml-2 flex-shrink-0">
                        <span className="text-[10px]" style={{ color: '#4a5568' }}>
                          {formatNumber(c.unidades)} u · {c.fichas} ficha{c.fichas !== 1 ? 's' : ''}
                        </span>
                        <span className="text-xs font-bold" style={{ color: isTop ? '#fb923c' : '#e2e8f0' }}>
                          {formatCLP(c.total)}
                        </span>
                      </div>
                    </div>
                    <div className="h-1.5 rounded-full" style={{ background: '#111827' }}>
                      <div className="h-1.5 rounded-full transition-all"
                        style={{
                          width: `${pct}%`,
                          background: isTop ? 'linear-gradient(90deg, #ea580c, #f97316)' : '#2d3748',
                        }} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

    </div>
  );
}
