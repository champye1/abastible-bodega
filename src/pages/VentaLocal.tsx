import { useState, useEffect } from 'react';
import { User, CheckCircle2, XCircle, Plus, Trash2, Settings, X, Tag, FileDown } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// ── Operadores ─────────────────────────────────────────────────────────────────
const OPERADORES = ['Esteban', 'Jorge', 'Rubén', 'Maximiliano'];

// ── Tipos de carga ─────────────────────────────────────────────────────────────
const TIPOS_VENTA = [
  { key: '45N', label: '45 kg',      defaultPrecio: 78_000 },
  { key: '15N', label: '15 kg',      defaultPrecio: 28_000 },
  { key: '15C', label: '15 kg Cat.', defaultPrecio: 30_000 },
  { key: '11N', label: '11 kg',      defaultPrecio: 20_000 },
  { key: '5N',  label: '5 kg',       defaultPrecio: 11_000 },
  { key: 'VM',  label: 'VM',         defaultPrecio: 28_000 },
] as const;

type TipoVentaKey = typeof TIPOS_VENTA[number]['key'];

// Los tipos de gas para garantía (sin VM ni Cat.)
const TIPOS_GAS_GARANTIA = [
  { key: '45', label: '45 kg', ventaKey: '45N' as TipoVentaKey },
  { key: '15', label: '15 kg', ventaKey: '15N' as TipoVentaKey },
  { key: '11', label: '11 kg', ventaKey: '11N' as TipoVentaKey },
  { key: '5',  label: '5 kg',  ventaKey: '5N'  as TipoVentaKey },
] as const;

type TipoGasKey = typeof TIPOS_GAS_GARANTIA[number]['key'];

// ── Precios (editables, persisten en localStorage) ─────────────────────────────
type Precios = Record<TipoVentaKey, number>;

const DEFAULT_PRECIOS: Precios = {
  '45N': 78_000, '15N': 28_000, '15C': 30_000,
  '11N': 20_000, '5N': 11_000, 'VM': 28_000,
};

const LS_PRECIOS_KEY = 'abastible_precios_v1';

function loadPrecios(): Precios {
  try {
    const raw = localStorage.getItem(LS_PRECIOS_KEY);
    return raw ? { ...DEFAULT_PRECIOS, ...JSON.parse(raw) } : { ...DEFAULT_PRECIOS };
  } catch { return { ...DEFAULT_PRECIOS }; }
}

function savePrecios(p: Precios) {
  try { localStorage.setItem(LS_PRECIOS_KEY, JSON.stringify(p)); } catch {}
}

// ── Data shapes ────────────────────────────────────────────────────────────────
interface GarantiaEntry {
  id: string;
  tipo: TipoGasKey;
  cantidad: number;
  precioTubo: number;  // ingresado manualmente por el operador
}

interface ExtraItem {
  id: string;
  descripcion: string;
  cantidad: number;
  valorUnitario: number;
  esDescuento: boolean;
}

interface ValeVentaFutura {
  id: string;
  tipo: string;
  cantidad: number;
  valor: number;
}

interface TransbankEntry {
  id: string;
  referencia: string;
  monto: number;
}

interface VentaLocalData {
  operador: string;
  fecha: string;
  cargas:    Record<TipoVentaKey, number>;
  garantias: GarantiaEntry[];
  extras:    ExtraItem[];
  desc_rut:  number;
  bono_gas:  number;
  vales:     ValeVentaFutura[];
  transbank: TransbankEntry[];
  efectivo:  number;
}

function toKey(d: Date) { return d.toISOString().split('T')[0]; }
const LS_KEY = 'abastible_venta_local_v2';

function emptyData(operador: string, fecha: string): VentaLocalData {
  return {
    operador, fecha,
    cargas:    { '45N': 0, '15N': 0, '15C': 0, '11N': 0, '5N': 0, 'VM': 0 },
    garantias: [],
    extras:    [],
    desc_rut: 0, bono_gas: 0,
    vales:     [],
    transbank: [{ id: crypto.randomUUID(), referencia: '', monto: 0 }],
    efectivo: 0,
  };
}

function loadAll(): Record<string, VentaLocalData> {
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}

function saveAll(data: Record<string, VentaLocalData>) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(data)); } catch {}
}

// ── Helpers ────────────────────────────────────────────────────────────────────
function clpFull(n: number) { return '$' + Math.abs(n).toLocaleString('es-CL'); }

// ── Helpers internos de cálculo ────────────────────────────────────────────────
function calcTotalesData(d: VentaLocalData, precios: Precios) {
  const totalCargas    = TIPOS_VENTA.reduce((s, t) => s + d.cargas[t.key] * precios[t.key], 0);
  const garantiaTotal  = (g: GarantiaEntry) => {
    const vk = TIPOS_GAS_GARANTIA.find(t => t.key === g.tipo)?.ventaKey;
    return (g.precioTubo + (vk ? precios[vk] : 0)) * g.cantidad;
  };
  const totalGarantias = d.garantias.reduce((s, g) => s + garantiaTotal(g), 0);
  const totalExtrasPos = d.extras.filter(e => !e.esDescuento).reduce((s, e) => s + e.cantidad * e.valorUnitario, 0);
  const totalExtrasNeg = d.extras.filter(e =>  e.esDescuento).reduce((s, e) => s + e.cantidad * e.valorUnitario, 0);
  const totalVales     = d.vales.reduce((s, v) => s + v.valor, 0);
  const totalBruto     = totalCargas + totalGarantias + totalExtrasPos;
  const totalDesc      = d.desc_rut + d.bono_gas + totalVales + totalExtrasNeg;
  const totalNeto      = totalBruto - totalDesc;
  const totalTransbank = d.transbank.reduce((s, t) => s + t.monto, 0);
  const totalPagos     = totalTransbank + d.efectivo;
  return { totalCargas, totalGarantias, totalExtrasPos, totalExtrasNeg, totalVales, totalBruto, totalDesc, totalNeto, totalPagos, garantiaTotal };
}

// ── Exportar PDF de Venta Local ────────────────────────────────────────────────
function exportVentaPDF(data: VentaLocalData, precios: Precios, operador: string, fecha: string) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const W = doc.internal.pageSize.getWidth();
  type RGB = [number, number, number];

  const { totalCargas, totalGarantias, totalExtrasPos,
          totalBruto, totalDesc, totalNeto, totalPagos, garantiaTotal } = calcTotalesData(data, precios);
  const diferencia = totalPagos - totalNeto;
  const cuadra = Math.abs(diferencia) < 1;

  const clp = (n: number) => '$' + Math.abs(n).toLocaleString('es-CL');
  const fechaDisplay = new Date(fecha + 'T12:00:00').toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  // Barra naranja
  doc.setFillColor(249, 115, 22); doc.rect(0, 0, W, 2, 'F');

  // Cabecera izquierda
  doc.setFontSize(20); doc.setFont('helvetica', 'bold'); doc.setTextColor(249, 115, 22);
  doc.text('ABASTIBLE', 15, 20);
  doc.setFontSize(8.5); doc.setFont('helvetica', 'normal'); doc.setTextColor(130, 130, 130);
  doc.text('Bodega GLP  ·  Planta Santiago  ·  Pudahuel, RM', 15, 27);

  // Cabecera derecha
  doc.setFontSize(13); doc.setFont('helvetica', 'bold'); doc.setTextColor(30, 30, 30);
  doc.text('LIQUIDACIÓN VENTA LOCAL', W - 15, 17, { align: 'right' });
  doc.setFontSize(10); doc.setFont('helvetica', 'normal'); doc.setTextColor(130, 130, 130);
  doc.text(`Operador: ${operador}`, W - 15, 24, { align: 'right' });
  doc.setFontSize(11); doc.setFont('helvetica', 'bold'); doc.setTextColor(249, 115, 22);
  doc.text(fechaDisplay.charAt(0).toUpperCase() + fechaDisplay.slice(1), W - 15, 31, { align: 'right' });
  doc.setDrawColor(220, 220, 220); doc.line(15, 35, W - 15, 35);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const SEC = (lbl: string, color: RGB, bg: RGB) => ({
    content: lbl, colSpan: 4,
    styles: { fillColor: bg, textColor: color, fontStyle: 'bold', fontSize: 9, cellPadding: 3 },
  });
  const TOT = (lbl: string, val: string, color: RGB, bg: RGB) => [{
    content: lbl, colSpan: 3,
    styles: { fillColor: bg, textColor: color, fontStyle: 'bold', fontSize: 9.5, halign: 'right', cellPadding: 3 },
  }, {
    content: val, styles: { fillColor: bg, textColor: color, fontStyle: 'bold', fontSize: 9.5, halign: 'right', cellPadding: 3 },
  }];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const body: any[] = [];

  // ── Cargas
  const cargasConValor = TIPOS_VENTA.filter(t => data.cargas[t.key] > 0);
  if (cargasConValor.length > 0) {
    body.push([SEC('CARGAS', [0, 97, 0], [198, 239, 206])]);
    cargasConValor.forEach((t, i) => {
      const cant = data.cargas[t.key];
      body.push([t.label, String(cant), clp(precios[t.key]) + '/u',
        { content: clp(cant * precios[t.key]), styles: { halign: 'right', fillColor: i % 2 === 0 ? [255,255,255] as RGB : [248,248,248] as RGB } },
      ]);
    });
    body.push(TOT('TOTAL CARGAS', clp(totalCargas), [0, 97, 0], [198, 239, 206]));
  }

  // ── Garantías
  if (data.garantias.length > 0) {
    body.push([SEC('GARANTÍAS', [70, 25, 125], [225, 205, 240])]);
    data.garantias.forEach((g, i) => {
      const tipoLbl = TIPOS_GAS_GARANTIA.find(t => t.key === g.tipo)?.label ?? g.tipo;
      const vk = TIPOS_GAS_GARANTIA.find(t => t.key === g.tipo)?.ventaKey;
      const precioGas = vk ? precios[vk] : 0;
      body.push([
        `${tipoLbl} × ${g.cantidad}`,
        `Tubo: ${clp(g.precioTubo)} + Gas: ${clp(precioGas)}`,
        `= ${clp(g.precioTubo + precioGas)}/u`,
        { content: clp(garantiaTotal(g)), styles: { halign: 'right', fillColor: i % 2 === 0 ? [255,255,255] as RGB : [248,248,248] as RGB } },
      ]);
    });
    body.push(TOT('TOTAL GARANTÍAS', clp(totalGarantias), [70, 25, 125], [225, 205, 240]));
  }

  // ── Otros ítems
  const extrasPos = data.extras.filter(e => !e.esDescuento && e.valorUnitario > 0);
  if (extrasPos.length > 0) {
    body.push([SEC('OTROS CARGOS', [0, 70, 127], [189, 215, 238])]);
    extrasPos.forEach((e, i) => {
      body.push([e.descripcion || 'Sin descripción', String(e.cantidad), clp(e.valorUnitario) + '/u',
        { content: clp(e.cantidad * e.valorUnitario), styles: { halign: 'right', fillColor: i % 2 === 0 ? [255,255,255] as RGB : [248,248,248] as RGB } },
      ]);
    });
    body.push(TOT('TOTAL CARGOS EXTRA', clp(totalExtrasPos), [0, 70, 127], [189, 215, 238]));
  }

  // ── Total bruto
  if (totalBruto > 0) {
    body.push(TOT('TOTAL BRUTO', clp(totalBruto), [140, 56, 0], [252, 224, 200]));
  }

  // ── Descuentos
  const descRows: string[][] = [];
  if (data.desc_rut > 0)  descRows.push(['DESC RUT', '', '', '-' + clp(data.desc_rut)]);
  if (data.bono_gas > 0)  descRows.push(['Bono Gas', '', '', '-' + clp(data.bono_gas)]);
  data.vales.forEach(v => { if (v.valor > 0) descRows.push([`Vale ${v.tipo}`, String(v.cantidad), '', '-' + clp(v.valor)]); });
  data.extras.filter(e => e.esDescuento && e.valorUnitario > 0).forEach(e => {
    descRows.push([e.descripcion || 'Descuento', String(e.cantidad), clp(e.valorUnitario) + '/u', '-' + clp(e.cantidad * e.valorUnitario)]);
  });
  if (descRows.length > 0) {
    body.push([SEC('DESCUENTOS', [140, 20, 20], [255, 199, 206])]);
    descRows.forEach((r, i) => body.push(r.map((v, j) => ({
      content: v,
      styles: { halign: j === 3 ? 'right' as const : 'left' as const, fillColor: i % 2 === 0 ? [255,255,255] as RGB : [248,248,248] as RGB },
    }))));
    body.push(TOT('TOTAL DESCUENTOS', '-' + clp(totalDesc), [140, 20, 20], [255, 199, 206]));
  }

  // ── Total a cobrar
  body.push(TOT('TOTAL A COBRAR', clp(totalNeto), [0, 120, 60], [144, 238, 144]));

  // ── Forma de pago
  const pagoRows: string[][] = [];
  data.transbank.forEach((t, i) => {
    if (t.monto > 0) pagoRows.push([`Transbank${data.transbank.length > 1 ? ` Nº${i+1}` : ''}${t.referencia ? ` (${t.referencia})` : ''}`, '', '', clp(t.monto)]);
  });
  if (data.efectivo > 0) pagoRows.push(['Efectivo', '', '', clp(data.efectivo)]);
  if (pagoRows.length > 0) {
    body.push([SEC('FORMA DE PAGO', [0, 70, 127], [189, 215, 238])]);
    pagoRows.forEach((r, i) => body.push(r.map((v, j) => ({
      content: v,
      styles: { halign: j === 3 ? 'right' as const : 'left' as const, fillColor: i % 2 === 0 ? [255,255,255] as RGB : [248,248,248] as RGB },
    }))));
    body.push(TOT('TOTAL PAGOS', clp(totalPagos), [0, 70, 127], [189, 215, 238]));
  }

  // ── Cuadre final
  const cuadreBg: RGB = cuadra ? [198, 239, 206] : [255, 199, 206];
  const cuadreTxt: RGB = cuadra ? [0, 97, 0] : [140, 20, 20];
  const cuadreLbl = cuadra ? '✓  CUADRE CORRECTO' : `✗  DIFERENCIA: ${diferencia > 0 ? 'Sobran' : 'Faltan'} ${clp(Math.abs(diferencia))}`;
  body.push([{ content: cuadreLbl, colSpan: 4, styles: { fillColor: cuadreBg, textColor: cuadreTxt, fontStyle: 'bold', fontSize: 10, halign: 'center', cellPadding: 4 } }]);

  autoTable(doc, {
    startY: 38,
    head: [[
      { content: 'Descripción', styles: { halign: 'left', fillColor: [235,235,235] as RGB, textColor: [50,50,50] as RGB, fontStyle: 'bold' } },
      { content: 'Cant.', styles: { halign: 'center', fillColor: [235,235,235] as RGB, textColor: [50,50,50] as RGB, fontStyle: 'bold' } },
      { content: 'Precio Unit.', styles: { halign: 'right', fillColor: [235,235,235] as RGB, textColor: [50,50,50] as RGB, fontStyle: 'bold' } },
      { content: 'Total', styles: { halign: 'right', fillColor: [235,235,235] as RGB, textColor: [50,50,50] as RGB, fontStyle: 'bold' } },
    ]],
    body,
    columnStyles: {
      0: { cellWidth: 80 },
      1: { cellWidth: 18, halign: 'center' },
      2: { cellWidth: 45, halign: 'right' },
      3: { cellWidth: 37, halign: 'right' },
    },
    margin: { left: 15, right: 15 },
    styles: { fontSize: 9, cellPadding: 2.5, lineColor: [210, 210, 210], lineWidth: 0.2 },
    headStyles: { fontStyle: 'bold', fontSize: 9, cellPadding: 3.5 },
    theme: 'plain',
  });

  // Pie
  const pH = doc.internal.pageSize.getHeight();
  doc.setDrawColor(220, 220, 220); doc.line(15, pH - 13, W - 15, pH - 13);
  doc.setFontSize(7.5); doc.setFont('helvetica', 'normal'); doc.setTextColor(160, 160, 160);
  doc.text(`Generado el ${new Date().toLocaleString('es-CL')}  ·  Abastible S.A.`, 15, pH - 7);
  doc.text('Sistema Bodega v1.0', W - 15, pH - 7, { align: 'right' });

  doc.save(`venta_local_${operador.toLowerCase()}_${fecha}.pdf`);
}

// ── Modal de precios ───────────────────────────────────────────────────────────
function PreciosModal({ precios, onSave, onClose }: {
  precios: Precios;
  onSave: (p: Precios) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState<Precios>({ ...precios });

  function set(k: TipoVentaKey, v: number) {
    setDraft(prev => ({ ...prev, [k]: v }));
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ background: '#141820', border: '1px solid #1e2432', borderRadius: 12, width: '100%', maxWidth: 380 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '13px 16px', borderBottom: '1px solid #1e2432' }}>
          <Settings size={15} style={{ color: '#f97316' }} />
          <span style={{ color: '#fff', fontWeight: 700, fontSize: 14 }}>Editar precios de carga</span>
          <button onClick={onClose} style={{ marginLeft: 'auto', color: '#4a5568', background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex' }}>
            <X size={15} />
          </button>
        </div>
        <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {TIPOS_VENTA.map(t => (
            <div key={t.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
              <span style={{ fontSize: 13, color: '#e2e8f0', minWidth: 90 }}>{t.label}</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 11, color: '#4a5568' }}>$</span>
                <input
                  type="number" min={0}
                  value={draft[t.key] === 0 ? '' : draft[t.key]}
                  onChange={e => set(t.key, parseInt(e.target.value) || 0)}
                  onFocus={e => (e.target as HTMLInputElement).select()}
                  style={{ width: 100, background: '#1e2432', border: '1px solid #2d3748', borderRadius: 6, color: '#e2e8f0', padding: '5px 8px', fontSize: 12, outline: 'none', textAlign: 'right', fontFamily: 'monospace' }}
                />
              </div>
            </div>
          ))}
          <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
            <button onClick={onClose}
              style={{ flex: 1, padding: '8px 16px', background: '#1e2432', color: '#64748b', border: '1px solid #2d3748', borderRadius: 8, fontSize: 13, cursor: 'pointer' }}>
              Cancelar
            </button>
            <button onClick={() => { onSave(draft); onClose(); }}
              style={{ flex: 1, padding: '8px 16px', background: '#431407', color: '#fb923c', border: '1px solid #fb923c40', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
              Guardar precios
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Celda número editable ──────────────────────────────────────────────────────
function NumInput({ value, onChange, small = false, placeholder = '0', mono = false }: {
  value: number; onChange: (n: number) => void;
  small?: boolean; placeholder?: string; mono?: boolean;
}) {
  return (
    <input
      type="number" min={0}
      value={value === 0 ? '' : value}
      placeholder={placeholder}
      onChange={e => onChange(Math.max(0, parseInt(e.target.value) || 0))}
      onFocus={e => (e.target as HTMLInputElement).select()}
      style={{
        width: small ? 52 : 80, background: '#1e2432', border: '1px solid #2d3748',
        borderRadius: 6, color: '#e2e8f0', padding: '4px 8px', fontSize: 12,
        outline: 'none', textAlign: 'right',
        fontFamily: mono ? '"Courier New", monospace' : 'inherit',
      }}
    />
  );
}

// ── Página principal ───────────────────────────────────────────────────────────
export default function VentaLocal() {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const todayKey = toKey(today);

  const [allData,  setAllData]  = useState<Record<string, VentaLocalData>>(loadAll);
  const [precios,  setPrecios]  = useState<Precios>(loadPrecios);
  const [operador, setOperador] = useState(OPERADORES[0]);
  const [fecha,    setFecha]    = useState(todayKey);
  const [savedAt,  setSavedAt]  = useState<string | null>(null);
  const [showPrecios, setShowPrecios] = useState(false);

  const storeKey = `${fecha}_${operador}`;
  const data: VentaLocalData = allData[storeKey] ?? emptyData(operador, fecha);

  useEffect(() => {
    saveAll(allData);
    setSavedAt(new Date().toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
  }, [allData]);

  function update(patch: Partial<VentaLocalData>) {
    setAllData(prev => ({ ...prev, [storeKey]: { ...data, ...patch } }));
  }

  function handleSavePrecios(p: Precios) { setPrecios(p); savePrecios(p); }

  // ── Cargas ─────────────────────────────────────────────────────────────────
  function setCarga(key: TipoVentaKey, n: number) {
    update({ cargas: { ...data.cargas, [key]: n } });
  }

  const totalCargas = TIPOS_VENTA.reduce((s, t) => s + data.cargas[t.key] * precios[t.key], 0);

  // ── Garantías ──────────────────────────────────────────────────────────────
  function addGarantia() {
    update({ garantias: [...data.garantias, { id: crypto.randomUUID(), tipo: '15', cantidad: 1, precioTubo: 0 }] });
  }
  function setGarantia(id: string, patch: Partial<GarantiaEntry>) {
    update({ garantias: data.garantias.map(g => g.id === id ? { ...g, ...patch } : g) });
  }
  function removeGarantia(id: string) {
    update({ garantias: data.garantias.filter(g => g.id !== id) });
  }

  function garantiaTotal(g: GarantiaEntry): number {
    const gasKey = TIPOS_GAS_GARANTIA.find(t => t.key === g.tipo)?.ventaKey;
    const precioGas = gasKey ? precios[gasKey] : 0;
    return (g.precioTubo + precioGas) * g.cantidad;
  }
  const totalGarantias = data.garantias.reduce((s, g) => s + garantiaTotal(g), 0);

  // ── Ítems extra ────────────────────────────────────────────────────────────
  function addExtra(esDescuento: boolean) {
    update({ extras: [...data.extras, { id: crypto.randomUUID(), descripcion: '', cantidad: 1, valorUnitario: 0, esDescuento }] });
  }
  function setExtra(id: string, patch: Partial<ExtraItem>) {
    update({ extras: data.extras.map(e => e.id === id ? { ...e, ...patch } : e) });
  }
  function removeExtra(id: string) {
    update({ extras: data.extras.filter(e => e.id !== id) });
  }
  const totalExtrasPos = data.extras.filter(e => !e.esDescuento).reduce((s, e) => s + e.cantidad * e.valorUnitario, 0);
  const totalExtrasNeg = data.extras.filter(e => e.esDescuento).reduce((s, e) => s + e.cantidad * e.valorUnitario, 0);

  // ── Descuentos ─────────────────────────────────────────────────────────────
  function addVale() {
    update({ vales: [...data.vales, { id: crypto.randomUUID(), tipo: '15 kg', cantidad: 0, valor: 0 }] });
  }
  function setVale(id: string, field: keyof ValeVentaFutura, val: string | number) {
    update({ vales: data.vales.map(v => v.id === id ? { ...v, [field]: val } : v) });
  }
  function removeVale(id: string) { update({ vales: data.vales.filter(v => v.id !== id) }); }
  const totalVales = data.vales.reduce((s, v) => s + v.valor, 0);
  const totalDescuentos = data.desc_rut + data.bono_gas + totalVales + totalExtrasNeg;

  // ── Transbank ──────────────────────────────────────────────────────────────
  function setTransbank(id: string, field: 'referencia' | 'monto', val: string | number) {
    update({ transbank: data.transbank.map(t => t.id === id ? { ...t, [field]: val } : t) });
  }
  function addTransbank() {
    update({ transbank: [...data.transbank, { id: crypto.randomUUID(), referencia: '', monto: 0 }] });
  }
  function removeTransbank(id: string) {
    update({ transbank: data.transbank.filter(t => t.id !== id) });
  }

  // ── Totales globales ───────────────────────────────────────────────────────
  const totalBruto      = totalCargas + totalGarantias + totalExtrasPos;
  const totalNeto       = totalBruto - totalDescuentos;
  const totalTransbank  = data.transbank.reduce((s, t) => s + t.monto, 0);
  const totalPagos      = totalTransbank + data.efectivo;
  const diferencia      = totalPagos - totalNeto;
  const cuadra          = Math.abs(diferencia) < 1;

  const fechaDisplay = new Date(fecha + 'T12:00:00').toLocaleDateString('es-CL', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });

  const th: React.CSSProperties = {
    padding: '4px 0', fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
    letterSpacing: 1, color: '#4a5568', textAlign: 'left', paddingRight: 16,
    borderBottom: '2px solid #1e2432',
  };

  const sectionStyle: React.CSSProperties = { border: '1px solid #1e2432', borderRadius: 12, overflow: 'hidden' };
  const sectionHead: React.CSSProperties  = { background: '#0d1117', borderBottom: '1px solid #1e2432', padding: '10px 18px', display: 'flex', alignItems: 'center', gap: 8 };
  const sectionBody: React.CSSProperties  = { background: '#151b2e', padding: '14px 18px' };

  return (
    <div className="max-w-2xl space-y-5">

      {showPrecios && (
        <PreciosModal precios={precios} onSave={handleSavePrecios} onClose={() => setShowPrecios(false)} />
      )}

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold text-white">Venta Local</h1>
          <p className="text-sm capitalize mt-0.5" style={{ color: '#4a5568' }}>{fechaDisplay}</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0 mt-1">
          {savedAt && (
            <div className="flex items-center gap-1.5 text-[11px]" style={{ color: '#4a5568' }}>
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: '#34d399' }} />
              Guardado {savedAt}
            </div>
          )}
          {totalNeto > 0 && (
            <button onClick={() => exportVentaPDF(data, precios, operador, fecha)}
              className="flex items-center gap-1.5 text-[12px] font-semibold px-3 py-1.5 rounded-lg hover:opacity-80"
              style={{ background: '#0f2318', color: '#4ade80', border: '1px solid #4ade8020' }}>
              <FileDown size={13} /> Exportar PDF
            </button>
          )}
        </div>
      </div>

      {/* ── Selector operador + fecha ─────────────────────────────────────── */}
      <div className="rounded-xl p-1 flex gap-1" style={{ background: '#0d1117', border: '1px solid #1e2432' }}>
        <div className="flex items-center px-3" style={{ color: '#4a5568' }}><User size={14} /></div>
        {OPERADORES.map(op => (
          <button key={op} onClick={() => setOperador(op)}
            className="flex-1 py-2 px-3 rounded-lg text-sm font-semibold transition-all"
            style={{
              background: operador === op ? '#1e2432' : 'transparent',
              color: operador === op ? '#fb923c' : '#4a5568',
              border: operador === op ? '1px solid #2d3748' : '1px solid transparent',
            }}>
            {op}
          </button>
        ))}
        <input type="date" value={fecha} onChange={e => setFecha(e.target.value)}
          style={{ background: '#1e2432', border: '1px solid #2d3748', borderRadius: 8, color: '#94a3b8', padding: '4px 10px', fontSize: 11, outline: 'none', marginLeft: 4 }} />
      </div>

      {/* ── Cargas ─────────────────────────────────────────────────────────── */}
      <div style={sectionStyle}>
        <div style={{ ...sectionHead, justifyContent: 'space-between' }}>
          <span className="text-sm font-bold text-white">Cargas</span>
          <button onClick={() => setShowPrecios(true)}
            className="flex items-center gap-1.5 text-[11px] px-2.5 py-1.5 rounded-lg hover:opacity-80"
            style={{ background: '#1e2432', color: '#64748b', border: '1px solid #2d3748' }}>
            <Settings size={11} /> Editar precios
          </button>
        </div>
        <div style={sectionBody}>
          <table className="w-full">
            <thead>
              <tr>
                <th style={th}>Tipo</th>
                <th style={{ ...th, textAlign: 'right' }}>Cant.</th>
                <th style={{ ...th, textAlign: 'right' }}>Valor</th>
              </tr>
            </thead>
            <tbody>
              {TIPOS_VENTA.map(t => (
                <tr key={t.key} style={{ borderBottom: '1px solid #1e2432' }}>
                  <td className="py-2 pr-4">
                    <span className="text-sm font-semibold text-white">{t.label}</span>
                    <span className="text-[10px] ml-2" style={{ color: '#4a5568' }}>${precios[t.key].toLocaleString('es-CL')}/u</span>
                  </td>
                  <td className="py-2 pr-4 text-right">
                    <NumInput value={data.cargas[t.key]} onChange={n => setCarga(t.key, n)} small />
                  </td>
                  <td className="py-2 text-right">
                    <span className="text-sm font-bold" style={{ color: data.cargas[t.key] > 0 ? '#fb923c' : '#2d3748' }}>
                      {data.cargas[t.key] > 0 ? clpFull(data.cargas[t.key] * precios[t.key]) : '—'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={2} className="pt-3 pb-1 text-sm font-bold text-white">Total Cargas</td>
                <td className="pt-3 pb-1 text-right text-sm font-bold" style={{ color: '#fb923c' }}>
                  {totalCargas > 0 ? clpFull(totalCargas) : '—'}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* ── Garantías ──────────────────────────────────────────────────────── */}
      <div style={sectionStyle}>
        <div style={{ ...sectionHead, justifyContent: 'space-between' }}>
          <div>
            <span className="text-sm font-bold text-white">Garantías</span>
            <span className="text-[11px] ml-2" style={{ color: '#4a5568' }}>tubo + carga automático</span>
          </div>
          <button onClick={addGarantia}
            className="flex items-center gap-1 text-[11px] px-2.5 py-1.5 rounded-lg hover:opacity-80"
            style={{ background: '#1e2432', color: '#4a5568', border: '1px solid #2d3748' }}>
            <Plus size={11} /> Agregar
          </button>
        </div>
        <div style={sectionBody}>
          {data.garantias.length === 0 ? (
            <p style={{ fontSize: 12, color: '#2d3748', textAlign: 'center', padding: '12px 0' }}>
              Sin garantías — presiona "Agregar"
            </p>
          ) : (
            <div className="space-y-2">
              {data.garantias.map(g => {
                const tipoInfo = TIPOS_GAS_GARANTIA.find(t => t.key === g.tipo)!;
                const precioGas = precios[tipoInfo.ventaKey];
                const total = garantiaTotal(g);
                return (
                  <div key={g.id} style={{ background: '#0d1117', borderRadius: 8, padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      {/* Tipo */}
                      <select value={g.tipo} onChange={e => setGarantia(g.id, { tipo: e.target.value as TipoGasKey })}
                        style={{ background: '#1e2432', border: '1px solid #2d3748', borderRadius: 6, color: '#e2e8f0', padding: '4px 8px', fontSize: 12, outline: 'none' }}>
                        {TIPOS_GAS_GARANTIA.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
                      </select>
                      {/* Cantidad */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <span style={{ fontSize: 11, color: '#4a5568' }}>Cant.</span>
                        <NumInput value={g.cantidad} onChange={n => setGarantia(g.id, { cantidad: Math.max(1, n) })} small />
                      </div>
                      {/* Precio tubo */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <span style={{ fontSize: 11, color: '#4a5568' }}>Tubo $</span>
                        <NumInput value={g.precioTubo} onChange={n => setGarantia(g.id, { precioTubo: n })} />
                      </div>
                      <button onClick={() => removeGarantia(g.id)} style={{ marginLeft: 'auto', color: '#2d3748', background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}
                        className="hover:text-red-400 transition-colors">
                        <Trash2 size={13} />
                      </button>
                    </div>
                    {/* Desglose automático */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#64748b', flexWrap: 'wrap' }}>
                      <span>× {g.cantidad}</span>
                      <span style={{ color: '#2d3748' }}>·</span>
                      <span>Tubo: <strong style={{ color: '#a78bfa' }}>${g.precioTubo.toLocaleString('es-CL')}</strong></span>
                      <span style={{ color: '#2d3748' }}>+</span>
                      <span>Gas {tipoInfo.label}: <strong style={{ color: '#fb923c' }}>${precioGas.toLocaleString('es-CL')}</strong></span>
                      <span style={{ color: '#2d3748' }}>=</span>
                      <span style={{ marginLeft: 'auto', fontSize: 13, fontWeight: 700, color: total > 0 ? '#a78bfa' : '#2d3748' }}>
                        {total > 0 ? clpFull(total) : '—'}
                      </span>
                    </div>
                  </div>
                );
              })}
              <div className="flex justify-between pt-2" style={{ borderTop: '1px solid #1e2432' }}>
                <span className="text-sm font-bold text-white">Total Garantías</span>
                <span className="text-sm font-bold" style={{ color: '#a78bfa' }}>
                  {totalGarantias > 0 ? clpFull(totalGarantias) : '—'}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Ítems extra (cargos o descuentos personalizados) ─────────────── */}
      <div style={sectionStyle}>
        <div style={{ ...sectionHead, justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Tag size={14} style={{ color: '#64748b' }} />
            <span className="text-sm font-bold text-white">Otros ítems</span>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={() => addExtra(false)}
              className="flex items-center gap-1 text-[11px] px-2.5 py-1.5 rounded-lg hover:opacity-80"
              style={{ background: '#0f2318', color: '#4ade80', border: '1px solid #4ade8020' }}>
              <Plus size={11} /> Cargo
            </button>
            <button onClick={() => addExtra(true)}
              className="flex items-center gap-1 text-[11px] px-2.5 py-1.5 rounded-lg hover:opacity-80"
              style={{ background: '#2d0a0a', color: '#f87171', border: '1px solid #f8717120' }}>
              <Plus size={11} /> Descuento
            </button>
          </div>
        </div>
        <div style={sectionBody}>
          {data.extras.length === 0 ? (
            <p style={{ fontSize: 12, color: '#2d3748', textAlign: 'center', padding: '12px 0' }}>
              Sin ítems extra — agrega cargos o descuentos adicionales
            </p>
          ) : (
            <div className="space-y-2">
              {data.extras.map(e => (
                <div key={e.id} style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: e.esDescuento ? '#2d0a0a' : '#0f2318', color: e.esDescuento ? '#f87171' : '#4ade80', fontWeight: 700, whiteSpace: 'nowrap' }}>
                    {e.esDescuento ? 'DESC' : 'CARGO'}
                  </span>
                  <input type="text" value={e.descripcion} placeholder="Descripción..."
                    onChange={ev => setExtra(e.id, { descripcion: ev.target.value })}
                    style={{ flex: 1, minWidth: 120, background: '#1e2432', border: '1px solid #2d3748', borderRadius: 6, color: '#e2e8f0', padding: '4px 10px', fontSize: 12, outline: 'none' }} />
                  <NumInput value={e.cantidad} onChange={n => setExtra(e.id, { cantidad: Math.max(1, n) })} small />
                  <span style={{ fontSize: 11, color: '#4a5568' }}>×</span>
                  <NumInput value={e.valorUnitario} onChange={n => setExtra(e.id, { valorUnitario: n })} />
                  <span style={{ fontSize: 12, fontWeight: 700, minWidth: 80, textAlign: 'right', color: e.esDescuento ? '#f87171' : '#4ade80' }}>
                    {e.valorUnitario > 0 ? `${e.esDescuento ? '-' : '+'}${clpFull(e.cantidad * e.valorUnitario)}` : '—'}
                  </span>
                  <button onClick={() => removeExtra(e.id)} style={{ color: '#2d3748', background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}
                    className="hover:text-red-400 transition-colors">
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
              {(totalExtrasPos > 0 || totalExtrasNeg > 0) && (
                <div style={{ borderTop: '1px solid #1e2432', paddingTop: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {totalExtrasPos > 0 && (
                    <div className="flex justify-between">
                      <span className="text-sm text-white">Cargos extra</span>
                      <span className="text-sm font-bold" style={{ color: '#4ade80' }}>+{clpFull(totalExtrasPos)}</span>
                    </div>
                  )}
                  {totalExtrasNeg > 0 && (
                    <div className="flex justify-between">
                      <span className="text-sm text-white">Descuentos extra</span>
                      <span className="text-sm font-bold" style={{ color: '#f87171' }}>-{clpFull(totalExtrasNeg)}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Total bruto ─────────────────────────────────────────────────────── */}
      {totalBruto > 0 && (
        <div className="rounded-xl px-5 py-3 flex items-center justify-between"
          style={{ background: '#1a1000', border: '1px solid #f9731630' }}>
          <span className="text-sm font-bold text-white">Total Bruto</span>
          <span className="text-lg font-bold" style={{ color: '#fb923c' }}>{clpFull(totalBruto)}</span>
        </div>
      )}

      {/* ── Descuentos fijos ─────────────────────────────────────────────────── */}
      <div style={sectionStyle}>
        <div style={sectionHead}><span className="text-sm font-bold text-white">Descuentos</span></div>
        <div style={{ ...sectionBody, display: 'flex', flexDirection: 'column', gap: 12 }}>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <span className="text-sm text-white">DESC RUT</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <NumInput value={data.desc_rut} onChange={n => update({ desc_rut: n })} />
              {data.desc_rut > 0 && <span className="text-sm" style={{ color: '#f87171', minWidth: 90, textAlign: 'right' }}>-{clpFull(data.desc_rut)}</span>}
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <span className="text-sm text-white">Bono Gas</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <NumInput value={data.bono_gas} onChange={n => update({ bono_gas: n })} />
              {data.bono_gas > 0 && <span className="text-sm" style={{ color: '#f87171', minWidth: 90, textAlign: 'right' }}>-{clpFull(data.bono_gas)}</span>}
            </div>
          </div>

          {/* Vale Venta Futura */}
          <div style={{ borderTop: '1px solid #1e2432', paddingTop: 10 }}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-white">Vale Venta Futura</span>
              <button onClick={addVale}
                className="flex items-center gap-1 text-[11px] px-2 py-1 rounded"
                style={{ background: '#1e2432', color: '#4a5568' }}>
                <Plus size={11} /> Agregar
              </button>
            </div>
            {data.vales.map(v => (
              <div key={v.id} className="flex items-center gap-2 mb-1.5">
                <select value={v.tipo} onChange={e => setVale(v.id, 'tipo', e.target.value)}
                  style={{ background: '#1e2432', border: '1px solid #2d3748', borderRadius: 6, color: '#94a3b8', padding: '4px 8px', fontSize: 12, outline: 'none' }}>
                  {['45 kg', '15 kg', '15 kg Cat.', '11 kg', '5 kg'].map(t => <option key={t}>{t}</option>)}
                </select>
                <NumInput value={v.cantidad} onChange={n => setVale(v.id, 'cantidad', n)} small />
                <span style={{ fontSize: 11, color: '#4a5568' }}>×</span>
                <NumInput value={v.valor} onChange={n => setVale(v.id, 'valor', n)} />
                <button onClick={() => removeVale(v.id)} style={{ color: '#2d3748', background: 'none', border: 'none', cursor: 'pointer' }}
                  className="hover:text-red-400 transition-colors">
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
          </div>

          {totalDescuentos > 0 && (
            <div className="flex justify-between pt-2" style={{ borderTop: '1px solid #1e2432' }}>
              <span className="text-sm font-bold text-white">Total Descuentos</span>
              <span className="text-sm font-bold" style={{ color: '#f87171' }}>-{clpFull(totalDescuentos)}</span>
            </div>
          )}
        </div>
      </div>

      {/* ── Total neto ──────────────────────────────────────────────────────── */}
      {totalNeto > 0 && (
        <div className="rounded-xl px-5 py-3 flex items-center justify-between"
          style={{ background: '#0a2e1a', border: '1px solid #34d39930' }}>
          <span className="text-sm font-bold text-white">Total a Cobrar</span>
          <span className="text-lg font-bold" style={{ color: '#34d399' }}>{clpFull(totalNeto)}</span>
        </div>
      )}

      {/* ── Forma de pago ────────────────────────────────────────────────────── */}
      <div style={sectionStyle}>
        <div style={{ ...sectionHead, justifyContent: 'space-between' }}>
          <span className="text-sm font-bold text-white">Forma de Pago</span>
          <button onClick={addTransbank}
            className="flex items-center gap-1 text-[11px] px-2 py-1 rounded"
            style={{ background: '#1e2432', color: '#4a5568' }}>
            <Plus size={11} /> Transbank
          </button>
        </div>
        <div style={{ ...sectionBody, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {data.transbank.map((t, idx) => (
            <div key={t.id} className="flex items-center gap-3">
              <span className="text-sm text-white w-28 shrink-0">
                Transbank {data.transbank.length > 1 ? `Nº${idx + 1}` : ''}
              </span>
              <input type="text" value={t.referencia} placeholder="Referencia..."
                onChange={e => setTransbank(t.id, 'referencia', e.target.value)}
                style={{ flex: 1, background: '#1e2432', border: '1px solid #2d3748', borderRadius: 6, color: '#94a3b8', padding: '4px 10px', fontSize: 12, outline: 'none' }} />
              <NumInput value={t.monto} onChange={n => setTransbank(t.id, 'monto', n)} />
              {data.transbank.length > 1 && (
                <button onClick={() => removeTransbank(t.id)} style={{ color: '#2d3748', background: 'none', border: 'none', cursor: 'pointer' }}
                  className="hover:text-red-400 transition-colors">
                  <Trash2 size={12} />
                </button>
              )}
            </div>
          ))}
          <div className="flex items-center gap-3">
            <span className="text-sm text-white w-28 shrink-0">Efectivo</span>
            <div className="flex-1" />
            <NumInput value={data.efectivo} onChange={n => update({ efectivo: n })} />
          </div>
          {totalPagos > 0 && (
            <div className="flex justify-between pt-2" style={{ borderTop: '1px solid #1e2432' }}>
              <span className="text-sm font-bold text-white">Total Pagos</span>
              <span className="text-sm font-bold" style={{ color: '#38bdf8' }}>{clpFull(totalPagos)}</span>
            </div>
          )}
        </div>
      </div>

      {/* ── Cierre / cuadre ─────────────────────────────────────────────────── */}
      {(totalNeto > 0 || totalPagos > 0) && (
        <div className="rounded-xl px-5 py-4 flex items-center justify-between"
          style={{ background: cuadra ? '#0a2e1a' : '#2d0a0a', border: `1px solid ${cuadra ? '#34d39940' : '#f8717140'}` }}>
          <div className="flex items-center gap-3">
            {cuadra
              ? <CheckCircle2 size={20} style={{ color: '#34d399' }} />
              : <XCircle      size={20} style={{ color: '#f87171' }} />}
            <div>
              <p className="text-sm font-bold" style={{ color: cuadra ? '#34d399' : '#f87171' }}>
                {cuadra ? 'Cuadre correcto' : 'Diferencia en el cuadre'}
              </p>
              {!cuadra && totalNeto > 0 && totalPagos > 0 && (
                <p className="text-[11px] mt-0.5" style={{ color: '#f87171' }}>
                  {diferencia > 0 ? `Sobran ${clpFull(diferencia)}` : `Faltan ${clpFull(Math.abs(diferencia))}`}
                </p>
              )}
            </div>
          </div>
          <div className="text-right">
            <p className="text-[10px] uppercase tracking-widest" style={{ color: '#4a5568' }}>Mi total</p>
            <p className="text-xl font-bold" style={{ color: cuadra ? '#34d399' : '#f87171' }}>{clpFull(totalNeto)}</p>
          </div>
        </div>
      )}

      {/* ── Resumen del día (todos los operadores) ───────────────────────── */}
      <ResumenDia allData={allData} precios={precios} fecha={fecha} operadorActual={operador} />
    </div>
  );
}

// ── Resumen diario multi-operador ──────────────────────────────────────────────
function ResumenDia({ allData, precios, fecha, operadorActual }: {
  allData: Record<string, VentaLocalData>;
  precios: Precios;
  fecha: string;
  operadorActual: string;
}) {
  const filas = OPERADORES.map(op => {
    const d = allData[`${fecha}_${op}`];
    if (!d) return null;
    const t = calcTotalesData(d, precios);
    if (t.totalNeto === 0 && t.totalPagos === 0) return null;
    const cuadra = Math.abs(t.totalPagos - t.totalNeto) < 1;
    return { op, ...t, cuadra };
  }).filter(Boolean) as Array<{ op: string; totalCargas: number; totalGarantias: number; totalBruto: number; totalDesc: number; totalNeto: number; totalPagos: number; cuadra: boolean }>;

  if (filas.length === 0) return null;

  const granTotal = filas.reduce((s, f) => s + f.totalNeto, 0);
  const todosOk   = filas.every(f => f.cuadra);

  return (
    <div style={{ border: '1px solid #1e2432', borderRadius: 12, overflow: 'hidden' }}>
      <div style={{ background: '#0d1117', borderBottom: '1px solid #1e2432', padding: '10px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <span className="text-sm font-bold text-white">Resumen del día</span>
          <span className="text-[11px] ml-2" style={{ color: '#4a5568' }}>todos los operadores</span>
        </div>
        <span className="text-[11px] font-bold" style={{ color: todosOk ? '#34d399' : '#f87171' }}>
          {todosOk ? '✓ Todos cuadran' : '✗ Hay diferencias'}
        </span>
      </div>
      <div style={{ background: '#0d1117', overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ background: '#111420' }}>
              {['Operador', 'Cargas', 'Garantías', 'Bruto', 'Desc.', 'Neto', 'Pagos', '✓'].map((h, i) => (
                <th key={h} style={{ padding: '6px 10px', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: '#4a5568', textAlign: i === 0 ? 'left' : 'right', borderBottom: '1px solid #1e2432', whiteSpace: 'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filas.map((f, idx) => (
              <tr key={f.op} style={{ background: f.op === operadorActual ? '#0f1e2e' : (idx % 2 === 0 ? '#0d1117' : '#0a0e17'), borderBottom: '1px solid #141820' }}>
                <td style={{ padding: '6px 10px', color: f.op === operadorActual ? '#fb923c' : '#94a3b8', fontWeight: f.op === operadorActual ? 700 : 400 }}>{f.op}</td>
                {[f.totalCargas, f.totalGarantias, f.totalBruto, f.totalDesc, f.totalNeto, f.totalPagos].map((v, i) => (
                  <td key={i} style={{ padding: '6px 10px', textAlign: 'right', fontFamily: 'monospace', color: v > 0 ? (i === 3 ? '#f87171' : '#e2e8f0') : '#2d3748', fontSize: 12 }}>
                    {v > 0 ? (i === 3 ? '-' : '') + clpFull(v) : '—'}
                  </td>
                ))}
                <td style={{ padding: '6px 10px', textAlign: 'right' }}>
                  {f.cuadra
                    ? <CheckCircle2 size={13} style={{ color: '#34d399', display: 'inline' }} />
                    : <XCircle      size={13} style={{ color: '#f87171', display: 'inline' }} />}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr style={{ background: '#111420', borderTop: '2px solid #1e2432' }}>
              <td style={{ padding: '8px 10px', fontSize: 12, fontWeight: 800, color: '#fff' }}>TOTAL DÍA</td>
              <td colSpan={4} />
              <td style={{ padding: '8px 10px', textAlign: 'right', fontSize: 13, fontWeight: 800, fontFamily: 'monospace', color: '#34d399' }}>{clpFull(granTotal)}</td>
              <td colSpan={2} />
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
