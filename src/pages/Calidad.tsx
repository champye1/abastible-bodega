import { useState, useMemo } from 'react';
import { Plus, Filter, AlertTriangle } from 'lucide-react';
import Modal from '../components/Modal';
import StatusBadge from '../components/StatusBadge';
import { tiposGalon } from '../lib/mockData';
import { useApp } from '../lib/AppContext';
import { formatDateOnly, formatNumber, padFicha } from '../lib/utils';
import type { ControlCalidad } from '../lib/types';

type ResultadoFiltro = '' | 'aprobado' | 'con_observaciones' | 'rechazado';

function emptyForm() {
  return {
    tipo_galon_id: tiposGalon[0].id,
    muestras_tomadas: '',
    inspector: '',
    nota: '',
    resultado: 'aprobado' as ControlCalidad['resultado'],
    ficha_ingreso_id: '',
  };
}

export default function Calidad() {
  const { controlCalidad: records, fichasIngreso, addCalidad } = useApp();
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(emptyForm());
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [resultadoFilter, setResultadoFilter] = useState<ResultadoFiltro>('');

  const filtered = useMemo(
    () => records.filter(r => !resultadoFilter || r.resultado === resultadoFilter),
    [records, resultadoFilter],
  );

  function validate() {
    const e: Record<string, string> = {};
    if (!form.inspector.trim()) e.inspector = 'Requerido';
    if (!form.muestras_tomadas || parseInt(form.muestras_tomadas) <= 0)
      e.muestras_tomadas = 'Debe ser mayor a 0';
    return e;
  }

  function handleSubmit(ev: React.FormEvent) {
    ev.preventDefault();
    const e = validate();
    if (Object.keys(e).length) { setErrors(e); return; }
    setSaving(true);
    setTimeout(() => {
      const tipoGalon = tiposGalon.find(t => t.id === form.tipo_galon_id)!;
      const fichaIngreso = form.ficha_ingreso_id
        ? fichasIngreso.find(f => f.id === form.ficha_ingreso_id)
        : undefined;

      const nueva: ControlCalidad = {
        id: `q${Date.now()}`,
        numero_ficha: padFicha('CAL', records.length + 1),
        fecha_revision: new Date().toISOString().slice(0, 10),
        tipo_galon_id: form.tipo_galon_id,
        tipo_galon: tipoGalon,
        muestras_tomadas: parseInt(form.muestras_tomadas),
        inspector: form.inspector.trim(),
        nota: form.nota.trim(),
        resultado: form.resultado,
        ficha_ingreso_id: form.ficha_ingreso_id || null,
        ficha_ingreso: fichaIngreso,
        created_at: new Date().toISOString(),
      };

      // Si resultado es rechazado y hay ficha ingreso vinculada → marcar ingreso como rechazado
      const rechazarIngreso = form.resultado === 'rechazado' && !!form.ficha_ingreso_id;
      addCalidad(nueva, rechazarIngreso);
      setShowModal(false);
      setForm(emptyForm());
      setErrors({});
      setSaving(false);
    }, 500);
  }

  function openModal() { setForm(emptyForm()); setErrors({}); setShowModal(true); }

  const stats = useMemo(() => ({
    aprobado:          records.filter(r => r.resultado === 'aprobado').length,
    con_observaciones: records.filter(r => r.resultado === 'con_observaciones').length,
    rechazado:         records.filter(r => r.resultado === 'rechazado').length,
  }), [records]);

  // Ficha ingreso seleccionada en el form
  const fichaSeleccionada = useMemo(
    () => fichasIngreso.find(f => f.id === form.ficha_ingreso_id),
    [fichasIngreso, form.ficha_ingreso_id],
  );

  // Advertencia: la ficha ingreso vinculada ya fue rechazada
  const ingresoYaRechazado = fichaSeleccionada?.estado === 'rechazado';

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4 justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Control de Calidad</h1>
          <p className="text-sm mt-0.5" style={{ color: '#8892a4' }}>
            {records.length} revisión{records.length !== 1 ? 'es' : ''} totales
          </p>
        </div>
        <button
          onClick={openModal}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white transition-colors"
          style={{ background: '#ea580c' }}
          onMouseEnter={e => (e.currentTarget.style.background = '#c2410c')}
          onMouseLeave={e => (e.currentTarget.style.background = '#ea580c')}
        >
          <Plus size={16} /> Nueva Revisión
        </button>
      </div>

      {/* Summary pills */}
      <div className="flex flex-wrap gap-3">
        {[
          { label: 'Aprobados',         count: stats.aprobado,          bg: '#052e16', text: '#34d399' },
          { label: 'Con Observaciones', count: stats.con_observaciones,  bg: '#451a03', text: '#fbbf24' },
          { label: 'Rechazados',        count: stats.rechazado,          bg: '#450a0a', text: '#f87171' },
        ].map(({ label, count, bg, text }) => (
          <div key={label} className="flex items-center gap-2 px-4 py-2 rounded-lg" style={{ background: bg }}>
            <span className="text-xl font-bold" style={{ color: text }}>{count}</span>
            <span className="text-xs font-medium" style={{ color: text }}>{label}</span>
          </div>
        ))}
      </div>

      {/* Filter */}
      <div className="flex flex-wrap gap-3 p-4 rounded-xl"
        style={{ background: '#1e2432', border: '1px solid #2d3748' }}>
        <div className="flex items-center gap-2">
          <Filter size={15} style={{ color: '#4a5568' }} />
          <select value={resultadoFilter}
            onChange={e => setResultadoFilter(e.target.value as ResultadoFiltro)}
            className="bg-transparent text-sm outline-none border rounded px-2 py-1"
            style={{ color: '#e2e8f0', borderColor: '#2d3748', background: '#1e2432' }}>
            <option value="">Todos los resultados</option>
            <option value="aprobado">Aprobado</option>
            <option value="con_observaciones">Con Observaciones</option>
            <option value="rechazado">Rechazado</option>
          </select>
        </div>
        {resultadoFilter && (
          <button onClick={() => setResultadoFilter('')}
            className="text-xs px-3 py-1 rounded" style={{ color: '#f87171', background: '#450a0a' }}>
            Limpiar
          </button>
        )}
      </div>

      {/* Table */}
      <div className="rounded-xl overflow-hidden" style={{ background: '#1e2432', border: '1px solid #2d3748' }}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: '1px solid #2d3748', background: '#171c28' }}>
                {['N° Ficha', 'Fecha', 'Tipo Galón', 'Muestras', 'Inspector', 'Resultado', 'Ficha Ingreso', 'Nota'].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider"
                    style={{ color: '#4a5568' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-sm" style={{ color: '#4a5568' }}>
                    No se encontraron registros
                  </td>
                </tr>
              ) : filtered.map(r => (
                <tr key={r.id} style={{ borderBottom: '1px solid #1a1f2e' }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#252b3b')}
                  onMouseLeave={e => (e.currentTarget.style.background = '')}>
                  <td className="px-4 py-3 font-mono text-xs font-semibold" style={{ color: '#fb923c' }}>
                    {r.numero_ficha}
                  </td>
                  <td className="px-4 py-3 text-xs" style={{ color: '#8892a4' }}>
                    {formatDateOnly(r.fecha_revision + 'T00:00:00.000Z')}
                  </td>
                  <td className="px-4 py-3 text-sm" style={{ color: '#e2e8f0' }}>{r.tipo_galon?.nombre}</td>
                  <td className="px-4 py-3 text-sm font-medium text-white">{formatNumber(r.muestras_tomadas)}</td>
                  <td className="px-4 py-3 text-sm text-slate-300">{r.inspector}</td>
                  <td className="px-4 py-3"><StatusBadge estado={r.resultado} /></td>
                  <td className="px-4 py-3 font-mono text-xs"
                    style={{ color: r.ficha_ingreso_id ? '#60a5fa' : '#4a5568' }}>
                    {r.ficha_ingreso?.numero_ficha ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-xs max-w-[200px] truncate" style={{ color: '#8892a4' }}>
                    {r.nota || '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal nueva revisión */}
      <Modal open={showModal} onClose={() => setShowModal(false)} title="Nueva Revisión de Calidad">
        <form onSubmit={handleSubmit} className="space-y-4">

          {/* Tipo galón */}
          <div>
            <label className="block text-xs font-semibold mb-1.5" style={{ color: '#8892a4' }}>Tipo de Galón *</label>
            <select value={form.tipo_galon_id}
              onChange={e => setForm(p => ({ ...p, tipo_galon_id: e.target.value }))}
              className="w-full rounded-lg px-3 py-2.5 text-sm outline-none"
              style={{ background: '#111827', border: '1px solid #2d3748', color: '#e2e8f0' }}>
              {tiposGalon.map(t => (
                <option key={t.id} value={t.id}>{t.nombre} — {t.descripcion}</option>
              ))}
            </select>
          </div>

          {/* Muestras tomadas */}
          <div>
            <label className="block text-xs font-semibold mb-1.5" style={{ color: '#8892a4' }}>Muestras Tomadas *</label>
            <input type="number" min="1" value={form.muestras_tomadas}
              onChange={e => setForm(p => ({ ...p, muestras_tomadas: e.target.value }))}
              className="w-full rounded-lg px-3 py-2.5 text-sm outline-none"
              style={{ background: '#111827', border: `1px solid ${errors.muestras_tomadas ? '#ef4444' : '#2d3748'}`, color: '#e2e8f0' }}
            />
            {errors.muestras_tomadas && <p className="text-xs mt-1" style={{ color: '#f87171' }}>{errors.muestras_tomadas}</p>}
          </div>

          {/* Inspector */}
          <div>
            <label className="block text-xs font-semibold mb-1.5" style={{ color: '#8892a4' }}>Inspector *</label>
            <input type="text" value={form.inspector}
              onChange={e => setForm(p => ({ ...p, inspector: e.target.value }))}
              placeholder="Nombre del inspector"
              className="w-full rounded-lg px-3 py-2.5 text-sm outline-none"
              style={{ background: '#111827', border: `1px solid ${errors.inspector ? '#ef4444' : '#2d3748'}`, color: '#e2e8f0' }}
            />
            {errors.inspector && <p className="text-xs mt-1" style={{ color: '#f87171' }}>{errors.inspector}</p>}
          </div>

          {/* Resultado */}
          <div>
            <label className="block text-xs font-semibold mb-1.5" style={{ color: '#8892a4' }}>Resultado *</label>
            <div className="flex gap-2">
              {([
                { val: 'aprobado',          label: 'Aprobado',   bg: '#052e16', color: '#34d399' },
                { val: 'con_observaciones', label: 'Con Obs.',   bg: '#451a03', color: '#fbbf24' },
                { val: 'rechazado',         label: 'Rechazado',  bg: '#450a0a', color: '#f87171' },
              ] as const).map(opt => (
                <button key={opt.val} type="button"
                  onClick={() => setForm(p => ({ ...p, resultado: opt.val }))}
                  className="flex-1 py-2 rounded-lg text-xs font-semibold transition-all"
                  style={{
                    background: form.resultado === opt.val ? opt.bg : '#1e2432',
                    color: form.resultado === opt.val ? opt.color : '#4a5568',
                    border: `1px solid ${form.resultado === opt.val ? opt.color + '40' : '#2d3748'}`,
                  }}>
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Ficha Ingreso (opcional) */}
          <div>
            <label className="block text-xs font-semibold mb-1.5" style={{ color: '#8892a4' }}>
              Ficha de Ingreso Relacionada (opcional)
            </label>
            <select value={form.ficha_ingreso_id}
              onChange={e => setForm(p => ({ ...p, ficha_ingreso_id: e.target.value }))}
              className="w-full rounded-lg px-3 py-2.5 text-sm outline-none"
              style={{ background: '#111827', border: '1px solid #2d3748', color: '#e2e8f0' }}>
              <option value="">— Sin ficha relacionada —</option>
              {fichasIngreso.map(f => (
                <option key={f.id} value={f.id}>
                  {f.numero_ficha} — {f.proveedor.split(' — ')[0]} [{f.estado}]
                </option>
              ))}
            </select>

            {/* Advertencia: al rechazar, se propaga al ingreso */}
            {fichaSeleccionada && form.resultado === 'rechazado' && !ingresoYaRechazado && (
              <div className="mt-2 flex items-start gap-2 px-3 py-2.5 rounded-lg text-xs"
                style={{ background: '#3b0000', border: '1px solid #ef444440', color: '#fca5a5' }}>
                <AlertTriangle size={13} style={{ flexShrink: 0, marginTop: 1 }} />
                <span>
                  El ingreso <strong>{fichaSeleccionada.numero_ficha}</strong> será marcado automáticamente
                  como <strong>Rechazado</strong> al registrar esta revisión.
                </span>
              </div>
            )}

            {/* Info: ingreso ya rechazado */}
            {fichaSeleccionada && ingresoYaRechazado && (
              <div className="mt-2 flex items-start gap-2 px-3 py-2.5 rounded-lg text-xs"
                style={{ background: '#1e2432', border: '1px solid #2d3748', color: '#8892a4' }}>
                <AlertTriangle size={13} style={{ flexShrink: 0, marginTop: 1 }} />
                <span>Este ingreso ya está en estado <strong style={{ color: '#f87171' }}>Rechazado</strong>.</span>
              </div>
            )}
          </div>

          {/* Nota */}
          <div>
            <label className="block text-xs font-semibold mb-1.5" style={{ color: '#8892a4' }}>Nota</label>
            <textarea rows={3} value={form.nota}
              onChange={e => setForm(p => ({ ...p, nota: e.target.value }))}
              placeholder="Observaciones de la revisión..."
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
              {saving ? 'Guardando...' : 'Registrar Revisión'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
