import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  BarChart, Bar, ResponsiveContainer,
  PieChart, Pie, Cell, Tooltip,
} from 'recharts';
import {
  ArrowDownToLine, ArrowUpFromLine, ShieldAlert, TrendingUp,
  AlertTriangle, AlertCircle, ChevronRight, DollarSign,
} from 'lucide-react';
import StatusBadge from '../components/StatusBadge';
import { tiposGalon } from '../lib/mockData';
import { useApp } from '../lib/AppContext';
import { formatNumber } from '../lib/utils';

// Mapa tipo_galon_id → precio planta para calcular revenue
const PRECIO_PLANTA_MAP = Object.fromEntries(tiposGalon.map(t => [t.id, t.precio_planta]));

function formatCLP(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n}`;
}

const TODAY = '2026-06-22';

const TIPO_COLORS: Record<string, string> = {
  '5 kg':  '#f97316',
  '11 kg': '#3b82f6',
  '15 kg': '#10b981',
  '45 kg': '#a855f7',
};
const TIPO_BG: Record<string, string> = {
  '5 kg': '#431407', '11 kg': '#1e3a5f', '15 kg': '#052e16', '45 kg': '#3b0764',
};
const DONUT_COLORS = ['#f97316', '#3b82f6', '#10b981', '#a855f7'];

function formatK(n: number) {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return String(n);
}

function toDateStr(iso: string) { return iso.slice(0, 10); }

export default function Dashboard() {
  const {
    fichasIngreso, fichasSalida, controlCalidad,
    stockPorTipo, stockTotal, alertas,
  } = useApp();

  const ingresosHoy = useMemo(
    () => fichasIngreso.filter(f => toDateStr(f.fecha_ingreso) === TODAY),
    [fichasIngreso],
  );
  const salidasHoy = useMemo(
    () => fichasSalida.filter(f => toDateStr(f.fecha_salida) === TODAY),
    [fichasSalida],
  );
  const calidadObs = useMemo(
    () => controlCalidad.filter(c => c.resultado !== 'aprobado').length,
    [controlCalidad],
  );

  // Revenue del mes (últimas 4 semanas) en CLP a precio planta
  const revenueTotal = useMemo(() => {
    return fichasSalida
      .filter(f => f.estado === 'entregado' || f.estado === 'en_ruta')
      .reduce((s, f) => s + f.items.reduce(
        (a, it) => a + it.cantidad * (PRECIO_PLANTA_MAP[it.tipo_galon_id] ?? 0), 0,
      ), 0);
  }, [fichasSalida]);

  // ── Sparkline semanal ─────────────────────────────────────────────────────
  const sparkData = useMemo(() => {
    const weeks = [
      { s: '2026-05-26', e: '2026-06-01' },
      { s: '2026-06-02', e: '2026-06-08' },
      { s: '2026-06-09', e: '2026-06-15' },
      { s: '2026-06-16', e: '2026-06-22' },
    ];
    return weeks.map(({ s, e }) => {
      const inRange = fichasSalida.filter(f => {
        const d = toDateStr(f.fecha_salida);
        return d >= s && d <= e;
      });
      const entry: Record<string, number> = {};
      tiposGalon.forEach(t => {
        entry[t.nombre] = inRange.reduce(
          (acc, f) => acc + (f.items.find(i => i.tipo_galon_id === t.id)?.cantidad ?? 0), 0,
        );
      });
      return entry;
    });
  }, [fichasSalida]);

  // ── Donut ─────────────────────────────────────────────────────────────────
  const donutData = useMemo(
    () => tiposGalon.map(t => ({ name: t.nombre, value: stockPorTipo[t.nombre] ?? 0 })).filter(d => d.value > 0),
    [stockPorTipo],
  );

  const recentIngresos = useMemo(() => fichasIngreso.slice(-3).reverse(), [fichasIngreso]);
  const recentSalidas  = useMemo(() => fichasSalida.slice(-3).reverse(),  [fichasSalida]);

  return (
    <div className="space-y-4">

      {/* ── Alertas banner ──────────────────────────────────────────────────── */}
      {alertas.length > 0 && (
        <div className="space-y-2">
          {alertas.map(a => (
            <Link
              key={a.id}
              to={a.link}
              className="flex items-center gap-3 px-4 py-3 rounded-xl transition-opacity hover:opacity-90"
              style={{
                background: a.nivel === 'danger' ? '#3b0000' : '#2d1a00',
                border: `1px solid ${a.nivel === 'danger' ? '#ef444440' : '#f9731640'}`,
              }}
            >
              {a.nivel === 'danger'
                ? <AlertCircle size={15} style={{ color: '#f87171', flexShrink: 0 }} />
                : <AlertTriangle size={15} style={{ color: '#fbbf24', flexShrink: 0 }} />}
              <span className="text-xs flex-1" style={{ color: a.nivel === 'danger' ? '#fca5a5' : '#fde68a' }}>
                {a.mensaje}
              </span>
              <ChevronRight size={13} style={{ color: a.nivel === 'danger' ? '#f87171' : '#fbbf24', flexShrink: 0 }} />
            </Link>
          ))}
        </div>
      )}

      {/* ── Row 1: Hero + 3 stat cards ──────────────────────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-5 gap-4">

        {/* Hero */}
        <div className="xl:col-span-3 rounded-2xl p-6 relative overflow-hidden"
          style={{ background: '#151b2e' }}>
          <div className="flex items-start gap-4">
            <div className="flex-1 min-w-0">
              <p className="text-[10px] uppercase tracking-widest font-semibold mb-2" style={{ color: '#4a5568' }}>
                Stock en Bodega · Planta Santiago
              </p>
              <p className="text-6xl font-black text-white leading-none">{formatK(stockTotal)}</p>
              <p className="text-xs mt-1.5" style={{ color: '#4a5568' }}>cilindros disponibles</p>

              <div className="flex flex-wrap gap-x-5 gap-y-1.5 mt-5">
                {tiposGalon.map(t => (
                  <div key={t.id} className="flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 rounded-full" style={{ background: TIPO_COLORS[t.nombre] }} />
                    <span className="text-xs" style={{ color: TIPO_COLORS[t.nombre] }}>{t.nombre}</span>
                    <span className="text-xs font-bold text-white">{formatK(stockPorTipo[t.nombre] ?? 0)}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Sparkline */}
            <div style={{ width: 120, height: 72, flexShrink: 0 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={sparkData} barGap={1} barCategoryGap="15%">
                  {tiposGalon.map(t => (
                    <Bar key={t.id} dataKey={t.nombre} stackId="a"
                      fill={TIPO_COLORS[t.nombre]} radius={t.nombre === '45 kg' ? [2,2,0,0] : undefined} />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="absolute -bottom-12 -right-12 w-44 h-44 rounded-full opacity-[0.04]"
            style={{ background: '#f97316' }} />
        </div>

        {/* 3 stat cards */}
        <div className="xl:col-span-2 grid grid-rows-3 gap-3">
          <div className="rounded-2xl px-5 py-4 flex items-center justify-between"
            style={{ background: 'linear-gradient(135deg,#ea580c,#c2410c)' }}>
            <div>
              <p className="text-[10px] uppercase tracking-wide font-semibold" style={{ color: 'rgba(255,255,255,.55)' }}>Ingresos del Día</p>
              <p className="text-4xl font-black text-white leading-none mt-0.5">{ingresosHoy.length}</p>
              <p className="text-[10px] mt-0.5" style={{ color: 'rgba(255,255,255,.4)' }}>fichas creadas</p>
            </div>
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'rgba(255,255,255,.15)' }}>
              <ArrowDownToLine size={17} color="white" />
            </div>
          </div>

          <div className="rounded-2xl px-5 py-4 flex items-center justify-between" style={{ background: '#1a2a47' }}>
            <div>
              <p className="text-[10px] uppercase tracking-wide font-semibold" style={{ color: '#38bdf8' }}>Despachos del Día</p>
              <p className="text-4xl font-black text-white leading-none mt-0.5">{salidasHoy.length}</p>
              <p className="text-[10px] mt-0.5" style={{ color: 'rgba(56,189,248,.45)' }}>fichas activas</p>
            </div>
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'rgba(56,189,248,.12)' }}>
              <ArrowUpFromLine size={17} color="#38bdf8" />
            </div>
          </div>

          {/* Revenue card */}
          <div className="rounded-2xl px-5 py-4 flex items-center justify-between"
            style={{ background: '#1a2a1a' }}>
            <div>
              <p className="text-[10px] uppercase tracking-wide font-semibold" style={{ color: '#4ade80' }}>
                Facturación Período
              </p>
              <p className="text-3xl font-black text-white leading-none mt-0.5">{formatCLP(revenueTotal)}</p>
              <div className="flex items-center gap-2 mt-0.5">
                <p className="text-[10px]" style={{ color: 'rgba(74,222,128,.4)' }}>precio planta · CLP</p>
                {calidadObs > 0 && (
                  <div className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-semibold"
                    style={{ background: 'rgba(251,191,36,.15)', color: '#fbbf24' }}>
                    <ShieldAlert size={9} />
                    {calidadObs} calidad
                  </div>
                )}
              </div>
            </div>
            <div className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ background: 'rgba(74,222,128,.12)' }}>
              <DollarSign size={17} color="#4ade80" />
            </div>
          </div>
        </div>
      </div>

      {/* ── Row 2: 4 tipo cards ──────────────────────────────────────────── */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        {tiposGalon.map(t => {
          const val   = stockPorTipo[t.nombre] ?? 0;
          const color = TIPO_COLORS[t.nombre];
          const pct   = stockTotal > 0 ? Math.round((val / stockTotal) * 100) : 0;
          return (
            <div key={t.id} className="rounded-2xl p-5 relative overflow-hidden" style={{ background: '#151b2e' }}>
              <div className="flex items-start justify-between mb-4">
                <div className="px-2 py-0.5 rounded text-[10px] font-black" style={{ background: TIPO_BG[t.nombre], color }}>
                  {t.nombre}
                </div>
                <TrendingUp size={13} style={{ color }} />
              </div>
              <p className="text-3xl font-black text-white leading-none">{formatK(val)}</p>
              <p className="text-[10px] mt-1 mb-3" style={{ color: '#4a5568' }}>cilindros en bodega</p>
              <div className="h-1 rounded-full" style={{ background: '#1e2432' }}>
                <div className="h-1 rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
              </div>
              <p className="text-[10px] mt-1 text-right font-semibold" style={{ color: '#4a5568' }}>{pct}% del stock</p>
              <div className="absolute -bottom-5 -right-5 w-16 h-16 rounded-full opacity-[0.08]"
                style={{ background: color }} />
            </div>
          );
        })}
      </div>

      {/* ── Row 3: Donut + Activity feed ────────────────────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-5 gap-4">

        {/* Donut */}
        <div className="xl:col-span-2 rounded-2xl p-6" style={{ background: '#151b2e' }}>
          <p className="text-sm font-bold text-white">Distribución Stock</p>
          <p className="text-xs mt-0.5 mb-4" style={{ color: '#4a5568' }}>Por tipo de cilindro</p>
          {donutData.length > 0 && (
            <>
              <ResponsiveContainer width="100%" height={150}>
                <PieChart>
                  <Pie data={donutData} cx="50%" cy="50%" innerRadius={44} outerRadius={68}
                    paddingAngle={4} dataKey="value" strokeWidth={0}>
                    {donutData.map((_, i) => <Cell key={i} fill={DONUT_COLORS[i % 4]} />)}
                  </Pie>
                  <Tooltip contentStyle={{ background: '#151b2e', border: '1px solid #2d3748', borderRadius: 8, fontSize: 12, color: '#e2e8f0' }}
                    formatter={(v, n) => [formatNumber(Number(v)), String(n)]} />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-2.5 mt-1">
                {donutData.map((d, i) => {
                  const pct = stockTotal > 0 ? ((d.value / stockTotal) * 100).toFixed(0) : '0';
                  return (
                    <div key={d.name} className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: DONUT_COLORS[i] }} />
                      <span className="text-xs text-white flex-1">Cil. {d.name}</span>
                      <div className="h-1 w-20 rounded-full" style={{ background: '#1e2432' }}>
                        <div className="h-1 rounded-full" style={{ width: `${pct}%`, background: DONUT_COLORS[i] }} />
                      </div>
                      <span className="text-[10px] font-bold w-7 text-right" style={{ color: DONUT_COLORS[i] }}>{pct}%</span>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>

        {/* Activity feed */}
        <div className="xl:col-span-3 rounded-2xl overflow-hidden" style={{ background: '#151b2e' }}>
          <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid #1e2432' }}>
            <div>
              <p className="text-sm font-bold text-white">Actividad Reciente</p>
              <p className="text-xs" style={{ color: '#4a5568' }}>Últimos movimientos de bodega</p>
            </div>
            <div className="flex gap-2">
              <Link to="/ingresos" className="text-[10px] px-2.5 py-1 rounded-lg font-medium"
                style={{ background: '#1e2432', color: '#8892a4' }}>Ingresos</Link>
              <Link to="/salidas" className="text-[10px] px-2.5 py-1 rounded-lg font-medium"
                style={{ background: '#1e2432', color: '#8892a4' }}>Despachos</Link>
            </div>
          </div>

          <div className="px-4 pt-3 pb-1">
            <p className="text-[9px] uppercase tracking-widest font-bold px-2 mb-1.5" style={{ color: '#2d3748' }}>
              Ingresos
            </p>
            {recentIngresos.map(f => (
              <div key={f.id}
                className="flex items-center gap-3 px-2 py-2.5 rounded-xl cursor-default"
                style={{ transition: 'background .15s' }}
                onMouseEnter={e => (e.currentTarget.style.background = '#1e2432')}
                onMouseLeave={e => (e.currentTarget.style.background = '')}>
                <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: '#431407' }}>
                  <ArrowDownToLine size={14} style={{ color: '#fb923c' }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-white truncate">{f.proveedor.split(' — ')[0]}</p>
                  <p className="text-[10px]" style={{ color: '#4a5568' }}>{f.numero_ficha}</p>
                </div>
                <div className="flex flex-col items-end gap-0.5 flex-shrink-0">
                  <p className="text-xs font-bold" style={{ color: '#34d399' }}>+{formatK(f.cantidad)}</p>
                  <StatusBadge estado={f.estado} small />
                </div>
              </div>
            ))}
          </div>

          <div className="mx-6 my-1" style={{ height: 1, background: '#1e2432' }} />

          <div className="px-4 pt-1 pb-3">
            <p className="text-[9px] uppercase tracking-widest font-bold px-2 mb-1.5" style={{ color: '#2d3748' }}>
              Despachos
            </p>
            {recentSalidas.map(f => (
              <div key={f.id}
                className="flex items-center gap-3 px-2 py-2.5 rounded-xl cursor-default"
                style={{ transition: 'background .15s' }}
                onMouseEnter={e => (e.currentTarget.style.background = '#1e2432')}
                onMouseLeave={e => (e.currentTarget.style.background = '')}>
                <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: '#1a2a47' }}>
                  <ArrowUpFromLine size={14} style={{ color: '#38bdf8' }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-white truncate">{f.destino.split(' — ')[0]}</p>
                  <p className="text-[10px]" style={{ color: '#4a5568' }}>
                    {f.numero_ficha} · {f.conductor?.nombre.split(' ')[0]} {f.conductor?.nombre.split(' ')[1]}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-0.5 flex-shrink-0">
                  <p className="text-xs font-bold" style={{ color: '#f87171' }}>−{formatK(f.cantidad)}</p>
                  <StatusBadge estado={f.estado} small />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
