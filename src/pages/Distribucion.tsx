import { useState, useEffect, useCallback } from 'react';
import { Truck, Lock, Unlock, FileDown, Plus, Trash2, ChevronRight } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// ── Tipos ──────────────────────────────────────────────────────────────────────
const TIPOS = ['45', '15', '11', '5', 'VM'] as const;
type Tipo = typeof TIPOS[number];
type Row  = Record<Tipo, number>;
type Seccion = 'llenos' | 'vacios';

function emptyRow(): Row { return { '45': 0, '15': 0, '11': 0, '5': 0, 'VM': 0 }; }

function sumaRows(rows: Row[]): Row {
  const r = emptyRow();
  for (const rr of rows) for (const t of TIPOS) r[t] += rr[t];
  return r;
}

function restaRows(a: Row, b: Row): Row {
  const r = emptyRow();
  for (const t of TIPOS) r[t] = a[t] - b[t];
  return r;
}

function sumaRowsAdd(a: Row, b: Row): Row {
  const r = emptyRow();
  for (const t of TIPOS) r[t] = a[t] + b[t];
  return r;
}

interface Conductor {
  id: string;
  nombre: string;
  llenos: Row;
  vacios: Row;
}

interface DiaDist {
  inicio_llenos: Row;
  inicio_vacios: Row;
  conductores: Conductor[];
  notas: string;
  cerrado: boolean;
  cerrado_at?: string;
}

function emptyDia(): DiaDist {
  return {
    inicio_llenos: emptyRow(),
    inicio_vacios: emptyRow(),
    conductores: [],
    notas: '', cerrado: false,
  };
}

// ── Cierre auto-calculado ──────────────────────────────────────────────────────
function calcCierre(dia: DiaDist): { llenos: Row; vacios: Row } {
  const totalLlenos = sumaRows(dia.conductores.map(c => c.llenos));
  const totalVacios = sumaRows(dia.conductores.map(c => c.vacios));
  return {
    llenos: restaRows(dia.inicio_llenos, totalLlenos),
    vacios: sumaRowsAdd(dia.inicio_vacios, totalVacios),
  };
}

// ── Storage ────────────────────────────────────────────────────────────────────
const STORAGE_KEY = 'abastible_distribucion_v1';

function isoToday() { return new Date().toISOString().slice(0, 10); }

function formatFecha(iso: string) {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

// Obtiene el Cierre del día anterior como Inicio del día actual
function getInicioFromPrev(allData: Record<string, DiaDist>, fecha: string): { llenos: Row; vacios: Row } | null {
  const prev = new Date(fecha);
  prev.setDate(prev.getDate() - 1);
  const prevIso = prev.toISOString().slice(0, 10);
  const prevDia = allData[prevIso];
  if (!prevDia) return null;
  return calcCierre(prevDia);
}

// ── Celda editable ─────────────────────────────────────────────────────────────
function Cell({ value, onChange, locked, muted = false }: {
  value: number; onChange: (v: number) => void; locked: boolean; muted?: boolean;
}) {
  const color = value < 0 ? '#f87171' : value > 0 ? (muted ? '#94a3b8' : '#e2e8f0') : '#3d4a5c';
  return (
    <td style={{ padding: '2px 3px', textAlign: 'center', borderRight: '1px solid #1e2432' }}>
      {locked ? (
        <span style={{ color, fontSize: 12 }}>{value !== 0 ? value : <span style={{ opacity: 0.2 }}>—</span>}</span>
      ) : (
        <input
          type="number"
          value={value === 0 ? '' : value}
          placeholder="—"
          onChange={e => onChange(parseInt(e.target.value) || 0)}
          style={{
            width: 44, background: 'transparent', border: 'none', outline: 'none',
            textAlign: 'center', color, fontSize: 12,
          }}
        />
      )}
    </td>
  );
}

// ── Fila readonly (Inicio / Cierre) ───────────────────────────────────────────
function SpecialRow({ label, row, bg, textColor, borderColor }: {
  label: string; row: Row; bg: string; textColor: string; borderColor: string;
}) {
  return (
    <tr style={{ background: bg, borderBottom: `2px solid ${borderColor}` }}>
      <td style={{ padding: '5px 10px', fontSize: 11, fontWeight: 800, color: textColor, borderRight: '1px solid #1e2432', whiteSpace: 'nowrap', minWidth: 120 }}>
        {label}
      </td>
      {TIPOS.map(t => (
        <td key={t} style={{ padding: '5px 3px', textAlign: 'center', fontSize: 12, fontWeight: 800, color: textColor, borderRight: '1px solid #1e2432', width: 52 }}>
          {row[t] !== 0 ? row[t] : <span style={{ opacity: 0.25 }}>—</span>}
        </td>
      ))}
    </tr>
  );
}

// ── PDF ────────────────────────────────────────────────────────────────────────
type RGB = [number, number, number];

function exportPDF(dia: DiaDist, fecha: string) {
  const doc  = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const W    = doc.internal.pageSize.getWidth();
  const cierre = calcCierre(dia);
  const val    = (n: number) => n !== 0 ? String(n) : '';
  const rVals  = (r: Row) => TIPOS.map(t => val(r[t]));

  const GREEN:  RGB = [198, 239, 206]; const GREEN_T:  RGB = [0, 97, 0];
  const BLUE:   RGB = [200, 220, 255]; const BLUE_T:   RGB = [0, 40, 120];
  const ORANGE: RGB = [252, 224, 200]; const ORANGE_T: RGB = [140, 56, 0];
  const WHITE:  RGB = [255, 255, 255]; const ALT: RGB = [248, 248, 248];

  // Header
  doc.setFillColor(249, 115, 22); doc.rect(0, 0, W, 2, 'F');
  doc.setFontSize(18); doc.setFont('helvetica', 'bold'); doc.setTextColor(249, 115, 22);
  doc.text('ABASTIBLE', 15, 18);
  doc.setFontSize(8); doc.setFont('helvetica', 'normal'); doc.setTextColor(130, 130, 130);
  doc.text('Bodega GLP  ·  Distribución Conductores', 15, 25);
  doc.setFontSize(12); doc.setFont('helvetica', 'bold'); doc.setTextColor(30, 30, 30);
  doc.text('DISTRIBUCIÓN CONDUCTORES', W - 15, 14, { align: 'right' });
  doc.setFontSize(11); doc.setFont('helvetica', 'bold'); doc.setTextColor(249, 115, 22);
  doc.text(formatFecha(fecha), W - 15, 24, { align: 'right' });
  doc.setDrawColor(220, 220, 220); doc.line(15, 30, W - 15, 30);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const makeBody = (seccion: Seccion): any[] => [
    [{ content: 'INICIO', styles: { fillColor: GREEN, textColor: GREEN_T, fontStyle: 'bold' } },
      ...rVals(seccion === 'llenos' ? dia.inicio_llenos : dia.inicio_vacios)
        .map(v => ({ content: v, styles: { fillColor: GREEN, textColor: GREEN_T, fontStyle: 'bold', halign: 'center' as const } }))],
    ...dia.conductores.map((c, i) => [
      c.nombre || '—',
      ...rVals(c[seccion]).map(v => ({ content: v, styles: { fillColor: i % 2 === 0 ? WHITE : ALT, halign: 'center' as const } })),
    ]),
    [{ content: 'CIERRE', styles: { fillColor: ORANGE, textColor: ORANGE_T, fontStyle: 'bold' } },
      ...rVals(cierre[seccion])
        .map(v => ({ content: v, styles: { fillColor: ORANGE, textColor: ORANGE_T, fontStyle: 'bold', halign: 'center' as const } }))],
  ];

  const cols = ['CONDUCTOR', ...TIPOS.map(t => t === 'VM' ? 'VM' : `${t}kg`)];
  const colStyles = {
    0: { cellWidth: 50 },
    1: { cellWidth: 22, halign: 'center' as const }, 2: { cellWidth: 22, halign: 'center' as const },
    3: { cellWidth: 22, halign: 'center' as const }, 4: { cellWidth: 22, halign: 'center' as const },
    5: { cellWidth: 18, halign: 'center' as const },
  };

  // Tabla LLENOS
  doc.setFontSize(11); doc.setFont('helvetica', 'bold'); doc.setTextColor(30, 140, 80);
  doc.text('LLENOS', 15, 37);
  autoTable(doc, {
    startY: 40, head: [cols], body: makeBody('llenos'),
    columnStyles: colStyles,
    headStyles: { fillColor: [220, 245, 225] as RGB, textColor: [0, 80, 40] as RGB, fontStyle: 'bold', halign: 'center' },
    margin: { left: 15, right: W / 2 + 5 },
    styles: { fontSize: 9, cellPadding: 3, lineColor: [210, 210, 210], lineWidth: 0.2 },
    theme: 'plain',
  });

  // Tabla VACÍOS (columna derecha)
  const startY = 40;
  doc.setFontSize(11); doc.setFont('helvetica', 'bold'); doc.setTextColor(60, 100, 200);
  doc.text('VACÍOS', W / 2 + 5, 37);
  autoTable(doc, {
    startY, head: [cols], body: makeBody('vacios'),
    columnStyles: colStyles,
    headStyles: { fillColor: BLUE, textColor: BLUE_T, fontStyle: 'bold', halign: 'center' },
    margin: { left: W / 2 + 5, right: 15 },
    styles: { fontSize: 9, cellPadding: 3, lineColor: [210, 210, 210], lineWidth: 0.2 },
    theme: 'plain',
  });

  if (dia.notas.trim()) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const finalY = Math.max((doc as any).lastAutoTable?.finalY ?? 100, 100) + 10;
    doc.setFontSize(8); doc.setFont('helvetica', 'bold'); doc.setTextColor(130, 130, 130);
    doc.text('OBSERVACIONES', 15, finalY);
    doc.setFont('helvetica', 'normal'); doc.setTextColor(35, 35, 35);
    doc.text(doc.splitTextToSize(dia.notas, W - 30), 15, finalY + 7);
  }

  doc.save(`distribucion_${fecha}.pdf`);
}

// ── Página ─────────────────────────────────────────────────────────────────────
export default function Distribucion() {
  const [fecha, setFecha]       = useState(isoToday());
  const [seccion, setSeccion]   = useState<Seccion>('llenos');
  const [confirmCerrar, setConfirmCerrar] = useState(false);

  const [allData, setAllData] = useState<Record<string, DiaDist>>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    } catch { /* ignore */ }
    return {};
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(allData));
  }, [allData]);

  // Si el día no existe, inicializarlo con el Cierre del día anterior
  useEffect(() => {
    if (!allData[fecha]) {
      const prev = getInicioFromPrev(allData, fecha);
      if (prev) {
        setAllData(d => ({
          ...d,
          [fecha]: { ...emptyDia(), inicio_llenos: prev.llenos, inicio_vacios: prev.vacios },
        }));
      }
    }
  }, [fecha, allData]);

  const dia    = allData[fecha] ?? emptyDia();
  const locked = dia.cerrado;
  const cierre = calcCierre(dia);

  // ── Callbacks ──────────────────────────────────────────────────────────────
  const updInicio = useCallback((sec: 'inicio_llenos' | 'inicio_vacios', tipo: Tipo, v: number) => {
    setAllData(prev => {
      const d = prev[fecha] ?? emptyDia();
      if (d.cerrado) return prev;
      return { ...prev, [fecha]: { ...d, [sec]: { ...(d[sec] as Row), [tipo]: v } } };
    });
  }, [fecha]);

  const updConductor = useCallback((id: string, sec: Seccion, tipo: Tipo, v: number) => {
    setAllData(prev => {
      const d = prev[fecha] ?? emptyDia();
      if (d.cerrado) return prev;
      return {
        ...prev, [fecha]: {
          ...d, conductores: d.conductores.map(c =>
            c.id === id ? { ...c, [sec]: { ...c[sec], [tipo]: v } } : c
          ),
        },
      };
    });
  }, [fecha]);

  const updNombre = useCallback((id: string, nombre: string) => {
    setAllData(prev => {
      const d = prev[fecha] ?? emptyDia();
      if (d.cerrado) return prev;
      return { ...prev, [fecha]: { ...d, conductores: d.conductores.map(c => c.id === id ? { ...c, nombre } : c) } };
    });
  }, [fecha]);

  const addConductor = useCallback(() => {
    setAllData(prev => {
      const d = prev[fecha] ?? emptyDia();
      if (d.cerrado) return prev;
      const nuevo: Conductor = { id: crypto.randomUUID(), nombre: '', llenos: emptyRow(), vacios: emptyRow() };
      return { ...prev, [fecha]: { ...d, conductores: [...d.conductores, nuevo] } };
    });
  }, [fecha]);

  const removeConductor = useCallback((id: string) => {
    setAllData(prev => {
      const d = prev[fecha] ?? emptyDia();
      if (d.cerrado) return prev;
      return { ...prev, [fecha]: { ...d, conductores: d.conductores.filter(c => c.id !== id) } };
    });
  }, [fecha]);

  const updNotas = useCallback((v: string) => {
    setAllData(prev => {
      const d = prev[fecha] ?? emptyDia();
      if (d.cerrado) return prev;
      return { ...prev, [fecha]: { ...d, notas: v } };
    });
  }, [fecha]);

  function cerrar() {
    const now = new Date().toLocaleTimeString('es-CL') + ' ' + formatFecha(fecha);
    setAllData(prev => ({ ...prev, [fecha]: { ...(prev[fecha] ?? emptyDia()), cerrado: true, cerrado_at: now } }));
    setConfirmCerrar(false);
  }

  const tabs = Array.from({ length: 5 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (4 - i));
    return d.toISOString().slice(0, 10);
  });

  const inicioKey: 'inicio_llenos' | 'inicio_vacios' = seccion === 'llenos' ? 'inicio_llenos' : 'inicio_vacios';
  const cierreRow = seccion === 'llenos' ? cierre.llenos : cierre.vacios;
  const inicioRow = seccion === 'llenos' ? dia.inicio_llenos : dia.inicio_vacios;

  return (
    <div style={{ maxWidth: 900, margin: '0 auto' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Truck size={20} style={{ color: '#f97316' }} />
          <h1 style={{ color: '#fff', fontSize: 18, fontWeight: 700, margin: 0 }}>Distribución Conductores</h1>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button onClick={() => exportPDF(dia, fecha)}
            style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#0f2318', color: '#4ade80', border: '1px solid #4ade8030', borderRadius: 6, padding: '5px 12px', fontSize: 12, cursor: 'pointer' }}>
            <FileDown size={13} /> PDF
          </button>
          {locked ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#f97316', fontSize: 12 }}>
              <Lock size={13} /> Cerrado {dia.cerrado_at}
            </div>
          ) : confirmCerrar ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ color: '#fbbf24', fontSize: 12 }}>¿Cerrar este día?</span>
              <button onClick={cerrar} style={{ background: '#dc2626', color: '#fff', border: 'none', borderRadius: 6, padding: '4px 12px', fontSize: 12, cursor: 'pointer' }}>Confirmar</button>
              <button onClick={() => setConfirmCerrar(false)} style={{ background: '#1e2432', color: '#94a3b8', border: 'none', borderRadius: 6, padding: '4px 10px', fontSize: 12, cursor: 'pointer' }}>Cancelar</button>
            </div>
          ) : (
            <button onClick={() => setConfirmCerrar(true)}
              style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#1e2432', color: '#94a3b8', border: '1px solid #2d3748', borderRadius: 6, padding: '5px 12px', fontSize: 12, cursor: 'pointer' }}>
              <Unlock size={13} /> Cerrar día
            </button>
          )}
        </div>
      </div>

      {/* Tabs fecha */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
        {tabs.map(t => {
          const active  = t === fecha;
          const cerrado = allData[t]?.cerrado;
          return (
            <button key={t} onClick={() => { setFecha(t); setConfirmCerrar(false); }} style={{
              padding: '4px 12px', borderRadius: 6, cursor: 'pointer', fontSize: 12,
              border: active ? '1px solid #f97316' : '1px solid #2d3748',
              background: active ? '#431407' : '#1e2432',
              color: active ? '#fb923c' : '#64748b',
              display: 'flex', alignItems: 'center', gap: 4,
            }}>
              {cerrado && <Lock size={10} />}{formatFecha(t)}
            </button>
          );
        })}
        <input type="date" value={fecha}
          onChange={e => { setFecha(e.target.value); setConfirmCerrar(false); }}
          style={{ marginLeft: 8, background: '#1e2432', border: '1px solid #2d3748', borderRadius: 6, color: '#94a3b8', fontSize: 12, padding: '4px 8px' }}
        />
      </div>

      {/* Tabs LLENOS / VACÍOS */}
      <div style={{ display: 'flex', gap: 2, marginBottom: 12 }}>
        {(['llenos', 'vacios'] as Seccion[]).map(s => {
          const active = s === seccion;
          const color  = s === 'llenos' ? '#4ade80' : '#60a5fa';
          const bg     = s === 'llenos' ? '#0a1f12' : '#0a1020';
          return (
            <button key={s} onClick={() => setSeccion(s)} style={{
              padding: '7px 22px', borderRadius: '8px 8px 0 0', cursor: 'pointer', fontSize: 13, fontWeight: 700,
              border: active ? `2px solid ${color}` : '2px solid #1e2432',
              borderBottom: active ? `2px solid ${active ? bg : '#0d1117'}` : '2px solid #1e2432',
              background: active ? bg : '#0a0d13',
              color: active ? color : '#475569',
              display: 'flex', alignItems: 'center', gap: 6,
            }}>
              {s === 'llenos' ? '● Llenos' : '○ Vacíos'}
              {active && <ChevronRight size={12} />}
            </button>
          );
        })}
      </div>

      {/* Tabla */}
      <div style={{ background: '#0d1117', borderRadius: '0 8px 8px 8px', border: `2px solid ${seccion === 'llenos' ? '#4ade8040' : '#60a5fa40'}`, overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#161b27', borderBottom: '2px solid #2d3748' }}>
              <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: 10, fontWeight: 700, color: '#475569', borderRight: '1px solid #1e2432', minWidth: 140, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                Conductor
              </th>
              {TIPOS.map(t => (
                <th key={t} style={{ padding: '8px 3px', fontSize: 11, fontWeight: 800, color: '#e2e8f0', textAlign: 'center', borderRight: '1px solid #1e2432', width: 52 }}>
                  {t === 'VM' ? 'VM' : `${t}kg`}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>

            {/* INICIO */}
            <SpecialRow
              label="INICIO"
              row={inicioRow}
              bg="#0f2318"
              textColor="#4ade80"
              borderColor="#1a3a24"
            />
            {/* Inicio editable si no hay datos de día anterior */}
            {!locked && (
              <tr style={{ background: '#0a150e' }}>
                <td style={{ padding: '2px 12px', fontSize: 10, color: '#2d5a40', borderRight: '1px solid #1e2432', fontStyle: 'italic' }}>
                  {getInicioFromPrev(allData, fecha) ? 'auto desde cierre anterior' : 'ingresar manualmente ↓'}
                </td>
                {TIPOS.map(t => (
                  <td key={t} style={{ padding: '2px 3px', borderRight: '1px solid #1e2432' }}>
                    <input
                      type="number"
                      value={inicioRow[t] === 0 ? '' : inicioRow[t]}
                      placeholder="—"
                      onChange={e => updInicio(inicioKey, t, parseInt(e.target.value) || 0)}
                      style={{ width: 44, background: 'transparent', border: 'none', borderBottom: '1px dashed #2d5a40', outline: 'none', textAlign: 'center', color: '#4ade8099', fontSize: 11 }}
                    />
                  </td>
                ))}
              </tr>
            )}

            {/* Conductores */}
            {dia.conductores.map((c, idx) => (
              <tr key={c.id} style={{ background: idx % 2 === 0 ? '#0d1117' : '#0a0d13', borderBottom: '1px solid #141820' }}>
                <td style={{ padding: '3px 8px', borderRight: '1px solid #1e2432' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <input
                      type="text" value={c.nombre} placeholder="Nombre conductor..."
                      readOnly={locked}
                      onChange={e => updNombre(c.id, e.target.value)}
                      style={{ flex: 1, background: 'transparent', border: 'none', borderBottom: '1px solid #2d3748', outline: 'none', color: '#e2e8f0', fontSize: 12, padding: '2px 4px' }}
                    />
                    {!locked && (
                      <button onClick={() => removeConductor(c.id)} style={{ color: '#4a5568', background: 'none', border: 'none', cursor: 'pointer', padding: 2, flexShrink: 0 }}>
                        <Trash2 size={11} />
                      </button>
                    )}
                  </div>
                </td>
                {TIPOS.map(t => (
                  <Cell key={t} value={c[seccion][t]} onChange={v => updConductor(c.id, seccion, t, v)} locked={locked} />
                ))}
              </tr>
            ))}

            {/* Agregar conductor */}
            {!locked && (
              <tr>
                <td colSpan={TIPOS.length + 1} style={{ padding: '6px 12px' }}>
                  <button onClick={addConductor} style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'none', border: '1px dashed #2d3748', borderRadius: 5, color: '#4a5568', fontSize: 11, padding: '4px 12px', cursor: 'pointer' }}>
                    <Plus size={11} /> Agregar conductor
                  </button>
                </td>
              </tr>
            )}

            {/* CIERRE (auto-calculado) */}
            <SpecialRow
              label={`CIERRE  ${seccion === 'llenos' ? '(inicio − vendido)' : '(inicio + devuelto)'}`}
              row={cierreRow}
              bg="#1a1200"
              textColor="#fb923c"
              borderColor="#3d2800"
            />

          </tbody>
        </table>
      </div>

      {/* Resumen rápido */}
      <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
        {TIPOS.map(t => {
          const inicio  = inicioRow[t];
          const movim   = sumaRows(dia.conductores.map(c => c[seccion]))[t];
          const cierreV = cierreRow[t];
          if (inicio === 0 && movim === 0) return null;
          return (
            <div key={t} style={{ background: '#0d1117', border: '1px solid #1e2432', borderRadius: 8, padding: '8px 14px', minWidth: 90, textAlign: 'center' }}>
              <div style={{ fontSize: 10, color: '#475569', marginBottom: 4 }}>{t === 'VM' ? 'VM' : `${t} kg`}</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: '#e2e8f0' }}>{cierreV}</div>
              <div style={{ fontSize: 10, color: '#4a5568', marginTop: 2 }}>
                {inicio} {seccion === 'llenos' ? '−' : '+'} {movim} = {cierreV}
              </div>
            </div>
          );
        })}
      </div>

      {/* Observaciones */}
      <div style={{ marginTop: 14 }}>
        <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6 }}>
          Observaciones
        </label>
        <textarea value={dia.notas} onChange={e => updNotas(e.target.value)}
          readOnly={locked} rows={3}
          placeholder="PCC: llegó camión con 306×15kg, 48×11kg...  |  Garantías: Germán debe 1×15kg..."
          style={{ width: '100%', background: '#0d1117', border: '1px solid #1e2432', borderRadius: 8, color: '#e2e8f0', fontSize: 13, padding: '10px 12px', resize: 'vertical', outline: 'none', boxSizing: 'border-box', fontFamily: 'monospace', lineHeight: 1.7, opacity: locked ? 0.6 : 1 }}
        />
      </div>
    </div>
  );
}
