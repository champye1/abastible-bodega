import { useState, useEffect, useCallback } from 'react';
import { Truck, Lock, Unlock, FileDown, Plus, Trash2 } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// ── Tipos ──────────────────────────────────────────────────────────────────────
const TIPOS = ['45', '15', '11', '5', 'VM'] as const;
type Tipo = typeof TIPOS[number];
type Row = Record<Tipo, number>;

function emptyRow(): Row { return { '45': 0, '15': 0, '11': 0, '5': 0, 'VM': 0 }; }
function sumaRows(rows: Row[]): Row {
  const r = emptyRow();
  for (const rr of rows) for (const t of TIPOS) r[t] += rr[t];
  return r;
}

interface Conductor {
  id: string;
  nombre: string;
  llenos: Row;
  vacios: Row;
}

interface DiaDist {
  cierre_llenos: Row;
  cierre_vacios: Row;
  conductores: Conductor[];
  notas: string;
  cerrado: boolean;
  cerrado_at?: string;
}

function emptyDia(): DiaDist {
  return {
    cierre_llenos: emptyRow(),
    cierre_vacios: emptyRow(),
    conductores: [],
    notas: '', cerrado: false,
  };
}

// ── Helpers ────────────────────────────────────────────────────────────────────
const STORAGE_KEY = 'abastible_distribucion_v1';
function isoToday() { return new Date().toISOString().slice(0, 10); }
function formatFecha(iso: string) {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

// ── Celda editable (acepta negativos) ─────────────────────────────────────────
function Cell({ value, onChange, locked, highlight = false }: {
  value: number; onChange: (v: number) => void; locked: boolean; highlight?: boolean;
}) {
  const color = value < 0 ? '#f87171' : value > 0 ? '#e2e8f0' : '#1e2432';
  return (
    <td style={{ padding: '2px 3px', textAlign: 'center', borderRight: '1px solid #1e2432', background: highlight ? '#0f2318' : undefined }}>
      {locked ? (
        <span style={{ color, fontSize: 12 }}>{value !== 0 ? value : '—'}</span>
      ) : (
        <input
          type="number"
          value={value === 0 ? '' : value}
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

// ── Fila de totales ────────────────────────────────────────────────────────────
function TotalRow({ label, llenos, vacios, bg, color }: {
  label: string; llenos: Row; vacios: Row; bg: string; color: string;
}) {
  return (
    <tr style={{ background: bg, borderBottom: '2px solid #0d1117' }}>
      <td style={{ padding: '5px 10px', fontSize: 11, fontWeight: 800, color, borderRight: '1px solid #1e2432', whiteSpace: 'nowrap' }}>{label}</td>
      {TIPOS.map(t => (
        <td key={`l-${t}`} style={{ padding: '5px 3px', textAlign: 'center', fontSize: 12, fontWeight: 800, color, borderRight: '1px solid #1e2432' }}>
          {llenos[t] !== 0 ? llenos[t] : <span style={{ opacity: 0.2 }}>—</span>}
        </td>
      ))}
      <td style={{ width: 1, background: '#2d3748', padding: 0 }} />
      {TIPOS.map(t => (
        <td key={`v-${t}`} style={{ padding: '5px 3px', textAlign: 'center', fontSize: 12, fontWeight: 800, color, borderRight: '1px solid #1e2432' }}>
          {vacios[t] !== 0 ? vacios[t] : <span style={{ opacity: 0.2 }}>—</span>}
        </td>
      ))}
    </tr>
  );
}

// ── PDF ────────────────────────────────────────────────────────────────────────
type RGB = [number, number, number];

function exportPDF(dia: DiaDist, fecha: string) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const W = doc.internal.pageSize.getWidth();

  doc.setFillColor(249, 115, 22); doc.rect(0, 0, W, 2, 'F');
  doc.setFontSize(18); doc.setFont('helvetica', 'bold'); doc.setTextColor(249, 115, 22);
  doc.text('ABASTIBLE', 15, 18);
  doc.setFontSize(8); doc.setFont('helvetica', 'normal'); doc.setTextColor(130, 130, 130);
  doc.text('Bodega GLP  ·  Planta Santiago', 15, 25);
  doc.setFontSize(12); doc.setFont('helvetica', 'bold'); doc.setTextColor(30, 30, 30);
  doc.text('DISTRIBUCIÓN CONDUCTORES', W - 15, 14, { align: 'right' });
  doc.setFontSize(11); doc.setFont('helvetica', 'bold'); doc.setTextColor(249, 115, 22);
  doc.text(formatFecha(fecha), W - 15, 24, { align: 'right' });
  doc.setDrawColor(220, 220, 220); doc.line(15, 30, W - 15, 30);

  const GREEN: RGB = [198, 239, 206]; const GREEN_T: RGB = [0, 97, 0];
  const ORANGE: RGB = [252, 224, 200]; const ORANGE_T: RGB = [140, 56, 0];
  const WHITE: RGB  = [255, 255, 255]; const ALT: RGB = [248, 248, 248];
  const GREY: RGB   = [235, 235, 235];

  const val = (n: number) => n !== 0 ? String(n) : '';
  const rVals = (r: Row) => TIPOS.map(t => val(r[t]));

  const head = [['CONDUCTOR', ...TIPOS.map(t => t === 'VM' ? 'VM' : `${t}kg`), '',
    ...TIPOS.map(t => t === 'VM' ? 'VM' : `${t}kg`)]];

  const totLlenos = sumaRows(dia.conductores.map(c => c.llenos));
  const totVacios = sumaRows(dia.conductores.map(c => c.vacios));

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const body: any[] = [
    // Cierre anterior
    [
      { content: 'CIERRE ANTERIOR', styles: { fillColor: GREEN, textColor: GREEN_T, fontStyle: 'bold' } },
      ...rVals(dia.cierre_llenos).map(v => ({ content: v, styles: { fillColor: GREEN, textColor: GREEN_T, fontStyle: 'bold', halign: 'center' } })),
      { content: '', styles: { fillColor: GREY } },
      ...rVals(dia.cierre_vacios).map(v => ({ content: v, styles: { fillColor: GREEN, textColor: GREEN_T, fontStyle: 'bold', halign: 'center' } })),
    ],
    // Conductores
    ...dia.conductores.map((c, i) => [
      c.nombre || '—',
      ...rVals(c.llenos).map(v => ({ content: v, styles: { fillColor: i % 2 === 0 ? WHITE : ALT, halign: 'center' as const } })),
      { content: '', styles: { fillColor: GREY } },
      ...rVals(c.vacios).map(v => ({ content: v, styles: { fillColor: i % 2 === 0 ? WHITE : ALT, halign: 'center' as const } })),
    ]),
    // Totales
    [
      { content: 'TOTAL', styles: { fillColor: ORANGE, textColor: ORANGE_T, fontStyle: 'bold' } },
      ...rVals(totLlenos).map(v => ({ content: v, styles: { fillColor: ORANGE, textColor: ORANGE_T, fontStyle: 'bold', halign: 'center' } })),
      { content: '', styles: { fillColor: GREY } },
      ...rVals(totVacios).map(v => ({ content: v, styles: { fillColor: ORANGE, textColor: ORANGE_T, fontStyle: 'bold', halign: 'center' } })),
    ],
  ];

  autoTable(doc, {
    startY: 34,
    head,
    body,
    columnStyles: {
      0: { cellWidth: 38 },
      1: { cellWidth: 18, halign: 'center' }, 2: { cellWidth: 18, halign: 'center' },
      3: { cellWidth: 18, halign: 'center' }, 4: { cellWidth: 18, halign: 'center' },
      5: { cellWidth: 14, halign: 'center' }, 6: { cellWidth: 6 },
      7: { cellWidth: 18, halign: 'center' }, 8: { cellWidth: 18, halign: 'center' },
      9: { cellWidth: 18, halign: 'center' }, 10: { cellWidth: 18, halign: 'center' },
      11: { cellWidth: 14, halign: 'center' },
    },
    headStyles: { fillColor: [235, 235, 235] as RGB, textColor: [50, 50, 50] as RGB, fontStyle: 'bold', halign: 'center' },
    margin: { left: 15, right: 15 },
    styles: { fontSize: 9, cellPadding: 3, lineColor: [210, 210, 210], lineWidth: 0.2 },
    theme: 'plain',
  });

  if (dia.notas.trim()) {
    const finalY = (doc as any).lastAutoTable?.finalY ?? 100;
    doc.setFontSize(8); doc.setFont('helvetica', 'bold'); doc.setTextColor(130, 130, 130);
    doc.text('OBSERVACIONES', 15, finalY + 10);
    doc.setFont('helvetica', 'normal'); doc.setTextColor(35, 35, 35);
    doc.text(doc.splitTextToSize(dia.notas, W - 30), 15, finalY + 17);
  }

  doc.save(`distribucion_${fecha}.pdf`);
}

// ── Página ─────────────────────────────────────────────────────────────────────
export default function Distribucion() {
  const [fecha, setFecha] = useState(isoToday());
  const [allData, setAllData] = useState<Record<string, DiaDist>>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    } catch { /* ignore */ }
    return {};
  });
  const [confirmCerrar, setConfirmCerrar] = useState(false);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(allData));
  }, [allData]);

  const dia    = allData[fecha] ?? emptyDia();
  const locked = dia.cerrado;

  // ── Callbacks ────────────────────────────────────────────────────────────────
  const updCierre = useCallback((seccion: 'cierre_llenos' | 'cierre_vacios', tipo: Tipo, v: number) => {
    setAllData(prev => {
      const d = prev[fecha] ?? emptyDia();
      if (d.cerrado) return prev;
      return { ...prev, [fecha]: { ...d, [seccion]: { ...(d[seccion] as Row), [tipo]: v } } };
    });
  }, [fecha]);

  const updConductor = useCallback((id: string, seccion: 'llenos' | 'vacios', tipo: Tipo, v: number) => {
    setAllData(prev => {
      const d = prev[fecha] ?? emptyDia();
      if (d.cerrado) return prev;
      return {
        ...prev, [fecha]: {
          ...d, conductores: d.conductores.map(c =>
            c.id === id ? { ...c, [seccion]: { ...c[seccion], [tipo]: v } } : c
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

  const totLlenos = sumaRows(dia.conductores.map(c => c.llenos));
  const totVacios = sumaRows(dia.conductores.map(c => c.vacios));

  const tabs = Array.from({ length: 5 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (4 - i));
    return d.toISOString().slice(0, 10);
  });

  // Encabezado de sección (llenos / vacíos)
  const SecHead = ({ label, color }: { label: string; color: string }) => (
    <th colSpan={TIPOS.length} style={{
      padding: '5px 8px', fontSize: 10, fontWeight: 800, color,
      textTransform: 'uppercase', letterSpacing: '0.1em', textAlign: 'center',
      borderRight: '1px solid #1e2432',
    }}>
      {label}
    </th>
  );

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Truck size={20} style={{ color: '#f97316' }} />
          <h1 style={{ color: '#fff', fontSize: 18, fontWeight: 700, margin: 0 }}>Distribución Conductores</h1>
          <span style={{ fontSize: 12, color: '#475569' }}>— Llenos / Vacíos por conductor</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button onClick={() => exportPDF(dia, fecha)}
            style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#0f2318', color: '#4ade80', border: '1px solid #4ade8030', borderRadius: 6, padding: '5px 12px', fontSize: 12, cursor: 'pointer' }}>
            <FileDown size={13} /> Exportar PDF
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

      {/* Tabs de fecha */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
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

      {/* Tabla principal */}
      <div style={{ background: '#0d1117', borderRadius: 10, border: '1px solid #1e2432', overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            {/* Fila de sección LLENOS / VACÍOS */}
            <tr style={{ background: '#0a0d13' }}>
              <th rowSpan={2} style={{ padding: '8px 12px', textAlign: 'left', fontSize: 10, fontWeight: 700, color: '#475569', borderRight: '1px solid #1e2432', minWidth: 130, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                Conductor
              </th>
              <SecHead label="Llenos" color="#4ade80" />
              <th style={{ width: 8, background: '#1e2432' }} rowSpan={2} />
              <SecHead label="Vacíos" color="#fb923c" />
            </tr>
            {/* Fila de tamaños */}
            <tr style={{ background: '#161b27', borderBottom: '2px solid #2d3748' }}>
              {[...TIPOS, ...TIPOS].map((t, i) => (
                <th key={i} style={{ padding: '5px 3px', fontSize: 11, fontWeight: 800, color: '#e2e8f0', textAlign: 'center', borderRight: '1px solid #1e2432', width: 52 }}>
                  {t === 'VM' ? 'VM' : `${t}kg`}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>

            {/* Fila: Cierre anterior */}
            <tr style={{ background: '#0f2318', borderBottom: '1px solid #1a2e1a' }}>
              <td style={{ padding: '5px 12px', fontSize: 11, fontWeight: 800, color: '#4ade80', borderRight: '1px solid #1e2432', whiteSpace: 'nowrap' }}>
                Cierre anterior
              </td>
              {TIPOS.map(t => <Cell key={`cl-${t}`} value={dia.cierre_llenos[t]} onChange={v => updCierre('cierre_llenos', t, v)} locked={locked} highlight />)}
              <td style={{ background: '#1e2432', width: 8 }} />
              {TIPOS.map(t => <Cell key={`cv-${t}`} value={dia.cierre_vacios[t]} onChange={v => updCierre('cierre_vacios', t, v)} locked={locked} highlight />)}
            </tr>

            {/* Filas de conductores */}
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
                      <button onClick={() => removeConductor(c.id)} style={{ color: '#4a5568', background: 'none', border: 'none', cursor: 'pointer', padding: 2 }}>
                        <Trash2 size={11} />
                      </button>
                    )}
                  </div>
                </td>
                {TIPOS.map(t => <Cell key={`l-${t}`} value={c.llenos[t]} onChange={v => updConductor(c.id, 'llenos', t, v)} locked={locked} />)}
                <td style={{ background: '#1e2432', width: 8 }} />
                {TIPOS.map(t => <Cell key={`v-${t}`} value={c.vacios[t]} onChange={v => updConductor(c.id, 'vacios', t, v)} locked={locked} />)}
              </tr>
            ))}

            {/* Botón agregar conductor */}
            {!locked && (
              <tr style={{ borderBottom: '1px solid #141820' }}>
                <td colSpan={TIPOS.length * 2 + 2} style={{ padding: '6px 12px' }}>
                  <button onClick={addConductor} style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'none', border: '1px dashed #2d3748', borderRadius: 5, color: '#4a5568', fontSize: 11, padding: '4px 12px', cursor: 'pointer' }}>
                    <Plus size={11} /> Agregar conductor
                  </button>
                </td>
              </tr>
            )}

            {/* Fila total */}
            <TotalRow label="TOTAL" llenos={totLlenos} vacios={totVacios} bg="#1a1200" color="#fb923c" />

          </tbody>
        </table>
      </div>

      {/* Observaciones */}
      <div style={{ marginTop: 14 }}>
        <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6 }}>
          Observaciones
        </label>
        <textarea value={dia.notas} onChange={e => updNotas(e.target.value)}
          readOnly={locked} rows={3}
          placeholder="PCC: llegó camión con 306x15, 48x11..."
          style={{ width: '100%', background: '#0d1117', border: '1px solid #1e2432', borderRadius: 8, color: '#e2e8f0', fontSize: 13, padding: '10px 12px', resize: 'vertical', outline: 'none', boxSizing: 'border-box', fontFamily: 'monospace', lineHeight: 1.7, opacity: locked ? 0.6 : 1 }}
        />
      </div>

    </div>
  );
}
