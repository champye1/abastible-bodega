import { useState, useEffect, useCallback } from 'react';
import { Lock, Unlock, Boxes, FileDown, Plus, Trash2 } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// ── Tipos ──────────────────────────────────────────────────────────────────────
const TIPOS = ['45', '11', '5', '15', 'VM'] as const;
type Tipo = typeof TIPOS[number];
type Row = Record<Tipo, number>;

function row(v45: number, v11: number, v5: number, v15: number, vVM = 0): Row {
  return { '45': v45, '11': v11, '5': v5, '15': v15, 'VM': vVM };
}
function emptyRow(): Row { return row(0, 0, 0, 0, 0); }

interface FilaPersona {
  id: string;
  nombre: string;
  valores: Row;
}

interface DiaData {
  // TOTAL NETO
  neto_defecto:  Row;
  neto_bodega:   Row;
  neto_piso:     Row;
  neto_venta:    Row;
  // TOTAL CATALÍTICO
  cata_defecto:  Row;
  cata_bodega:   Row;
  cata_piso:     Row;
  cata_venta:    Row;
  // TOTAL VACÍOS
  v_abastible:   Row;
  v_lipigas:     Row;
  v_gasco:       Row;
  v_cocina:      Row;
  v_piso45:      Row;
  v_prestado:    Row;
  v_deben:       Row;
  v_personas:    FilaPersona[];
  // TRÁNSITO
  trans_normal:  Row;
  trans_cata:    Row;
  notas: string;
  cerrado: boolean;
  cerrado_at?: string;
}

function emptyDia(): DiaData {
  return {
    neto_defecto: emptyRow(), neto_bodega: emptyRow(),
    neto_piso:    emptyRow(), neto_venta:  emptyRow(),
    cata_defecto: emptyRow(), cata_bodega: emptyRow(),
    cata_piso:    emptyRow(), cata_venta:  emptyRow(),
    v_abastible:  emptyRow(), v_lipigas:   emptyRow(),
    v_gasco:      emptyRow(), v_cocina:    emptyRow(),
    v_piso45:     emptyRow(), v_prestado:  emptyRow(),
    v_deben:      emptyRow(), v_personas:  [],
    trans_normal: emptyRow(),
    trans_cata:   emptyRow(), notas: '', cerrado: false,
  };
}

// ── Datos de ejemplo ───────────────────────────────────────────────────────────
function mockDia(offset: number, cerrado: boolean): DiaData {
  const seed = offset % 3;
  const dias: DiaData[] = [
    // Día base — números del formulario físico
    // TOTAL VACÍOS → 11, 284, 95, 48, 23 ✓
    {
      neto_defecto:  row(0,  15,  0,   0,  0),
      neto_bodega:   row(27, 449, 63, 330, 50),
      neto_piso:     row(5,  86,  10,  58, 21),
      neto_venta:    row(0,  0,   0,   0,  0),
      cata_defecto:  row(0,  2,   0,   0,  0),
      cata_bodega:   row(3,  20,  10,  25,  0),
      cata_piso:     row(0,  5,   4,   3,   0),
      cata_venta:    row(0,  0,   0,   0,   0),
      v_abastible:   row(0, 269,  2,   8,  23),
      v_lipigas:     row(0,   0, 93,  21,   0),
      v_gasco:       row(0,  10,  0,  18,   0),
      v_cocina:      row(0,   3,  0,   1,   0),
      v_piso45:      row(9,   0,  0,   0,   0),
      v_prestado:    row(2,   2,  0,   0,   0),
      v_deben:       row(0,   5,  3,   0,   0),
      v_personas:    [{ id: '1', nombre: 'Patricia', valores: row(2, 0, 1, 0, 0) }],
      trans_normal:  row(20, 240, 40, 110,  4),
      trans_cata:    row(4,  55,  7,   24,  0),
      notas: 'Patricia: 2x45, 1x5 — pendiente devolución',
      cerrado,
      cerrado_at: cerrado ? '18:30 23/07/2026' : undefined,
    },
    // Día alternativo A
    {
      neto_defecto:  row(0,  12,  0,   0,  0),
      neto_bodega:   row(30, 460, 58, 345, 48),
      neto_piso:     row(4,  90,  12,  62, 18),
      neto_venta:    row(0,  0,   0,   0,  0),
      cata_defecto:  row(0,  1,   0,   0,  0),
      cata_bodega:   row(4,  22,  9,   28,  0),
      cata_piso:     row(0,  6,   3,   4,   0),
      cata_venta:    row(0,  0,   0,   0,   0),
      v_abastible:   row(0, 255,  0,  10,  20),
      v_lipigas:     row(0,   0, 88,  18,   0),
      v_gasco:       row(0,   8,  0,  15,   0),
      v_cocina:      row(0,   2,  0,   0,   0),
      v_piso45:      row(8,   0,  0,   0,   0),
      v_prestado:    row(1,   0,  0,   5,   0),
      v_deben:       row(0,   3,  0,   0,   0),
      v_personas:    [],
      trans_normal:  row(22, 248, 38, 115,  3),
      trans_cata:    row(3,  52,  6,   22,  0),
      notas: 'Mauricio: 1x45, 5x15\nEntrada PCC: 200x11 / 100x15',
      cerrado,
      cerrado_at: cerrado ? '18:15' : undefined,
    },
    // Día alternativo B
    {
      neto_defecto:  row(0,  18,  2,   0,  0),
      neto_bodega:   row(25, 430, 70, 310, 55),
      neto_piso:     row(6,  80,  8,   55, 22),
      neto_venta:    row(0,  0,   0,   0,  0),
      cata_defecto:  row(0,  3,   0,   0,  0),
      cata_bodega:   row(2,  18,  12,  22,  0),
      cata_piso:     row(0,  4,   5,   2,   0),
      cata_venta:    row(0,  0,   0,   0,   0),
      v_abastible:   row(0, 260,  0,   9,  18),
      v_lipigas:     row(0,   0, 90,  20,   0),
      v_gasco:       row(0,  12,  0,  17,   0),
      v_cocina:      row(0,   1,  0,   1,   0),
      v_piso45:      row(10,  0,  0,   0,   0),
      v_prestado:    row(0,   4,  2,   1,   0),
      v_deben:       row(0,   2,  1,   0,   0),
      v_personas:    [{ id: '2', nombre: 'DH', valores: row(0, 4, 2, 1, 0) }],
      trans_normal:  row(18, 230, 42, 105,  5),
      trans_cata:    row(5,  58,  8,   26,  0),
      notas: 'DH: 4x11, 2x5, 1x15 — revisar devolución\nCamión PCC llegó 14:20 con 300x11 / 80x15\nDefecto: 2x11 con válvula dañada, separados en bodega',
      cerrado,
      cerrado_at: cerrado ? '18:00' : undefined,
    },
  ];
  return dias[seed];
}

function buildInitialData(): Record<string, DiaData> {
  const data: Record<string, DiaData> = {};
  for (let i = 4; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const iso = d.toISOString().slice(0, 10);
    data[iso] = mockDia(i, i > 0);
  }
  return data;
}

// ── Utilidades ─────────────────────────────────────────────────────────────────
const STORAGE_KEY = 'abastible_inventario_v6';

function isoToday(): string { return new Date().toISOString().slice(0, 10); }

function formatFecha(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

function sumaRows(rows: Row[]): Row {
  const r = emptyRow();
  for (const rr of rows) for (const t of TIPOS) r[t] += rr[t];
  return r;
}

// ── Celda editable ─────────────────────────────────────────────────────────────
function Cell({ value, onChange, locked }: { value: number; onChange: (v: number) => void; locked: boolean }) {
  return (
    <td style={{ padding: '2px 4px', textAlign: 'center', borderRight: '1px solid #1e2432' }}>
      {locked ? (
        <span style={{ color: value > 0 ? '#e2e8f0' : '#1e2432', fontSize: 13 }}>{value || '—'}</span>
      ) : (
        <input
          type="number" min={0}
          value={value === 0 ? '' : value}
          onChange={e => onChange(Math.max(0, parseInt(e.target.value) || 0))}
          style={{ width: 52, background: 'transparent', border: 'none', outline: 'none', textAlign: 'center', color: '#e2e8f0', fontSize: 13 }}
        />
      )}
    </td>
  );
}

function DataRow({ label, row, onChange, locked }: {
  label: string; row: Row;
  onChange: (t: Tipo, v: number) => void; locked: boolean;
}) {
  return (
    <tr style={{ borderBottom: '1px solid #141820' }}>
      <td style={{ padding: '3px 12px', fontSize: 12, color: '#94a3b8', borderRight: '1px solid #1e2432' }}>{label}</td>
      {TIPOS.map(t => <Cell key={t} value={row[t]} onChange={v => onChange(t, v)} locked={locked} />)}
    </tr>
  );
}

function TotalRow({ label, row, bg, color }: { label: string; row: Row; bg: string; color: string }) {
  return (
    <tr style={{ background: bg, borderBottom: '2px solid #0d1117' }}>
      <td style={{ padding: '5px 12px', fontSize: 11, fontWeight: 800, color, borderRight: '1px solid #1e2432', letterSpacing: '0.06em', textTransform: 'uppercase' }}>{label}</td>
      {TIPOS.map(t => (
        <td key={t} style={{ padding: '5px 4px', textAlign: 'center', fontSize: 13, fontWeight: 800, color, borderRight: '1px solid #1e2432' }}>
          {row[t] > 0 ? row[t] : <span style={{ color: '#1e2432', fontWeight: 400, fontSize: 11 }}>—</span>}
        </td>
      ))}
    </tr>
  );
}

function SectionHead({ label, bg, color }: { label: string; bg: string; color: string }) {
  return (
    <tr style={{ background: bg }}>
      <td colSpan={TIPOS.length + 1} style={{ padding: '5px 12px', fontSize: 10, fontWeight: 800, letterSpacing: '0.12em', color, textTransform: 'uppercase' }}>
        {label}
      </td>
    </tr>
  );
}

// ── Exportar PDF ───────────────────────────────────────────────────────────────
type RGB = [number, number, number];

function exportPDF(dia: DiaData, fecha: string) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const W = doc.internal.pageSize.getWidth();

  const tNeto     = sumaRows([dia.neto_defecto, dia.neto_bodega, dia.neto_piso, dia.neto_venta]);
  const tCata     = sumaRows([dia.cata_defecto, dia.cata_bodega, dia.cata_piso, dia.cata_venta]);
  const tVacios   = sumaRows([dia.v_abastible, dia.v_lipigas, dia.v_gasco, dia.v_cocina, dia.v_piso45, dia.v_prestado, dia.v_deben, ...dia.v_personas.map(p => p.valores)]);
  const tTransito = sumaRows([dia.trans_normal, dia.trans_cata]);
  doc.setFillColor(249, 115, 22);
  doc.rect(0, 0, W, 2, 'F');

  doc.setFontSize(20); doc.setFont('helvetica', 'bold'); doc.setTextColor(249, 115, 22);
  doc.text('ABASTIBLE', 15, 20);
  doc.setFontSize(8.5); doc.setFont('helvetica', 'normal'); doc.setTextColor(130, 130, 130);
  doc.text('Bodega GLP  ·  Planta Santiago  ·  Pudahuel, RM', 15, 27);

  doc.setFontSize(13); doc.setFont('helvetica', 'bold'); doc.setTextColor(30, 30, 30);
  doc.text('INVENTARIO DE CILINDROS', W - 15, 17, { align: 'right' });
  doc.setFontSize(9); doc.setFont('helvetica', 'normal'); doc.setTextColor(130, 130, 130);
  doc.text('Planta / Oficina de Ventas', W - 15, 23, { align: 'right' });
  doc.setFontSize(11); doc.setFont('helvetica', 'bold'); doc.setTextColor(249, 115, 22);
  doc.text(formatFecha(fecha), W - 15, 30, { align: 'right' });

  doc.setDrawColor(220, 220, 220);
  doc.line(15, 34, W - 15, 34);

  const val = (n: number) => n > 0 ? String(n) : '';
  const rVals = (r: Row) => TIPOS.map(t => val(r[t]));

  const GREEN_BG:  RGB = [198, 239, 206]; const GREEN_TXT:  RGB = [0, 97, 0];
  const BLUE_BG:   RGB = [189, 215, 238]; const BLUE_TXT:   RGB = [0, 70, 127];
  const ORANGE_BG: RGB = [252, 224, 200]; const ORANGE_TXT: RGB = [140, 56, 0];
  const PURPLE_BG: RGB = [225, 205, 240]; const PURPLE_TXT: RGB = [70, 25, 125];
  const WHITE:     RGB = [255, 255, 255];
  const ALT:       RGB = [248, 248, 248];

  const sec = (lbl: string, bg: RGB, txt: RGB) => [{ content: lbl, colSpan: 6, styles: { fillColor: bg, textColor: txt, fontStyle: 'bold' as const, fontSize: 8.5, cellPadding: 3 } }];

  const dRow = (lbl: string, r: Row, alt = false) =>
    [lbl, ...rVals(r)].map((v, i) => ({ content: v, styles: { fillColor: alt ? ALT : WHITE, textColor: [35, 35, 35] as RGB, halign: (i === 0 ? 'left' : 'center') as 'left' | 'center', fontSize: 9 } }));

  const tRow = (lbl: string, r: Row, bg: RGB, txt: RGB) =>
    [lbl, ...rVals(r)].map((v, i) => ({ content: v, styles: { fillColor: bg, textColor: txt, fontStyle: 'bold' as const, halign: (i === 0 ? 'left' : 'center') as 'left' | 'center', fontSize: 9.5 } }));

  let endY = 38;
  autoTable(doc, {
    startY: 38,
    head: [[
      { content: 'ENTRADA / SALIDA', styles: { halign: 'left', fillColor: [235,235,235] as RGB, textColor: [50,50,50] as RGB, fontStyle: 'bold' as const } },
      ...['45 kg','11 kg','5 kg','15 kg','VM'].map(t => ({ content: t, styles: { halign: 'center' as const, fillColor: [235,235,235] as RGB, textColor: [50,50,50] as RGB, fontStyle: 'bold' as const } })),
    ]],
    body: [
      sec('TOTAL NETO', GREEN_BG, GREEN_TXT),
      dRow('Defecto',     dia.neto_defecto),
      dRow('Bodega',      dia.neto_bodega, true),
      dRow('Piso',        dia.neto_piso),
      dRow('Venta Local', dia.neto_venta, true),
      tRow('TOTAL NETO', tNeto, GREEN_BG, GREEN_TXT),

      sec('TOTAL CATALÍTICO', BLUE_BG, BLUE_TXT),
      dRow('Defecto',     dia.cata_defecto),
      dRow('Bodega',      dia.cata_bodega, true),
      dRow('Piso',        dia.cata_piso),
      dRow('Venta Local', dia.cata_venta, true),
      tRow('TOTAL CATALÍTICOS', tCata, BLUE_BG, BLUE_TXT),

      sec('TOTAL VACÍOS', ORANGE_BG, ORANGE_TXT),
      dRow('Abastible', dia.v_abastible),
      dRow('Lipigas',   dia.v_lipigas,  true),
      dRow('Gasco',     dia.v_gasco),
      dRow('Cocina',    dia.v_cocina,   true),
      dRow('Piso 45',   dia.v_piso45),
      dRow('Prestado',  dia.v_prestado, true),
      dRow('Deben',     dia.v_deben),
      ...dia.v_personas.map((p, i) => dRow(p.nombre || 'Persona', p.valores, i % 2 === 0)),
      tRow('TOTAL VACÍOS', tVacios, ORANGE_BG, ORANGE_TXT),

      sec('TRÁNSITO', PURPLE_BG, PURPLE_TXT),
      dRow('Tránsito Normal', dia.trans_normal),
      dRow('Tránsito Cata',   dia.trans_cata, true),
      tRow('TOTAL TRÁNSITO', tTransito, PURPLE_BG, PURPLE_TXT),
    ],
    columnStyles: {
      0: { cellWidth: 60 },
      1: { cellWidth: 25, halign: 'center' },
      2: { cellWidth: 25, halign: 'center' },
      3: { cellWidth: 25, halign: 'center' },
      4: { cellWidth: 25, halign: 'center' },
      5: { cellWidth: 25, halign: 'center' },
    },
    margin: { left: 15, right: 15 },
    styles: { fontSize: 9, cellPadding: 2.5, lineColor: [210, 210, 210], lineWidth: 0.2 },
    headStyles: { fontStyle: 'bold', fontSize: 9, cellPadding: 3.5 },
    theme: 'plain',
    didDrawPage: (data) => { endY = data.cursor?.y ?? endY; },
  });

  // Observaciones
  const notaY = endY + 10;
  const lineas = dia.notas.trim() ? doc.splitTextToSize(dia.notas.trim(), W - 44) : ['—'];
  const boxH = 10 + lineas.length * 5.8 + 6;
  doc.setFillColor(248, 249, 250); doc.setDrawColor(200, 200, 200);
  doc.roundedRect(15, notaY, W - 30, boxH, 3, 3, 'FD');
  doc.setFontSize(7.5); doc.setFont('helvetica', 'bold'); doc.setTextColor(130, 130, 130);
  doc.text('OBSERVACIONES / PRESTADOS', 21, notaY + 7);
  doc.setDrawColor(210, 210, 210); doc.line(21, notaY + 9.5, W - 21, notaY + 9.5);
  doc.setFontSize(10); doc.setFont('helvetica', 'normal'); doc.setTextColor(35, 35, 35);
  doc.text(lineas, 21, notaY + 16);

  // Pie
  const pH = doc.internal.pageSize.getHeight();
  doc.setDrawColor(220, 220, 220); doc.line(15, pH - 13, W - 15, pH - 13);
  doc.setFontSize(7.5); doc.setFont('helvetica', 'normal'); doc.setTextColor(160, 160, 160);
  doc.text(`Generado el ${new Date().toLocaleString('es-CL')}  ·  Abastible S.A.`, 15, pH - 7);
  doc.text('Sistema Bodega v1.0', W - 15, pH - 7, { align: 'right' });

  doc.save(`inventario_${fecha}.pdf`);
}

// ── Página ─────────────────────────────────────────────────────────────────────
export default function Inventario() {
  const [fecha, setFecha] = useState(isoToday());
  const [allData, setAllData] = useState<Record<string, DiaData>>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    } catch { /* ignore */ }
    return buildInitialData();
  });
  const [confirmCerrar, setConfirmCerrar] = useState(false);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(allData));
  }, [allData]);

  const dia = allData[fecha] ?? emptyDia();
  const locked = dia.cerrado;

  const upd = useCallback((field: keyof DiaData, tipo: Tipo, value: number) => {
    setAllData(prev => {
      const d = prev[fecha] ?? emptyDia();
      if (d.cerrado) return prev;
      return { ...prev, [fecha]: { ...d, [field]: { ...(d[field] as Row), [tipo]: value } } };
    });
  }, [fecha]);

  const updPersonaValor = useCallback((id: string, tipo: Tipo, value: number) => {
    setAllData(prev => {
      const d = prev[fecha] ?? emptyDia();
      if (d.cerrado) return prev;
      return { ...prev, [fecha]: { ...d, v_personas: d.v_personas.map(p => p.id === id ? { ...p, valores: { ...p.valores, [tipo]: value } } : p) } };
    });
  }, [fecha]);

  const updPersonaNombre = useCallback((id: string, nombre: string) => {
    setAllData(prev => {
      const d = prev[fecha] ?? emptyDia();
      if (d.cerrado) return prev;
      return { ...prev, [fecha]: { ...d, v_personas: d.v_personas.map(p => p.id === id ? { ...p, nombre } : p) } };
    });
  }, [fecha]);

  const addPersona = useCallback(() => {
    setAllData(prev => {
      const d = prev[fecha] ?? emptyDia();
      if (d.cerrado) return prev;
      const newP: FilaPersona = { id: crypto.randomUUID(), nombre: '', valores: emptyRow() };
      return { ...prev, [fecha]: { ...d, v_personas: [...d.v_personas, newP] } };
    });
  }, [fecha]);

  const removePersona = useCallback((id: string) => {
    setAllData(prev => {
      const d = prev[fecha] ?? emptyDia();
      if (d.cerrado) return prev;
      return { ...prev, [fecha]: { ...d, v_personas: d.v_personas.filter(p => p.id !== id) } };
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

  const totalNeto     = sumaRows([dia.neto_defecto, dia.neto_bodega, dia.neto_piso, dia.neto_venta]);
  const totalCata     = sumaRows([dia.cata_defecto, dia.cata_bodega, dia.cata_piso, dia.cata_venta]);
  const totalVacios   = sumaRows([dia.v_abastible, dia.v_lipigas, dia.v_gasco, dia.v_cocina, dia.v_piso45, dia.v_prestado, dia.v_deben, ...dia.v_personas.map(p => p.valores)]);
  const totalTransito = sumaRows([dia.trans_normal, dia.trans_cata]);

  const tabs = Array.from({ length: 5 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (4 - i));
    return d.toISOString().slice(0, 10);
  });

  return (
    <div style={{ maxWidth: 860, margin: '0 auto' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Boxes size={20} style={{ color: '#f97316' }} />
          <h1 style={{ color: '#fff', fontSize: 18, fontWeight: 700, margin: 0 }}>Inventario de Cilindros</h1>
          <span style={{ fontSize: 12, color: '#475569' }}>— Planta / Oficina de Ventas</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button onClick={() => exportPDF(dia, fecha)}
            style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#0f2318', color: '#4ade80', border: '1px solid #4ade8030', borderRadius: 6, padding: '5px 12px', fontSize: 12, cursor: 'pointer' }}>
            <FileDown size={13} /> Exportar PDF
          </button>
          {locked ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#f97316', fontSize: 12 }}>
              <Lock size={13} /><span>Cerrado {dia.cerrado_at}</span>
            </div>
          ) : confirmCerrar ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ color: '#fbbf24', fontSize: 12 }}>¿Cerrar y bloquear este día?</span>
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

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        {tabs.map(t => {
          const cerrado = allData[t]?.cerrado;
          const active = t === fecha;
          return (
            <button key={t} onClick={() => { setFecha(t); setConfirmCerrar(false); }} style={{
              padding: '4px 12px', borderRadius: 6, cursor: 'pointer',
              border: active ? '1px solid #f97316' : '1px solid #2d3748',
              background: active ? '#431407' : '#1e2432',
              color: active ? '#fb923c' : '#64748b',
              fontSize: 12, display: 'flex', alignItems: 'center', gap: 4,
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

      {/* Tabla */}
      <div style={{ background: '#0d1117', borderRadius: 10, border: '1px solid #1e2432', overflow: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#161b27', borderBottom: '2px solid #2d3748' }}>
              <th style={{ padding: '8px 12px', fontSize: 10, fontWeight: 700, color: '#475569', textAlign: 'left', borderRight: '1px solid #1e2432', width: 165, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                Entrada / Salida
              </th>
              {TIPOS.map(t => (
                <th key={t} style={{ padding: '8px 4px', fontSize: 12, fontWeight: 800, color: '#e2e8f0', textAlign: 'center', borderRight: '1px solid #1e2432', width: 64 }}>
                  {t === 'VM' ? 'VM' : `${t} kg`}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>

            <SectionHead label="Total Neto" bg="#0f2318" color="#4ade80" />
            <DataRow label="Defecto"     row={dia.neto_defecto} onChange={(t,v)=>upd('neto_defecto',t,v)} locked={locked} />
            <DataRow label="Bodega"      row={dia.neto_bodega}  onChange={(t,v)=>upd('neto_bodega',t,v)}  locked={locked} />
            <DataRow label="Piso"        row={dia.neto_piso}    onChange={(t,v)=>upd('neto_piso',t,v)}    locked={locked} />
            <DataRow label="Venta Local" row={dia.neto_venta}   onChange={(t,v)=>upd('neto_venta',t,v)}   locked={locked} />
            <TotalRow label="Total Neto" row={totalNeto} bg="#0f2318" color="#4ade80" />

            <SectionHead label="Total Catalítico" bg="#0f1e38" color="#60a5fa" />
            <DataRow label="Defecto"     row={dia.cata_defecto} onChange={(t,v)=>upd('cata_defecto',t,v)} locked={locked} />
            <DataRow label="Bodega"      row={dia.cata_bodega}  onChange={(t,v)=>upd('cata_bodega',t,v)}  locked={locked} />
            <DataRow label="Piso"        row={dia.cata_piso}    onChange={(t,v)=>upd('cata_piso',t,v)}    locked={locked} />
            <DataRow label="Venta Local" row={dia.cata_venta}   onChange={(t,v)=>upd('cata_venta',t,v)}   locked={locked} />
            <TotalRow label="Total Catalíticos" row={totalCata} bg="#0f1e38" color="#60a5fa" />

            <SectionHead label="Total Vacíos" bg="#2a1200" color="#fb923c" />
            <DataRow label="Abastible" row={dia.v_abastible} onChange={(t,v)=>upd('v_abastible',t,v)} locked={locked} />
            <DataRow label="Lipigas"   row={dia.v_lipigas}   onChange={(t,v)=>upd('v_lipigas',t,v)}   locked={locked} />
            <DataRow label="Gasco"     row={dia.v_gasco}     onChange={(t,v)=>upd('v_gasco',t,v)}     locked={locked} />
            <DataRow label="Cocina"    row={dia.v_cocina}    onChange={(t,v)=>upd('v_cocina',t,v)}    locked={locked} />
            <DataRow label="Piso 45"   row={dia.v_piso45}    onChange={(t,v)=>upd('v_piso45',t,v)}    locked={locked} />
            <DataRow label="Prestado"  row={dia.v_prestado}  onChange={(t,v)=>upd('v_prestado',t,v)}  locked={locked} />
            <DataRow label="Deben"     row={dia.v_deben}     onChange={(t,v)=>upd('v_deben',t,v)}     locked={locked} />

            {/* Personas dinámicas */}
            {dia.v_personas.map(p => (
              <tr key={p.id} style={{ borderBottom: '1px solid #141820' }}>
                <td style={{ padding: '3px 8px', borderRight: '1px solid #1e2432' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <input
                      type="text"
                      value={p.nombre}
                      placeholder="Nombre..."
                      onChange={e => updPersonaNombre(p.id, e.target.value)}
                      readOnly={locked}
                      style={{ flex: 1, background: 'transparent', border: 'none', borderBottom: '1px solid #2d3748', outline: 'none', color: '#e2e8f0', fontSize: 12, padding: '2px 4px' }}
                    />
                    {!locked && (
                      <button onClick={() => removePersona(p.id)} style={{ color: '#4a5568', background: 'none', border: 'none', cursor: 'pointer', padding: 2, flexShrink: 0 }}>
                        <Trash2 size={12} />
                      </button>
                    )}
                  </div>
                </td>
                {TIPOS.map(t => (
                  <Cell key={t} value={p.valores[t]} onChange={v => updPersonaValor(p.id, t, v)} locked={locked} />
                ))}
              </tr>
            ))}

            {/* Botón agregar persona */}
            {!locked && (
              <tr style={{ borderBottom: '1px solid #141820' }}>
                <td colSpan={TIPOS.length + 2} style={{ padding: '4px 12px' }}>
                  <button onClick={addPersona} style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'none', border: '1px dashed #2d3748', borderRadius: 5, color: '#4a5568', fontSize: 11, padding: '3px 10px', cursor: 'pointer' }}>
                    <Plus size={11} /> Agregar persona
                  </button>
                </td>
              </tr>
            )}

            <TotalRow label="Total Vacíos" row={totalVacios} bg="#2a1200" color="#fb923c" />

            <SectionHead label="Tránsito" bg="#1a0f2e" color="#c084fc" />
            <DataRow label="Tránsito Normal" row={dia.trans_normal} onChange={(t,v)=>upd('trans_normal',t,v)} locked={locked} />
            <DataRow label="Tránsito Cata"   row={dia.trans_cata}   onChange={(t,v)=>upd('trans_cata',t,v)}   locked={locked} />
            <TotalRow label="Total Tránsito" row={totalTransito} bg="#1a0f2e" color="#c084fc" />

          </tbody>
        </table>
      </div>

      {/* Observaciones */}
      <div style={{ marginTop: 14 }}>
        <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6 }}>
          Observaciones / Prestados
        </label>
        <textarea
          value={dia.notas}
          onChange={e => updNotas(e.target.value)}
          readOnly={locked}
          rows={4}
          placeholder={'Patricia: 2x45, 2x11\nDH: 4x11 — revisar devolución'}
          style={{
            width: '100%', background: '#0d1117', border: '1px solid #1e2432', borderRadius: 8,
            color: '#e2e8f0', fontSize: 13, padding: '10px 12px', resize: 'vertical',
            outline: 'none', boxSizing: 'border-box', opacity: locked ? 0.6 : 1,
            fontFamily: 'monospace', lineHeight: 1.7,
          }}
        />
      </div>

    </div>
  );
}
