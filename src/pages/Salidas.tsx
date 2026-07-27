import { useState, useMemo, useEffect, useRef } from 'react';
import { Plus, Filter, Trash2, ChevronDown, Package } from 'lucide-react';
import Modal from '../components/Modal';
import StatusBadge from '../components/StatusBadge';
import { tiposGalon, conductores } from '../lib/mockData';
import { useApp } from '../lib/AppContext';
import { formatDateTime, formatNumber, padFicha } from '../lib/utils';
import type { FichaSalida, FichaItem } from '../lib/types';

type EstadoFiltro = '' | 'pendiente' | 'en_ruta' | 'entregado';

const TRANSICIONES_SALIDA: Record<string, FichaSalida['estado'][]> = {
  pendiente: ['en_ruta'],
  en_ruta:   ['entregado'],
  entregado: [],
};

const LABELS_SALIDA: Record<string, string> = {
  en_ruta:   'Marcar En Distribución',
  entregado: 'Marcar Entregado',
};

function DropdownEstadoSalida({
  id, estado, onChange,
}: { id: string; estado: FichaSalida['estado']; onChange: (id: string, e: FichaSalida['estado']) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const siguientes = TRANSICIONES_SALIDA[estado] ?? [];

  useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  if (siguientes.length === 0) return <StatusBadge estado={estado} />;

  return (
    <div className="relative inline-block" ref={ref}>
      <button onClick={() => setOpen(p => !p)} className="flex items-center gap-1">
        <StatusBadge estado={estado} />
        <ChevronDown size={11} style={{ color: '#4a5568' }}
          className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div
          className="absolute left-0 top-full mt-1 z-30 rounded-lg overflow-hidden shadow-xl min-w-[180px]"
          style={{ background: '#1e2432', border: '1px solid #2d3748' }}
        >
          {siguientes.map(s => (
            <button key={s} onClick={() => { onChange(id, s); setOpen(false); }}
              className="flex items-center gap-2 w-full px-3 py-2.5 text-xs text-left hover:bg-[#252b3b] transition-colors">
              <StatusBadge estado={s} small />
              <span style={{ color: '#8892a4' }}>{LABELS_SALIDA[s]}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

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

interface FormItem { tipo_galon_id: string; cantidad: string; }

function emptyForm() {
  return {
    conductor_id: conductores[0].id,
    destino: '',
    observaciones: '',
    items: [{ tipo_galon_id: tiposGalon[0].id, cantidad: '' }] as FormItem[],
  };
}

function ItemPills({ items }: { items: FichaItem[] }) {
  return (
    <div className="flex flex-wrap gap-1">
      {items.map((it, i) => {
        const n = it.tipo_galon?.nombre ?? '';
        return (
          <span key={i} className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-medium"
            style={{ background: TIPO_BG[n] ?? '#1e2432', color: TIPO_COLORS[n] ?? '#8892a4' }}>
            {n} <span style={{ color: '#94a3b8', fontWeight: 400 }}>×{formatNumber(it.cantidad)}</span>
          </span>
        );
      })}
    </div>
  );
}

export default function Salidas() {
  const { fichasSalida: records, cambiarEstadoSalida, addSalida, stockPorTipo } = useApp();
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [conductorFilter, setConductorFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<EstadoFiltro>('');

  function cambiarEstado(id: string, nuevo: FichaSalida['estado']) {
    cambiarEstadoSalida(id, nuevo);
  }

  const filtered = useMemo(() => records.filter(r => {
    if (statusFilter && r.estado !== statusFilter) return false;
    if (conductorFilter && r.conductor_id !== conductorFilter) return false;
    return true;
  }), [records, statusFilter, conductorFilter]);

  // ── Item handlers ─────────────────────────────────────────────────────────
  function updateItem(idx: number, field: keyof FormItem, value: string) {
    setForm(p => ({ ...p, items: p.items.map((it, i) => i === idx ? { ...it, [field]: value } : it) }));
  }

  function addItem() {
    const used = new Set(form.items.map(i => i.tipo_galon_id));
    const next = tiposGalon.find(t => !used.has(t.id));
    if (!next) return;
    setForm(p => ({ ...p, items: [...p.items, { tipo_galon_id: next.id, cantidad: '' }] }));
  }

  function removeItem(idx: number) {
    setForm(p => ({ ...p, items: p.items.filter((_, i) => i !== idx) }));
  }

  // ── Validation (incluye validación de stock) ──────────────────────────────
  function validate() {
    const e: Record<string, string> = {};
    if (!form.destino.trim()) e.destino = 'Requerido';
    form.items.forEach((it, i) => {
      const cant = parseInt(it.cantidad);
      if (!it.cantidad || cant <= 0) {
        e[`item_${i}`] = 'Debe ser > 0';
      } else {
        const tipo = tiposGalon.find(t => t.id === it.tipo_galon_id);
        if (tipo) {
          const disponible = stockPorTipo[tipo.nombre] ?? 0;
          if (cant > disponible) {
            e[`item_${i}`] = `Stock insuficiente — disponible: ${formatNumber(disponible)} cilindros`;
          }
        }
      }
    });
    const ids = form.items.map(i => i.tipo_galon_id);
    if (new Set(ids).size !== ids.length) e.items = 'No puede repetir el mismo tipo de cilindro';
    return e;
  }

  function handleSubmit(ev: React.FormEvent) {
    ev.preventDefault();
    const e = validate();
    if (Object.keys(e).length) { setErrors(e); return; }
    setSaving(true);
    setTimeout(() => {
      const conductor = conductores.find(c => c.id === form.conductor_id)!;
      const resolvedItems: FichaItem[] = form.items.map(it => ({
        tipo_galon_id: it.tipo_galon_id,
        tipo_galon: tiposGalon.find(t => t.id === it.tipo_galon_id),
        cantidad: parseInt(it.cantidad),
      }));
      const first = resolvedItems[0];
      const total = resolvedItems.reduce((s, i) => s + i.cantidad, 0);
      const nueva: FichaSalida = {
        id: `s${Date.now()}`,
        numero_ficha: padFicha('SAL', records.length + 1),
        fecha_salida: new Date().toISOString(),
        conductor_id: form.conductor_id,
        conductor,
        tipo_galon_id: first.tipo_galon_id,
        tipo_galon: first.tipo_galon,
        cantidad: total,
        items: resolvedItems,
        destino: form.destino.trim(),
        estado: 'en_ruta',
        observaciones: form.observaciones.trim(),
        created_at: new Date().toISOString(),
      };
      addSalida(nueva);
      setShowModal(false);
      setForm(emptyForm());
      setErrors({});
      setSaving(false);
    }, 500);
  }

  function openModal() { setForm(emptyForm()); setErrors({}); setShowModal(true); }

  const usedTypes = new Set(form.items.map(i => i.tipo_galon_id));
  const canAddMore = usedTypes.size < tiposGalon.length;
  const previewTotal = form.items.reduce((s, i) => s + (parseInt(i.cantidad) || 0), 0);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4 justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Fichas de Despacho</h1>
          <p className="text-sm mt-0.5" style={{ color: '#8892a4' }}>
            {filtered.length} registro{filtered.length !== 1 ? 's' : ''}
          </p>
        </div>
        <button
          onClick={openModal}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white"
          style={{ background: '#ea580c' }}
          onMouseEnter={e => (e.currentTarget.style.background = '#c2410c')}
          onMouseLeave={e => (e.currentTarget.style.background = '#ea580c')}
        >
          <Plus size={16} /> Nueva Ficha
        </button>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-3 p-4 rounded-xl" style={{ background: '#1e2432', border: '1px solid #2d3748' }}>
        <div className="flex items-center gap-2">
          <Filter size={14} style={{ color: '#4a5568' }} />
          <select value={conductorFilter} onChange={e => setConductorFilter(e.target.value)}
            className="bg-transparent text-sm outline-none border rounded px-2 py-1"
            style={{ color: '#e2e8f0', borderColor: '#2d3748', background: '#1e2432' }}>
            <option value="">Todos los conductores</option>
            {conductores.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as EstadoFiltro)}
            className="bg-transparent text-sm outline-none border rounded px-2 py-1"
            style={{ color: '#e2e8f0', borderColor: '#2d3748', background: '#1e2432' }}>
            <option value="">Todos los estados</option>
            <option value="pendiente">Pendiente</option>
            <option value="en_ruta">En Ruta</option>
            <option value="entregado">Entregado</option>
          </select>
        </div>
        {(conductorFilter || statusFilter) && (
          <button onClick={() => { setConductorFilter(''); setStatusFilter(''); }}
            className="text-xs px-3 py-1 rounded" style={{ color: '#f87171', background: '#450a0a' }}>
            Limpiar
          </button>
        )}
      </div>

      {/* Tabla */}
      <div className="rounded-xl overflow-hidden" style={{ background: '#1e2432', border: '1px solid #2d3748' }}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: '1px solid #2d3748', background: '#171c28' }}>
                {['N° Ficha', 'Fecha Despacho', 'Conductor', 'Patente', 'Cilindros', 'Total', 'Destino', 'Estado'].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: '#4a5568' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={8} className="px-4 py-10 text-center text-sm" style={{ color: '#4a5568' }}>No se encontraron registros</td></tr>
              ) : filtered.map(f => (
                <tr key={f.id} style={{ borderBottom: '1px solid #1a1f2e' }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#252b3b')}
                  onMouseLeave={e => (e.currentTarget.style.background = '')}>
                  <td className="px-4 py-3 font-mono text-xs font-semibold" style={{ color: '#fb923c' }}>{f.numero_ficha}</td>
                  <td className="px-4 py-3 text-xs whitespace-nowrap" style={{ color: '#8892a4' }}>{formatDateTime(f.fecha_salida)}</td>
                  <td className="px-4 py-3 text-sm text-white whitespace-nowrap">{f.conductor?.nombre}</td>
                  <td className="px-4 py-3 font-mono text-xs" style={{ color: '#8892a4' }}>{f.conductor?.patente}</td>
                  <td className="px-4 py-3"><ItemPills items={f.items} /></td>
                  <td className="px-4 py-3 text-sm font-bold text-white whitespace-nowrap">{formatNumber(f.cantidad)}</td>
                  <td className="px-4 py-3 text-xs text-slate-300 truncate max-w-[140px]">{f.destino}</td>
                  <td className="px-4 py-3">
                    <DropdownEstadoSalida id={f.id} estado={f.estado} onChange={cambiarEstado} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      <Modal open={showModal} onClose={() => setShowModal(false)} title="Nueva Ficha de Despacho">
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Conductor */}
          <div>
            <label className="block text-xs font-semibold mb-1.5" style={{ color: '#8892a4' }}>Conductor *</label>
            <select value={form.conductor_id} onChange={e => setForm(p => ({ ...p, conductor_id: e.target.value }))}
              className="w-full rounded-lg px-3 py-2.5 text-sm outline-none"
              style={{ background: '#111827', border: '1px solid #2d3748', color: '#e2e8f0' }}>
              {conductores.filter(c => c.activo).map(c => (
                <option key={c.id} value={c.id}>{c.nombre} — {c.patente}</option>
              ))}
            </select>
          </div>

          {/* Ítems de cilindros con disponibilidad de stock */}
          <div>
            <div className="flex items-center justify-between mb-2.5">
              <label className="text-xs font-semibold" style={{ color: '#8892a4' }}>Cilindros y Cantidades *</label>
              {canAddMore && (
                <button type="button" onClick={addItem}
                  className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-lg"
                  style={{ color: '#fb923c', background: '#431407' }}>
                  <Plus size={11} /> Agregar tipo
                </button>
              )}
            </div>

            <div className="space-y-2">
              {form.items.map((item, idx) => {
                const tipo = tiposGalon.find(t => t.id === item.tipo_galon_id);
                const color = TIPO_COLORS[tipo?.nombre ?? ''] ?? '#8892a4';
                const disponible = tipo ? (stockPorTipo[tipo.nombre] ?? 0) : 0;
                const cantSolicitada = parseInt(item.cantidad) || 0;
                const sinStock = cantSolicitada > disponible && cantSolicitada > 0;

                return (
                  <div key={idx} className="space-y-1">
                    <div className="flex gap-2 items-center">
                      <div className="w-1 rounded-full flex-shrink-0" style={{ background: color, alignSelf: 'stretch', minHeight: 36 }} />
                      <select value={item.tipo_galon_id} onChange={e => updateItem(idx, 'tipo_galon_id', e.target.value)}
                        className="flex-1 rounded-lg px-3 py-2 text-sm outline-none"
                        style={{ background: '#111827', border: '1px solid #2d3748', color: '#e2e8f0' }}>
                        {tiposGalon.map(t => (
                          <option key={t.id} value={t.id}
                            disabled={form.items.some((it, i) => i !== idx && it.tipo_galon_id === t.id)}>
                            {t.nombre} — {t.descripcion.split(' — ')[0]}
                          </option>
                        ))}
                      </select>
                      <input type="number" min="1" value={item.cantidad}
                        onChange={e => updateItem(idx, 'cantidad', e.target.value)}
                        placeholder="Cant."
                        className="w-24 rounded-lg px-3 py-2 text-sm outline-none text-center"
                        style={{
                          background: '#111827',
                          border: `1px solid ${errors[`item_${idx}`] ? '#ef4444' : sinStock ? '#f97316' : '#2d3748'}`,
                          color: '#e2e8f0',
                        }}
                      />
                      {form.items.length > 1 && (
                        <button type="button" onClick={() => removeItem(idx)}
                          className="w-8 h-8 flex items-center justify-center rounded-lg flex-shrink-0"
                          style={{ background: '#1e2432', color: '#f87171', border: '1px solid #2d3748' }}>
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                    {/* Stock disponible */}
                    {tipo && (
                      <div className="flex items-center gap-1.5 pl-3 text-[11px]">
                        <Package size={10} style={{ color: disponible > 0 ? '#34d399' : '#f87171' }} />
                        <span style={{ color: disponible > 0 ? '#34d399' : '#f87171' }}>
                          Disponible: {formatNumber(disponible)} cilindros
                        </span>
                        {sinStock && (
                          <span style={{ color: '#f97316' }}>— excede el stock</span>
                        )}
                      </div>
                    )}
                    {errors[`item_${idx}`] && <p className="pl-3 text-xs" style={{ color: '#f87171' }}>{errors[`item_${idx}`]}</p>}
                  </div>
                );
              })}
            </div>

            {errors.items && <p className="text-xs mt-1.5" style={{ color: '#f87171' }}>{errors.items}</p>}

            {previewTotal > 0 && (
              <div className="mt-2.5 flex justify-between items-center text-xs px-3 py-2 rounded-lg" style={{ background: '#111827' }}>
                <span style={{ color: '#4a5568' }}>Total a despachar</span>
                <span className="font-bold" style={{ color: '#fb923c' }}>{formatNumber(previewTotal)} cilindros</span>
              </div>
            )}
          </div>

          {/* Destino */}
          <div>
            <label className="block text-xs font-semibold mb-1.5" style={{ color: '#8892a4' }}>Destino *</label>
            <input type="text" value={form.destino}
              onChange={e => setForm(p => ({ ...p, destino: e.target.value }))}
              placeholder="Ej: Maipú — Distribuidora Los Almendros"
              className="w-full rounded-lg px-3 py-2.5 text-sm outline-none"
              style={{ background: '#111827', border: `1px solid ${errors.destino ? '#ef4444' : '#2d3748'}`, color: '#e2e8f0' }}
            />
            {errors.destino && <p className="text-xs mt-1" style={{ color: '#f87171' }}>{errors.destino}</p>}
          </div>

          {/* Observaciones */}
          <div>
            <label className="block text-xs font-semibold mb-1.5" style={{ color: '#8892a4' }}>Observaciones</label>
            <textarea rows={2} value={form.observaciones}
              onChange={e => setForm(p => ({ ...p, observaciones: e.target.value }))}
              placeholder="Notas adicionales..."
              className="w-full rounded-lg px-3 py-2.5 text-sm outline-none resize-none"
              style={{ background: '#111827', border: '1px solid #2d3748', color: '#e2e8f0' }}
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => setShowModal(false)}
              className="flex-1 py-2.5 rounded-lg text-sm font-medium"
              style={{ background: '#252b3b', color: '#94a3b8', border: '1px solid #2d3748' }}>
              Cancelar
            </button>
            <button type="submit" disabled={saving}
              className="flex-1 py-2.5 rounded-lg text-sm font-semibold text-white"
              style={{ background: '#ea580c', opacity: saving ? 0.7 : 1 }}>
              {saving ? 'Guardando...' : 'Crear Ficha'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
