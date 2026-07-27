import { useState, useEffect, useRef } from 'react';
import { createWorker } from 'tesseract.js';
import {
  Plus, Trash2, CheckCircle2, XCircle, Sun, Moon,
  Lock, LockOpen, AlertTriangle, Camera, X, Loader2,
} from 'lucide-react';

// ── Tipos ──────────────────────────────────────────────────────────────────────
const TIPOS = ['5 kg', '11 kg', '15 kg', '45 kg'] as const;
type TipoKey = typeof TIPOS[number];
type CantMap = Record<TipoKey, number>;

interface Fila {
  id: string;
  conductor: string;
  patente: string;
  folio: string;
  carga: CantMap;
  vendido: CantMap;
  sobrante: CantMap;
  observaciones: string;
}

interface DiaData {
  manana: Fila[];
  tarde: Fila[];
  manana_cerrado?: boolean;
  tarde_cerrado?: boolean;
  manana_cerrado_at?: string;
  tarde_cerrado_at?: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────────
function emptyMap(): CantMap { return { '5 kg': 0, '11 kg': 0, '15 kg': 0, '45 kg': 0 }; }

function newFila(): Fila {
  return { id: crypto.randomUUID(), conductor: '', patente: '', folio: '', carga: emptyMap(), vendido: emptyMap(), sobrante: emptyMap(), observaciones: '' };
}

function cuadraFila(f: Fila): boolean | null {
  if (!TIPOS.some(t => f.carga[t] > 0)) return null;
  if (!TIPOS.some(t => f.vendido[t] > 0 || f.sobrante[t] > 0)) return null;
  return TIPOS.every(t => f.carga[t] === f.vendido[t] + f.sobrante[t]);
}

function toKey(d: Date): string { return d.toISOString().split('T')[0]; }
function nowStr(): string { return new Date().toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' }); }

function buildInitialData(): Record<string, DiaData> {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  function ago(n: number) { const d = new Date(today); d.setDate(d.getDate() - n); return toKey(d); }
  return {
    [ago(4)]: {
      manana_cerrado: true, tarde_cerrado: true,
      manana_cerrado_at: '13:45', tarde_cerrado_at: '21:10',
      manana: [
        { id: 'h1', conductor: 'Trans. Kevin Pardo EIR', patente: 'RFGF81', folio: '4975191',
          carga:    { '5 kg': 5,  '11 kg': 3, '15 kg': 24, '45 kg': 2 },
          vendido:  { '5 kg': 5,  '11 kg': 2, '15 kg': 22, '45 kg': 2 },
          sobrante: { '5 kg': 0,  '11 kg': 1, '15 kg': 2,  '45 kg': 0 },
          observaciones: 'GARANTIA X13\nFacturas: 1364/1238\n-2X45/1X15 Burger Forestal\n-2X15 Verónica Pardo' },
        { id: 'h2', conductor: 'Carlos González', patente: 'ABCD12', folio: '4974850',
          carga:    { '5 kg': 60, '11 kg': 0, '15 kg': 0, '45 kg': 0 },
          vendido:  { '5 kg': 54, '11 kg': 0, '15 kg': 0, '45 kg': 0 },
          sobrante: { '5 kg': 6,  '11 kg': 0, '15 kg': 0, '45 kg': 0 },
          observaciones: '' },
      ],
      tarde: [
        { id: 'h3', conductor: 'María Silva', patente: 'WXYZ78', folio: '4975200',
          carga:    { '5 kg': 30, '11 kg': 40, '15 kg': 20, '45 kg': 0 },
          vendido:  { '5 kg': 27, '11 kg': 36, '15 kg': 19, '45 kg': 0 },
          sobrante: { '5 kg': 3,  '11 kg': 4,  '15 kg': 1,  '45 kg': 0 },
          observaciones: '' },
      ],
    },
    [ago(3)]: {
      manana_cerrado: true, tarde_cerrado: true,
      manana_cerrado_at: '14:02', tarde_cerrado_at: '21:30',
      manana: [
        { id: 'g1', conductor: 'Pedro Rodríguez', patente: 'EFGH34', folio: '4974700',
          carga:    { '5 kg': 40, '11 kg': 0, '15 kg': 0, '45 kg': 10 },
          vendido:  { '5 kg': 36, '11 kg': 0, '15 kg': 0, '45 kg': 9 },
          sobrante: { '5 kg': 4,  '11 kg': 0, '15 kg': 0, '45 kg': 1 },
          observaciones: '' },
      ],
      tarde: [
        { id: 'g2', conductor: 'Trans. Kevin Pardo EIR', patente: 'RFGF81', folio: '4974801',
          carga:    { '5 kg': 0, '11 kg': 0, '15 kg': 30, '45 kg': 0 },
          vendido:  { '5 kg': 0, '11 kg': 0, '15 kg': 28, '45 kg': 0 },
          sobrante: { '5 kg': 0, '11 kg': 0, '15 kg': 2,  '45 kg': 0 },
          observaciones: 'Mauricio: 1x45, 5x15' },
      ],
    },
    [ago(2)]: {
      manana_cerrado: true, tarde_cerrado: true,
      manana_cerrado_at: '13:58', tarde_cerrado_at: '20:55',
      manana: [
        { id: 'f1', conductor: 'María Silva', patente: 'WXYZ78', folio: '4974600',
          carga:    { '5 kg': 0, '11 kg': 40, '15 kg': 20, '45 kg': 5 },
          vendido:  { '5 kg': 0, '11 kg': 36, '15 kg': 18, '45 kg': 5 },
          sobrante: { '5 kg': 0, '11 kg': 4,  '15 kg': 2,  '45 kg': 0 },
          observaciones: '' },
      ],
      tarde: [
        { id: 'f2', conductor: 'Pedro Rodríguez', patente: 'EFGH34', folio: '4974650',
          carga:    { '5 kg': 0, '11 kg': 50, '15 kg': 0, '45 kg': 0 },
          vendido:  { '5 kg': 0, '11 kg': 45, '15 kg': 0, '45 kg': 0 },
          sobrante: { '5 kg': 0, '11 kg': 5,  '15 kg': 0, '45 kg': 0 },
          observaciones: '' },
      ],
    },
    [ago(1)]: {
      manana_cerrado: true, tarde_cerrado: true,
      manana_cerrado_at: '14:15', tarde_cerrado_at: '21:00',
      manana: [
        { id: 'e1', conductor: 'Trans. Kevin Pardo EIR', patente: 'RFGF81', folio: '4975050',
          carga:    { '5 kg': 7, '11 kg': 3, '15 kg': 24, '45 kg': 1 },
          vendido:  { '5 kg': 6, '11 kg': 3, '15 kg': 23, '45 kg': 1 },
          sobrante: { '5 kg': 1, '11 kg': 0, '15 kg': 1,  '45 kg': 0 },
          observaciones: 'GARANTIA X5' },
      ],
      tarde: [
        { id: 'e3', conductor: 'Carlos González', patente: 'ABCD12', folio: '4975101',
          carga:    { '5 kg': 0, '11 kg': 30, '15 kg': 15, '45 kg': 5 },
          vendido:  { '5 kg': 0, '11 kg': 27, '15 kg': 14, '45 kg': 5 },
          sobrante: { '5 kg': 0, '11 kg': 3,  '15 kg': 1,  '45 kg': 0 },
          observaciones: '' },
      ],
    },
    [toKey(today)]: { manana: [newFila()], tarde: [newFila()] },
  };
}

// ── Redimensionar imagen para mejorar OCR ─────────────────────────────────────
function resizeImage(dataUrl: string, maxWidth = 1800): Promise<string> {
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxWidth / img.width);
      const canvas = document.createElement('canvas');
      canvas.width  = img.width  * scale;
      canvas.height = img.height * scale;
      canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/png')); // PNG mejor para OCR
    };
    img.src = dataUrl;
  });
}

// ── Resultado de escaneo ───────────────────────────────────────────────────────
interface ScanResult {
  conductor?:    string | null;
  patente?:      string | null;
  folio?:        string | null;
  carga_45?:     number | null;
  carga_15?:     number | null;
  carga_11?:     number | null;
  carga_5?:      number | null;
  vendido_45?:   number | null;
  vendido_15?:   number | null;
  vendido_11?:   number | null;
  vendido_5?:    number | null;
  vendido_txt?:  string | null;
  observaciones?: string | null;
}

// ── Parsear texto OCR de una guía de despacho Abastible ───────────────────────
function parseGuiaOCR(raw: string): ScanResult {
  const t = raw.replace(/\r\n/g, '\n');
  const lines = t.split('\n').map(l => l.trim()).filter(Boolean);

  // ── FOLIO ──────────────────────────────────────────────────────────────────
  const folioM = t.match(/[Ff][Oo0][Ll1][Ii1][Oo0][^0-9]{0,8}(\d{5,8})/);
  let folio = folioM?.[1] ?? null;
  // Fallback: buscar número de 7 dígitos que empiece con 4 (folios Abastible)
  if (!folio) { const nums = t.match(/\b([4-9]\d{6})\b/g); if (nums) folio = nums[0]; }

  // ── CONDUCTOR ─────────────────────────────────────────────────────────────
  let conductor: string | null = null;
  // Busca específicamente "Nombre Chofer" (no la empresa)
  const choferInline = t.match(/[Nn]ombre\s+[Cc]h[oó]fer\s*:?\s*([^\n]{6,65})/i);
  if (choferInline) conductor = choferInline[1].trim();
  // Algunos OCR ponen el nombre en la línea siguiente al label
  if (!conductor) {
    for (let i = 0; i < lines.length - 1; i++) {
      if (/[Nn]ombre\s+[Cc]h[oó]fer/i.test(lines[i])) {
        const next = lines[i + 1];
        if (next && next.length > 5 && next.length < 70 && !/^\s*:/.test(next)) {
          conductor = next.trim(); break;
        }
      }
    }
  }
  // Fallback: label "Chofer" solo
  if (!conductor) {
    const soloChofer = t.match(/[Cc]h[oó]fer\s*:?\s*([^\n]{6,65})/i);
    if (soloChofer) conductor = soloChofer[1].trim();
  }
  // Fallback: líneas con TRANSPORTES/TRANS al inicio
  if (!conductor) {
    for (const l of lines) {
      if (/^TRANS(?:PORTE[S]?)?\s+\w/i.test(l) && l.length > 8 && l.length < 70) {
        conductor = l; break;
      }
    }
  }

  // ── PATENTE ────────────────────────────────────────────────────────────────
  // Intenta varias formas: "Patente Vehículo : RFGF81", "RFGF-81", etc.
  const patenteM = t.match(/[Pp]atente\s*(?:[Vv]eh[ií]culo)?\s*:?\s*([A-Z]{2,4}[-\s]?[A-Z0-9]{2,6})/);
  let patente = patenteM?.[1]?.replace(/[\s-]/g, '') ?? null;
  if (!patente) {
    // Formato patente chilena: 4 letras + 2 dígitos, o 2+2+2
    const pM = t.match(/\b([A-Z]{4}[-\s]?\d{2})\b/) ?? t.match(/\b([A-Z]{2}[-\s]?[A-Z]{2}[-\s]?\d{2})\b/);
    if (pM) patente = pM[1].replace(/[\s-]/g, '');
  }

  // ── CANTIDADES DE CILINDROS ────────────────────────────────────────────────
  // Tamaños conocidos — nunca deben devolverse como cantidad
  const KNOWN_SIZES = new Set([4, 5, 11, 15, 44, 45, 46]);

  // Encuentra la cantidad en una ventana de líneas, excluyendo el tamaño del cilindro
  function extractQty(window: string[], excludeSize: number): number {
    const excl = new Set([...KNOWN_SIZES, excludeSize]);
    // 1. Número al INICIO de alguna línea (columna CANTIDAD antes del texto)
    for (const l of window) {
      const m = l.match(/^(\d{1,4})\b/);
      if (m) {
        const n = parseInt(m[1]);
        if (!excl.has(n) && n >= 1 && n <= 9999) return n;
      }
    }
    // 2. Línea que es solo un número (columna separada por OCR)
    for (const l of window) {
      if (/^\d{1,4}$/.test(l)) {
        const n = parseInt(l);
        if (!excl.has(n) && n >= 1 && n <= 9999) return n;
      }
    }
    return 0; // sin fallback que devuelva el tamaño como cantidad
  }

  let carga_45 = 0, carga_15 = 0, carga_11 = 0, carga_5 = 0;

  for (let i = 0; i < lines.length; i++) {
    // Ventana: línea anterior + actual + siguiente (para cubrir columnas separadas por OCR)
    const window3 = lines.slice(Math.max(0, i - 1), Math.min(lines.length, i + 2));
    const window5 = lines.slice(Math.max(0, i - 2), Math.min(lines.length, i + 3));
    const combined = window5.join(' ');
    const line = lines[i];

    // Detectar tipo de cilindro — incluye "Cilindro de X kg" además de "Carga de gas X kg"
    const hasCylKw = /[Cc]arga|gas|[Cc]ilindro/i.test(combined);
    const has45  = /\b4[5sS]\b/.test(line) && hasCylKw;
    const has15  = /\b15\b/.test(line) && hasCylKw;
    const has11  = /\b11\b/.test(line) && hasCylKw;
    const has5   = /\b0?5\b/.test(line) && hasCylKw && !has15 && !has45;

    if (has45)  { const q = extractQty(window3, 45); if (q > 0) carga_45 = Math.max(carga_45, q); }
    if (has15)  { const q = extractQty(window3, 15); if (q > 0) carga_15 = Math.max(carga_15, q); }
    if (has11)  { const q = extractQty(window3, 11); if (q > 0) carga_11 = Math.max(carga_11, q); }
    if (has5)   { const q = extractQty(window3, 5);  if (q > 0) carga_5  = Math.max(carga_5,  q); }
  }

  // Escaneo global de anotaciones manuscritas tipo "2X45", "5X5", "24X15", "2X43"
  // (OCR puede leer "45" como "4S", "43", "4 5"; acepta rango cercano)
  for (const m of t.matchAll(/(\d{1,3})\s*[xX×]\s*(\d{1,3})/g)) {
    const qty  = parseInt(m[1]);
    const size = parseInt(m[2]);
    if (qty < 1 || qty > 200) continue;
    if (size >= 43 && size <= 47)  carga_45 = Math.max(carga_45, qty);
    else if (size === 15)          carga_15 = Math.max(carga_15, qty);
    else if (size === 11)          carga_11 = Math.max(carga_11, qty);
    else if (size >= 4 && size <= 6 && qty !== size) carga_5 = Math.max(carga_5, qty);
  }

  // ── VENTAS MANUSCRITAS ────────────────────────────────────────────────────
  // Busca líneas con "-" (descuento/venta) que contengan CantXTipo
  let vendido_45 = 0, vendido_15 = 0, vendido_11 = 0, vendido_5 = 0;
  const ventaTexts: string[] = [];

  for (const l of lines) {
    if (!/[-–]/.test(l)) continue; // solo líneas que empiezan/contienen guión
    for (const m of l.matchAll(/(\d{1,3})\s*[xX×\/]\s*(\d{1,3})/g)) {
      const qty  = parseInt(m[1]);
      const size = parseInt(m[2]);
      if (qty < 1 || qty > 100) continue;
      if (size >= 43 && size <= 47)  vendido_45 += qty;
      else if (size === 15)          vendido_15 += qty;
      else if (size === 11)          vendido_11 += qty;
      else if (size >= 4 && size <= 6) vendido_5 += qty;
    }
    if (l.length > 3 && l.length < 80) ventaTexts.push(l.trim());
  }
  const vendido_txt = ventaTexts.length > 0 ? ventaTexts.join('\n') : null;

  // ── OBSERVACIONES ─────────────────────────────────────────────────────────
  let observaciones: string | null = null;
  const garantiaM = t.match(/GARANTIA[^\n]{0,50}/i);
  if (garantiaM) observaciones = garantiaM[0].trim();
  const obsM = t.match(/(?:OBSERVACION(?:ES)?|RVACIONES)[:\s]*([^\n]{3,80})/i);
  if (!observaciones && obsM) observaciones = obsM[1].trim();

  return {
    conductor, patente, folio,
    carga_45, carga_15, carga_11, carga_5,
    vendido_45, vendido_15, vendido_11, vendido_5,
    vendido_txt, observaciones,
  };
}

// ── Parsear Planilla de Tránsito diaria (múltiples filas) ────────────────────
interface PlanillaFila {
  conductor: string;
  patente: string;
  carga_45: number;
  carga_15: number;
  carga_11: number;
  carga_5: number;
}

function parsePlanillaOCR(raw: string): PlanillaFila[] {
  const t = raw.replace(/\r\n/g, '\n');
  const lines = t.split('\n').map(l => l.trim()).filter(Boolean);
  const result: PlanillaFila[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Ancla: código de camión Abastible (EN####)
    if (!/\bEN\d{3,4}\b/i.test(line)) continue;

    // Contexto: esta línea + las 2 siguientes (OCR puede partir columnas)
    const ctx = lines.slice(i, Math.min(lines.length, i + 3)).join(' ');

    // Patente (formato chileno: XXXX-## o XXXX##)
    const patenteM = ctx.match(/\b([A-Z]{3,4}[-]?\d{2})\b/);
    const patente = patenteM ? patenteM[1].replace(/[-\s]/g, '') : '';

    // Conductor: texto entre la patente y el código de 8 dígitos del chofer
    let conductor = '';
    const nameM = ctx.match(/[A-Z]{3,4}[-]?\d{2}\s+([A-ZÁÉÍÓÚÑ\s\.\-]{6,65}?)\s+\d{7,9}\b/i);
    if (nameM) {
      conductor = nameM[1].trim();
    } else {
      // Fallback: buscar bloque TRANSP/TRANSPORTES
      const transpM = ctx.match(/(TRANSP(?:ORTE[S]?)?.{0,80}?)(?=\s+\d{7,9}\b|\s+(?:SI|NO)\b)/i);
      if (transpM) conductor = transpM[1].trim();
    }

    // Cantidades: después de SI/NO vienen 45N · 15N · 11N · 05N
    let q45 = 0, q15 = 0, q11 = 0, q5 = 0;
    const sinoM = ctx.match(/\b(SI|NO)\b/i);
    if (sinoM) {
      const after = ctx.slice((sinoM.index ?? 0) + sinoM[0].length);
      // Tomar los primeros 4 números (1-3 dígitos, rango razonable)
      const qtys = [...after.matchAll(/\b(\d{1,3})\b/g)]
        .map(m => parseInt(m[1]))
        .filter(n => n <= 500);
      [q45 = 0, q15 = 0, q11 = 0, q5 = 0] = qtys;
    }

    if (patente || conductor) {
      result.push({ conductor, patente: patente.toUpperCase(), carga_45: q45, carga_15: q15, carga_11: q11, carga_5: q5 });
    }
  }
  return result;
}

// ── Modal de escaneo (Tesseract.js — sin API externa) ─────────────────────────
function ScanModal({ onApply, onClose }: { onApply: (r: ScanResult) => void; onClose: () => void }) {
  const [images,   setImages]   = useState<string[]>([]);
  const [scanning, setScanning] = useState(false);
  const [scanIdx,  setScanIdx]  = useState(0);   // imagen actual siendo procesada
  const [progress, setProgress] = useState(0);
  const [status,   setStatus]   = useState('');
  const [result,   setResult]   = useState<ScanResult | null>(null);
  const [error,    setError]    = useState<string | null>(null);
  const [rawText,  setRawText]  = useState('');
  const [showRaw,  setShowRaw]  = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleScan() {
    if (images.length === 0) return;
    setScanning(true); setError(null); setResult(null); setRawText(''); setProgress(0);
    try {
      const worker = await createWorker('spa', 1, {
        logger: (m: { status: string; progress: number }) => {
          setStatus(m.status ?? '');
          // Progreso global: imagen actual + fracción de la actual
          const base = (scanIdx / images.length) * 100;
          const step = ((m.progress ?? 0) / images.length) * 100;
          setProgress(Math.round(base + step));
        },
      });

      let combined = '';
      for (let i = 0; i < images.length; i++) {
        setScanIdx(i);
        const resized = await resizeImage(images[i]);
        const { data: { text } } = await worker.recognize(resized);
        combined += (i > 0 ? '\n\n--- PÁGINA ' + (i + 1) + ' ---\n\n' : '') + text;
      }
      await worker.terminate();
      setProgress(100);
      setRawText(combined);
      setResult(parseGuiaOCR(combined));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error en el OCR');
    } finally {
      setScanning(false);
      setScanIdx(0);
    }
  }

  function addFiles(files: File[] | FileList) {
    Array.from(files).forEach(file => {
      const reader = new FileReader();
      reader.onload = e => {
        setImages(prev => [...prev, e.target?.result as string]);
        setResult(null); setError(null); setRawText('');
      };
      reader.readAsDataURL(file);
    });
  }

  // Pegar imagen desde el portapapeles (Ctrl+V / Cmd+V)
  useEffect(() => {
    function onPaste(e: ClipboardEvent) {
      const items = e.clipboardData?.items;
      if (!items) return;
      const imgs = Array.from(items)
        .filter(it => it.type.startsWith('image/'))
        .map(it => it.getAsFile())
        .filter((f): f is File => f !== null);
      if (imgs.length > 0) addFiles(imgs);
    }
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function removeImage(idx: number) {
    setImages(prev => prev.filter((_, i) => i !== idx));
    setResult(null); setRawText('');
  }

  const statusLabel: Record<string, string> = {
    'loading tesseract core':       'Cargando motor OCR...',
    'loading language traineddata': 'Descargando idioma (primera vez)...',
    'initializing api':             'Iniciando...',
    'recognizing text':             'Leyendo texto...',
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ background: '#141820', border: '1px solid #1e2432', borderRadius: 12, width: '100%', maxWidth: 540, maxHeight: '92vh', overflow: 'auto', display: 'flex', flexDirection: 'column' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '13px 16px', borderBottom: '1px solid #1e2432', flexShrink: 0 }}>
          <Camera size={16} style={{ color: '#f97316' }} />
          <span style={{ color: '#fff', fontWeight: 700, fontSize: 14 }}>Escanear Guía de Despacho</span>
          <span style={{ fontSize: 10, color: '#4a5568', marginLeft: 4 }}>• OCR local</span>
          <button onClick={onClose} style={{ marginLeft: 'auto', color: '#4a5568', background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex' }}>
            <X size={16} />
          </button>
        </div>

        <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12, overflowY: 'auto' }}>

          {/* Miniaturas de imágenes */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <p style={{ fontSize: 10, color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', margin: 0 }}>
                Fotos de la guía {images.length > 0 && <span style={{ color: '#f97316' }}>({images.length})</span>}
              </p>
              {images.length > 0 && (
                <button onClick={() => { setImages([]); setResult(null); setRawText(''); }}
                  style={{ fontSize: 10, color: '#4a5568', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>
                  Quitar todas
                </button>
              )}
            </div>

            {/* Grid de miniaturas */}
            {images.length > 0 && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 8, marginBottom: 8 }}>
                {images.map((img, idx) => (
                  <div key={idx} style={{ position: 'relative', aspectRatio: '3/4' }}>
                    <img src={img} alt={`página ${idx + 1}`}
                      style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 7, border: scanning && scanIdx === idx ? '2px solid #f97316' : '1px solid #2d3748', background: '#0d1117' }} />
                    {/* Indicador de página siendo escaneada */}
                    {scanning && scanIdx === idx && (
                      <div style={{ position: 'absolute', inset: 0, background: 'rgba(249,115,22,0.15)', borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Loader2 size={20} className="animate-spin" style={{ color: '#f97316' }} />
                      </div>
                    )}
                    {/* Número de página */}
                    <div style={{ position: 'absolute', bottom: 4, left: 4, background: '#0d1117cc', borderRadius: 4, padding: '1px 5px', fontSize: 10, color: '#94a3b8', fontWeight: 700 }}>
                      {idx + 1}
                    </div>
                    {/* Botón quitar */}
                    {!scanning && (
                      <button onClick={() => removeImage(idx)}
                        style={{ position: 'absolute', top: 4, right: 4, background: '#0d1117cc', border: '1px solid #2d3748', borderRadius: 5, color: '#94a3b8', cursor: 'pointer', padding: 3, display: 'flex' }}>
                        <X size={11} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Input oculto — acepta múltiples archivos */}
            <input ref={fileRef} type="file" accept="image/*" multiple
              onChange={e => e.target.files && addFiles(e.target.files)}
              style={{ display: 'none' }} />

            {/* Botón agregar */}
            <button onClick={() => { if (fileRef.current) { fileRef.current.value = ''; fileRef.current.click(); } }}
              disabled={scanning}
              style={{
                width: '100%', padding: images.length === 0 ? '28px 16px' : '10px 16px',
                background: '#1a1d23', border: '2px dashed #2d3748', borderRadius: 8,
                color: '#4a5568', cursor: scanning ? 'not-allowed' : 'pointer',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
              }}>
              <Camera size={images.length === 0 ? 28 : 16} />
              <span style={{ fontSize: 13 }}>
                {images.length === 0 ? 'Agregar foto(s) de la guía' : '+ Agregar otra foto'}
              </span>
              {images.length === 0 && (
                <span style={{ fontSize: 11, color: '#2d3748' }}>
                  Selecciona archivos o pega con <kbd style={{ background: '#2d3748', color: '#94a3b8', borderRadius: 3, padding: '1px 5px', fontSize: 10, fontFamily: 'monospace' }}>Ctrl+V</kbd>
                </span>
              )}
            </button>
          </div>

          {/* Botón escanear */}
          {images.length > 0 && !scanning && (
            <button onClick={handleScan}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '10px 16px', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', width: '100%', background: '#431407', color: '#fb923c', border: '1px solid #fb923c40' }}>
              <Camera size={15} />
              {images.length === 1 ? 'Leer guía automáticamente' : `Leer ${images.length} imágenes`}
            </button>
          )}

          {/* Progreso OCR */}
          {scanning && (
            <div style={{ background: '#0d1117', border: '1px solid #1e2432', borderRadius: 8, padding: '12px 14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <Loader2 size={14} className="animate-spin" style={{ color: '#f97316' }} />
                <span style={{ fontSize: 12, color: '#94a3b8' }}>
                  {images.length > 1 ? `Imagen ${scanIdx + 1} de ${images.length} — ` : ''}
                  {statusLabel[status] ?? status ?? 'Procesando...'}
                </span>
                <span style={{ marginLeft: 'auto', fontSize: 12, fontWeight: 700, color: '#f97316' }}>{progress}%</span>
              </div>
              <div style={{ background: '#1e2432', borderRadius: 4, height: 6, overflow: 'hidden' }}>
                <div style={{ height: '100%', background: '#f97316', borderRadius: 4, width: `${progress}%`, transition: 'width 0.3s ease' }} />
              </div>
              {progress < 10 && (
                <p style={{ fontSize: 10, color: '#4a5568', margin: '6px 0 0' }}>
                  La primera vez descarga el idioma (~4 MB). Las siguientes son más rápidas.
                </p>
              )}
            </div>
          )}

          {error && (
            <div style={{ padding: '10px 12px', background: '#2d1515', border: '1px solid #4a1515', borderRadius: 8, color: '#fca5a5', fontSize: 12 }}>
              <strong>Error:</strong> {error}
            </div>
          )}

          {/* Resultado */}
          {result && (
            <div style={{ background: '#0c1824', border: '1px solid #1a3a5c', borderRadius: 10, padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
              <p style={{ fontSize: 11, color: '#60a5fa', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', margin: 0 }}>
                Información extraída — verifica y corrige si es necesario
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <RItem label="Conductor" value={result.conductor} />
                <RItem label="Patente"   value={result.patente} />
                <RItem label="Folio"     value={result.folio} />
              </div>

              <div>
                <p style={{ fontSize: 10, color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 6px' }}>Carga detectada</p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 6 }}>
                  <RNum label="45 kg" value={result.carga_45} />
                  <RNum label="15 kg" value={result.carga_15} />
                  <RNum label="11 kg" value={result.carga_11} />
                  <RNum label="5 kg"  value={result.carga_5} />
                </div>
              </div>

              {(result.vendido_45 || result.vendido_15 || result.vendido_11 || result.vendido_5) ? (
                <div>
                  <p style={{ fontSize: 10, color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 6px' }}>Vendido (manuscrito)</p>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 6 }}>
                    <RNum label="45 kg" value={result.vendido_45} color="#34d399" />
                    <RNum label="15 kg" value={result.vendido_15} color="#34d399" />
                    <RNum label="11 kg" value={result.vendido_11} color="#34d399" />
                    <RNum label="5 kg"  value={result.vendido_5}  color="#34d399" />
                  </div>
                </div>
              ) : null}
              {result.vendido_txt   && <RItem label="Notas de venta"  value={result.vendido_txt} />}
              {result.observaciones && <RItem label="Observaciones"   value={result.observaciones} />}

              {rawText && (
                <div>
                  <button onClick={() => setShowRaw(v => !v)}
                    style={{ fontSize: 10, color: '#4a5568', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', padding: 0 }}>
                    {showRaw ? 'Ocultar' : 'Ver'} texto OCR completo
                  </button>
                  {showRaw && (
                    <pre style={{ marginTop: 6, background: '#0d1117', border: '1px solid #1e2432', borderRadius: 6, padding: 8, fontSize: 10, color: '#64748b', overflowX: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-word', maxHeight: 160 }}>
                      {rawText}
                    </pre>
                  )}
                </div>
              )}

              <button onClick={() => onApply(result)}
                style={{ marginTop: 2, padding: '9px 16px', background: '#0f2318', color: '#4ade80', border: '1px solid #4ade8030', borderRadius: 7, fontSize: 13, fontWeight: 700, cursor: 'pointer', width: '100%' }}>
                Aplicar a la fila
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Modal Planilla de Tránsito diaria ─────────────────────────────────────────
function PlanillaModal({ onApply, onClose }: {
  onApply: (rows: PlanillaFila[], turno: 'manana' | 'tarde') => void;
  onClose: () => void;
}) {
  const [image,    setImage]    = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status,   setStatus]   = useState('');
  const [rows,     setRows]     = useState<PlanillaFila[] | null>(null);
  const [error,    setError]    = useState<string | null>(null);
  const [rawText,  setRawText]  = useState('');
  const [showRaw,  setShowRaw]  = useState(false);
  const [turno,    setTurno]    = useState<'manana' | 'tarde'>('manana');
  const fileRef = useRef<HTMLInputElement>(null);

  const statusLabel: Record<string, string> = {
    'loading tesseract core':       'Cargando motor OCR...',
    'loading language traineddata': 'Descargando idioma (primera vez)...',
    'initializing api':             'Iniciando...',
    'recognizing text':             'Leyendo planilla...',
  };

  async function handleScan() {
    if (!image) return;
    setScanning(true); setError(null); setRows(null); setRawText(''); setProgress(0);
    try {
      const worker = await createWorker('spa', 1, {
        logger: (m: { status: string; progress: number }) => {
          setStatus(m.status ?? '');
          setProgress(Math.round((m.progress ?? 0) * 100));
        },
      });
      const resized = await resizeImage(image, 2400); // más ancho para tabla
      const { data: { text } } = await worker.recognize(resized);
      await worker.terminate();
      setProgress(100);
      setRawText(text);
      const parsed = parsePlanillaOCR(text);
      setRows(parsed);
      if (parsed.length === 0) setError('No se detectaron filas. Intenta con la planilla bien iluminada y sin inclinación.');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error en el OCR');
    } finally {
      setScanning(false);
    }
  }

  function addFile(file: File) {
    const reader = new FileReader();
    reader.onload = e => { setImage(e.target?.result as string); setRows(null); setError(null); setRawText(''); };
    reader.readAsDataURL(file);
  }

  useEffect(() => {
    function onPaste(e: ClipboardEvent) {
      const items = e.clipboardData?.items;
      if (!items) return;
      const img = Array.from(items).find(it => it.type.startsWith('image/'));
      if (img) { const f = img.getAsFile(); if (f) addFile(f); }
    }
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function updateRow(idx: number, patch: Partial<PlanillaFila>) {
    setRows(prev => prev ? prev.map((r, i) => i === idx ? { ...r, ...patch } : r) : prev);
  }
  function removeRow(idx: number) {
    setRows(prev => prev ? prev.filter((_, i) => i !== idx) : prev);
  }

  const numStyle: React.CSSProperties = {
    width: 36, textAlign: 'right', background: 'transparent', border: 'none', outline: 'none',
    color: '#e2e8f0', fontSize: 12, fontFamily: '"Courier New", monospace', padding: '3px 4px',
  };
  const thStyle: React.CSSProperties = {
    border: '1px solid #1e2432', padding: '4px 6px', fontSize: 10, fontWeight: 700,
    textTransform: 'uppercase', letterSpacing: 1, textAlign: 'center',
    background: '#0d1117', color: '#4a5568', whiteSpace: 'nowrap',
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ background: '#141820', border: '1px solid #1e2432', borderRadius: 12, width: '100%', maxWidth: 760, maxHeight: '94vh', overflow: 'auto', display: 'flex', flexDirection: 'column' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '13px 16px', borderBottom: '1px solid #1e2432', flexShrink: 0 }}>
          <Camera size={16} style={{ color: '#f97316' }} />
          <span style={{ color: '#fff', fontWeight: 700, fontSize: 14 }}>Cargar Planilla de Tránsito</span>
          <span style={{ fontSize: 10, color: '#4a5568', marginLeft: 4 }}>• carga múltiples camiones a la vez</span>
          <button onClick={onClose} style={{ marginLeft: 'auto', color: '#4a5568', background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex' }}>
            <X size={16} />
          </button>
        </div>

        <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12, overflowY: 'auto' }}>

          {/* Hint */}
          <div style={{ background: '#1a1d23', border: '1px solid #2d3748', borderRadius: 8, padding: '8px 12px', fontSize: 11, color: '#64748b' }}>
            Fotografía la planilla con el papel <strong style={{ color: '#94a3b8' }}>horizontal y bien iluminado</strong>, sin inclinación, para que el OCR pueda leer las columnas correctamente.
          </div>

          {/* Input imagen */}
          <input ref={fileRef} type="file" accept="image/*" onChange={e => e.target.files?.[0] && addFile(e.target.files[0])} style={{ display: 'none' }} />

          {image ? (
            <div style={{ position: 'relative', maxHeight: 220, overflow: 'hidden', borderRadius: 8, border: '1px solid #2d3748' }}>
              <img src={image} alt="planilla" style={{ width: '100%', objectFit: 'contain', maxHeight: 220, background: '#0d1117' }} />
              {!scanning && (
                <button onClick={() => { setImage(null); setRows(null); setRawText(''); }}
                  style={{ position: 'absolute', top: 6, right: 6, background: '#0d1117cc', border: '1px solid #2d3748', borderRadius: 5, color: '#94a3b8', cursor: 'pointer', padding: '3px 7px', fontSize: 11 }}>
                  Cambiar foto
                </button>
              )}
            </div>
          ) : (
            <button onClick={() => { if (fileRef.current) { fileRef.current.value = ''; fileRef.current.click(); } }}
              style={{ width: '100%', padding: '32px 16px', background: '#1a1d23', border: '2px dashed #2d3748', borderRadius: 8, color: '#4a5568', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
              <Camera size={32} />
              <span style={{ fontSize: 13 }}>Agregar foto de la planilla</span>
              <span style={{ fontSize: 11, color: '#2d3748' }}>
                O pega con <kbd style={{ background: '#2d3748', color: '#94a3b8', borderRadius: 3, padding: '1px 5px', fontSize: 10, fontFamily: 'monospace' }}>Ctrl+V</kbd>
              </span>
            </button>
          )}

          {/* Botón escanear */}
          {image && !scanning && !rows && (
            <button onClick={handleScan}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '10px 16px', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', width: '100%', background: '#431407', color: '#fb923c', border: '1px solid #fb923c40' }}>
              <Camera size={15} /> Leer planilla completa
            </button>
          )}

          {/* Progreso */}
          {scanning && (
            <div style={{ background: '#0d1117', border: '1px solid #1e2432', borderRadius: 8, padding: '12px 14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <Loader2 size={14} className="animate-spin" style={{ color: '#f97316' }} />
                <span style={{ fontSize: 12, color: '#94a3b8' }}>{statusLabel[status] ?? status ?? 'Procesando...'}</span>
                <span style={{ marginLeft: 'auto', fontSize: 12, fontWeight: 700, color: '#f97316' }}>{progress}%</span>
              </div>
              <div style={{ background: '#1e2432', borderRadius: 4, height: 6, overflow: 'hidden' }}>
                <div style={{ height: '100%', background: '#f97316', borderRadius: 4, width: `${progress}%`, transition: 'width 0.3s ease' }} />
              </div>
            </div>
          )}

          {error && (
            <div style={{ padding: '10px 12px', background: '#2d1515', border: '1px solid #4a1515', borderRadius: 8, color: '#fca5a5', fontSize: 12 }}>
              <strong>Error:</strong> {error}
            </div>
          )}

          {/* Tabla de preview */}
          {rows && rows.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <p style={{ fontSize: 11, color: '#60a5fa', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', margin: 0 }}>
                  {rows.length} camión{rows.length !== 1 ? 'es' : ''} detectados — edita si es necesario
                </p>
                <button onClick={() => setRows(null)}
                  style={{ fontSize: 10, color: '#4a5568', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>
                  Volver a escanear
                </button>
              </div>

              <div style={{ overflowX: 'auto', borderRadius: 8, border: '1px solid #1e2432' }}>
                <table style={{ borderCollapse: 'collapse', minWidth: '100%', background: '#0d1117', fontSize: 12 }}>
                  <thead>
                    <tr>
                      <th style={thStyle}>#</th>
                      <th style={{ ...thStyle, minWidth: 60, textAlign: 'left' }}>Patente</th>
                      <th style={{ ...thStyle, minWidth: 180, textAlign: 'left' }}>Conductor</th>
                      <th style={{ ...thStyle, color: '#94a3b8' }} colSpan={4}>Cargó</th>
                      <th style={{ ...thStyle, width: 28 }}></th>
                    </tr>
                    <tr>
                      <th style={thStyle}></th>
                      <th style={thStyle}></th>
                      <th style={thStyle}></th>
                      {(['45', '15', '11', '5'] as const).map(s => (
                        <th key={s} style={thStyle}>{s}</th>
                      ))}
                      <th style={thStyle}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, idx) => (
                      <tr key={idx} style={{ background: idx % 2 === 0 ? '#0d1117' : '#111420' }}>
                        <td style={{ border: '1px solid #1e2432', textAlign: 'center', fontSize: 11, color: '#2d3748', padding: '0 4px', fontFamily: 'monospace' }}>{idx + 1}</td>
                        <td style={{ border: '1px solid #1e2432', padding: 0 }}>
                          <input value={row.patente} onChange={e => updateRow(idx, { patente: e.target.value.toUpperCase() })}
                            style={{ ...numStyle, width: 72, textAlign: 'left', color: '#e2e8f0', letterSpacing: 1 }} />
                        </td>
                        <td style={{ border: '1px solid #1e2432', padding: 0 }}>
                          <input value={row.conductor} onChange={e => updateRow(idx, { conductor: e.target.value })}
                            style={{ ...numStyle, width: '100%', minWidth: 180, textAlign: 'left', color: row.conductor ? '#e2e8f0' : '#4a5568' }}
                            placeholder="Conductor..." />
                        </td>
                        {(['carga_45', 'carga_15', 'carga_11', 'carga_5'] as const).map(k => (
                          <td key={k} style={{ border: '1px solid #1e2432', padding: 0 }}>
                            <input type="number" min={0} value={row[k] || ''} placeholder="0"
                              onChange={e => updateRow(idx, { [k]: Math.max(0, parseInt(e.target.value) || 0) })}
                              style={numStyle} />
                          </td>
                        ))}
                        <td style={{ border: '1px solid #1e2432', textAlign: 'center', padding: 0 }}>
                          <button onClick={() => removeRow(idx)} style={{ color: '#2d3748', background: 'none', border: 'none', cursor: 'pointer', padding: 6, display: 'flex', margin: 'auto' }}>
                            <X size={12} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Texto OCR */}
              {rawText && (
                <button onClick={() => setShowRaw(v => !v)}
                  style={{ fontSize: 10, color: '#4a5568', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', padding: 0, alignSelf: 'flex-start' }}>
                  {showRaw ? 'Ocultar' : 'Ver'} texto OCR completo
                </button>
              )}
              {showRaw && rawText && (
                <pre style={{ background: '#0d1117', border: '1px solid #1e2432', borderRadius: 6, padding: 8, fontSize: 10, color: '#64748b', overflowX: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-word', maxHeight: 160 }}>
                  {rawText}
                </pre>
              )}

              {/* Selector de turno y botón aplicar */}
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <span style={{ fontSize: 12, color: '#64748b' }}>Cargar en turno:</span>
                {(['manana', 'tarde'] as const).map(t => (
                  <button key={t} onClick={() => setTurno(t)}
                    style={{
                      padding: '6px 14px', borderRadius: 7, fontSize: 12, fontWeight: 700, cursor: 'pointer',
                      background: turno === t ? '#1e3a5f' : '#1a1d23',
                      color: turno === t ? '#60a5fa' : '#4a5568',
                      border: `1px solid ${turno === t ? '#60a5fa40' : '#2d3748'}`,
                    }}>
                    {t === 'manana' ? '☀ Mañana' : '🌙 Tarde'}
                  </button>
                ))}
                <button onClick={() => onApply(rows, turno)}
                  style={{ marginLeft: 'auto', padding: '8px 20px', background: '#0f2318', color: '#4ade80', border: '1px solid #4ade8030', borderRadius: 7, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                  Cargar {rows.length} camión{rows.length !== 1 ? 'es' : ''} →
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function RItem({ label, value }: { label: string; value?: string | null }) {
  return (
    <div style={{ background: '#0d1117', borderRadius: 6, padding: '6px 9px' }}>
      <div style={{ fontSize: 10, color: '#4a5568', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 12, color: value ? '#e2e8f0' : '#2d3748', wordBreak: 'break-word' }}>{value || '—'}</div>
    </div>
  );
}

function RNum({ label, value, color = '#60a5fa' }: { label: string; value?: number | null; color?: string }) {
  const v = value ?? 0;
  return (
    <div style={{ background: '#0d1117', borderRadius: 6, padding: '6px 4px', textAlign: 'center' }}>
      <div style={{ fontSize: 18, fontWeight: 800, color: v > 0 ? color : '#1e2432', fontFamily: 'monospace', lineHeight: 1 }}>{v}</div>
      <div style={{ fontSize: 10, color: '#4a5568', marginTop: 3 }}>{label}</div>
    </div>
  );
}

// ── Celda número ───────────────────────────────────────────────────────────────
function NumCell({ value, onChange, accentColor, locked }: {
  value: number; onChange: (n: number) => void; accentColor?: string; locked?: boolean;
}) {
  return (
    <td style={{ border: '1px solid #1e2432', padding: 0, minWidth: 44, width: 44 }}>
      <input type="number" min={0} value={value === 0 ? '' : value} placeholder="0" readOnly={locked}
        onChange={e => !locked && onChange(Math.max(0, parseInt(e.target.value) || 0))}
        onFocus={e => !locked && (e.target as HTMLInputElement).select()}
        style={{
          width: '100%', textAlign: 'right', background: 'transparent', border: 'none', outline: 'none',
          color: locked
            ? (value === 0 ? '#1e2432' : accentColor ? accentColor + 'aa' : '#4a5568')
            : (value === 0 ? '#2d3748' : (accentColor ?? '#e2e8f0')),
          padding: '5px 6px', fontSize: 12, fontFamily: '"Courier New", monospace', fontWeight: value > 0 ? 600 : 400,
          cursor: locked ? 'default' : 'text',
        }} />
    </td>
  );
}

// ── Celda texto ────────────────────────────────────────────────────────────────
function TxtCell({ value, onChange, placeholder = '', mono = false, minWidth = 100, locked }: {
  value: string; onChange: (s: string) => void; placeholder?: string; mono?: boolean; minWidth?: number; locked?: boolean;
}) {
  return (
    <td style={{ border: '1px solid #1e2432', padding: 0, minWidth }}>
      <input type="text" value={value} placeholder={locked ? '' : placeholder} readOnly={locked}
        onChange={e => !locked && onChange(e.target.value)}
        style={{
          width: '100%', background: 'transparent', border: 'none', outline: 'none',
          color: locked ? (value ? '#4a5568' : '#1e2432') : (value ? '#e2e8f0' : '#2d3748'),
          padding: '5px 8px', fontSize: 12,
          fontFamily: mono ? '"Courier New", monospace' : 'inherit',
          letterSpacing: mono ? 1 : 0, cursor: locked ? 'default' : 'text',
        }} />
    </td>
  );
}

// ── Tabla de turno ─────────────────────────────────────────────────────────────
function TurnoTable({ label, accentColor, icon, filas, cerrado, cerrado_at, onChange, onAdd, onDelete, onCerrar, onScan }: {
  label: string; accentColor: string; icon: React.ReactNode;
  filas: Fila[]; cerrado?: boolean; cerrado_at?: string;
  onChange: (id: string, patch: Partial<Fila>) => void;
  onAdd: () => void; onDelete: (id: string) => void;
  onCerrar: () => void; onScan: (id: string) => void;
}) {
  const [confirmando, setConfirmando] = useState(false);

  function setCant(fila: Fila, campo: 'carga' | 'vendido' | 'sobrante', tipo: TipoKey, val: number): Partial<Fila> {
    return { [campo]: { ...fila[campo], [tipo]: val } };
  }

  const tot = { carga: emptyMap(), vendido: emptyMap(), sobrante: emptyMap() };
  TIPOS.forEach(t => {
    tot.carga[t]    = filas.reduce((s, f) => s + f.carga[t],    0);
    tot.vendido[t]  = filas.reduce((s, f) => s + f.vendido[t],  0);
    tot.sobrante[t] = filas.reduce((s, f) => s + f.sobrante[t], 0);
  });

  const th = (extra?: React.CSSProperties): React.CSSProperties => ({
    border: '1px solid #1e2432', padding: '4px 6px', fontSize: 10, fontWeight: 700,
    textTransform: 'uppercase', letterSpacing: 1, textAlign: 'center', whiteSpace: 'nowrap',
    background: cerrado ? '#08090d' : '#0d1117', color: '#4a5568', userSelect: 'none', ...extra,
  });

  const groupTh = (color: string): React.CSSProperties => ({
    ...th(), color: cerrado ? color + '55' : color, borderBottom: `2px solid ${cerrado ? color + '30' : color}`, fontSize: 10,
  });

  const totTd = (color?: string): React.CSSProperties => ({
    border: '1px solid #1e2432', textAlign: 'right', padding: '4px 6px', fontSize: 12,
    fontWeight: 700, fontFamily: '"Courier New", monospace',
    color: cerrado ? (color ?? '#4a5568') + 'aa' : (color ?? '#64748b'),
    background: cerrado ? '#06080b' : '#0a0e17',
  });

  return (
    <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #1e2432', opacity: cerrado ? 0.85 : 1 }}>

      {/* Encabezado */}
      <div className="flex items-center gap-2.5 px-4 py-2.5"
        style={{ background: cerrado ? '#08090d' : '#0d1117', borderBottom: `2px solid ${accentColor}${cerrado ? '20' : '40'}` }}>
        {icon}
        <span className="text-sm font-bold" style={{ color: cerrado ? accentColor + '70' : accentColor }}>{label}</span>

        {cerrado ? (
          <div className="ml-auto flex items-center gap-2">
            <Lock size={12} style={{ color: '#4a5568' }} />
            <span className="text-[11px]" style={{ color: '#4a5568' }}>Cerrado{cerrado_at ? ` a las ${cerrado_at}` : ''}</span>
          </div>
        ) : confirmando ? (
          <div className="ml-auto flex items-center gap-2">
            <AlertTriangle size={13} style={{ color: '#f59e0b' }} />
            <span className="text-[11px] font-semibold" style={{ color: '#f59e0b' }}>¿Confirmar cierre? No se podrá editar.</span>
            <button onClick={() => { onCerrar(); setConfirmando(false); }}
              className="text-[11px] font-bold px-3 py-1 rounded-lg"
              style={{ background: '#7f1d1d', color: '#fca5a5' }}>Cerrar turno</button>
            <button onClick={() => setConfirmando(false)}
              className="text-[11px] px-2 py-1 rounded-lg"
              style={{ background: '#1e2432', color: '#4a5568' }}>Cancelar</button>
          </div>
        ) : (
          <div className="ml-auto flex items-center gap-3">
            <span className="text-[11px]" style={{ color: '#4a5568' }}>{filas.length} camión{filas.length !== 1 ? 'es' : ''}</span>
            <button onClick={() => setConfirmando(true)}
              className="flex items-center gap-1.5 text-[11px] font-semibold px-3 py-1.5 rounded-lg hover:opacity-80"
              style={{ background: '#1e2432', color: '#64748b', border: '1px solid #2d3748' }}>
              <LockOpen size={12} /> Cerrar turno
            </button>
          </div>
        )}
      </div>

      {/* Tabla */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ borderCollapse: 'collapse', minWidth: '100%', background: cerrado ? '#0d1017' : '#151b2e' }}>
          <thead>
            <tr>
              <th style={th({ width: 26 })}>#</th>
              {!cerrado && <th style={th({ width: 28 })}></th>}
              <th style={th({ minWidth: 110, textAlign: 'left' })}>Conductor</th>
              <th style={th({ minWidth: 64, textAlign: 'left' })}>Patente</th>
              <th style={th({ minWidth: 72, textAlign: 'left' })}>Folio</th>
              <th colSpan={4} style={groupTh('#94a3b8')}>Cargó</th>
              <th colSpan={4} style={groupTh('#34d399')}>Vendió</th>
              <th colSpan={4} style={groupTh('#fbbf24')}>Sobrante</th>
              <th style={th({ minWidth: 140, textAlign: 'left' })}>Observaciones</th>
              <th style={th({ width: 28 })}>✓</th>
              {!cerrado && <th style={th({ width: 28 })}></th>}
            </tr>
            <tr>
              <th style={th()}></th>
              {!cerrado && <th style={th()}></th>}
              <th style={th()}></th>
              <th style={th()}></th>
              <th style={th()}></th>
              {TIPOS.map(t => <th key={`ch${t}`} style={th()}>{t.replace(' kg', '')}</th>)}
              {TIPOS.map(t => <th key={`vh${t}`} style={th({ color: cerrado ? '#34d39955' : '#34d399' })}>{t.replace(' kg', '')}</th>)}
              {TIPOS.map(t => <th key={`sh${t}`} style={th({ color: cerrado ? '#fbbf2455' : '#fbbf24' })}>{t.replace(' kg', '')}</th>)}
              <th style={th()}></th>
              <th style={th()}></th>
              {!cerrado && <th style={th()}></th>}
            </tr>
          </thead>

          <tbody>
            {filas.map((f, idx) => {
              const c = cuadraFila(f);
              const rowBg = cerrado
                ? (idx % 2 === 0 ? '#0d1017' : '#0a0c13')
                : (idx % 2 === 0 ? '#151b2e' : '#111623');
              return (
                <tr key={f.id} style={{ background: rowBg }}>
                  <td style={{ border: '1px solid #1e2432', textAlign: 'center', fontSize: 11, color: '#2d3748', padding: '0 4px', fontFamily: 'monospace' }}>
                    {idx + 1}
                  </td>

                  {/* Botón escanear */}
                  {!cerrado && (
                    <td style={{ border: '1px solid #1e2432', textAlign: 'center', padding: 0 }}>
                      <button onClick={() => onScan(f.id)}
                        title="Escanear guía"
                        style={{ color: '#f97316', background: 'none', border: 'none', cursor: 'pointer', padding: 6, display: 'flex', margin: 'auto' }}>
                        <Camera size={13} />
                      </button>
                    </td>
                  )}

                  <TxtCell value={f.conductor} onChange={v => onChange(f.id, { conductor: v })} placeholder="Conductor..." locked={cerrado} />
                  <TxtCell value={f.patente} onChange={v => onChange(f.id, { patente: v.toUpperCase() })} placeholder="PAT123" mono minWidth={64} locked={cerrado} />
                  <TxtCell value={f.folio} onChange={v => onChange(f.id, { folio: v })} placeholder="Folio" mono minWidth={72} locked={cerrado} />

                  {TIPOS.map(t => <NumCell key={`c${t}`} value={f.carga[t]} onChange={n => onChange(f.id, setCant(f, 'carga', t, n))} locked={cerrado} />)}
                  {TIPOS.map(t => <NumCell key={`v${t}`} value={f.vendido[t]} accentColor="#34d399" onChange={n => onChange(f.id, setCant(f, 'vendido', t, n))} locked={cerrado} />)}
                  {TIPOS.map(t => <NumCell key={`s${t}`} value={f.sobrante[t]} accentColor="#fbbf24" onChange={n => onChange(f.id, setCant(f, 'sobrante', t, n))} locked={cerrado} />)}

                  <TxtCell value={f.observaciones} onChange={v => onChange(f.id, { observaciones: v })} placeholder="Observaciones..." minWidth={140} locked={cerrado} />

                  <td style={{ border: '1px solid #1e2432', textAlign: 'center', padding: 0 }}>
                    {c === true  && <CheckCircle2 size={13} className="mx-auto" style={{ color: cerrado ? '#34d39966' : '#34d399' }} />}
                    {c === false && <XCircle      size={13} className="mx-auto" style={{ color: cerrado ? '#f8717166' : '#f87171' }} />}
                  </td>

                  {!cerrado && (
                    <td style={{ border: '1px solid #1e2432', textAlign: 'center', padding: 0 }}>
                      <button onClick={() => onDelete(f.id)} className="p-1.5 hover:text-red-400" style={{ color: '#2d3748', display: 'flex', margin: 'auto', background: 'none', border: 'none', cursor: 'pointer' }}>
                        <Trash2 size={12} />
                      </button>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>

          {/* Totales */}
          <tfoot>
            <tr>
              <td colSpan={cerrado ? 4 : 5} style={{ ...totTd(), textAlign: 'left', padding: '4px 10px', fontSize: 10, textTransform: 'uppercase', letterSpacing: 1, color: '#4a5568' }}>Total</td>
              {TIPOS.map(t => <td key={`ct${t}`} style={totTd()}>{tot.carga[t]    > 0 ? tot.carga[t]    : ''}</td>)}
              {TIPOS.map(t => <td key={`vt${t}`} style={totTd('#34d399')}>{tot.vendido[t]  > 0 ? tot.vendido[t]  : ''}</td>)}
              {TIPOS.map(t => <td key={`st${t}`} style={totTd('#fbbf24')}>{tot.sobrante[t] > 0 ? tot.sobrante[t] : ''}</td>)}
              <td colSpan={cerrado ? 2 : 3} style={totTd()}></td>
            </tr>
          </tfoot>
        </table>
      </div>

      {cerrado ? (
        <div className="flex items-center gap-2 px-4 py-2" style={{ background: '#06080b', borderTop: '1px solid #1e2432' }}>
          <Lock size={11} style={{ color: '#2d3748' }} />
          <span className="text-[11px]" style={{ color: '#2d3748' }}>Este turno está cerrado y no puede modificarse</span>
        </div>
      ) : (
        <button onClick={onAdd} className="flex items-center gap-2 w-full px-4 py-2.5 hover:bg-white/5"
          style={{ borderTop: '1px solid #1e2432', color: '#4a5568', background: 'none', border: 'none', cursor: 'pointer' }}>
          <Plus size={13} />
          <span className="text-[12px]">Agregar fila</span>
        </button>
      )}
    </div>
  );
}

// ── Persistencia localStorage ──────────────────────────────────────────────────
const LS_KEY = 'abastible_transito_v1';

function loadData(): Record<string, DiaData> {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) {
      const parsed: Record<string, DiaData> = JSON.parse(raw);
      const todayKey = toKey((() => { const d = new Date(); d.setHours(0,0,0,0); return d; })());
      if (!parsed[todayKey]) parsed[todayKey] = { manana: [newFila()], tarde: [newFila()] };
      return parsed;
    }
  } catch { /* ignore */ }
  return buildInitialData();
}

// ── Página principal ───────────────────────────────────────────────────────────
export default function Bitacora() {
  const [data, setData]               = useState<Record<string, DiaData>>(loadData);
  const [savedAt, setSavedAt]         = useState<string | null>(null);
  const [scanTarget, setScanTarget]   = useState<{ turno: 'manana' | 'tarde'; filaId: string } | null>(null);
  const [planillaOpen, setPlanillaOpen] = useState(false);

  const today = new Date(); today.setHours(0, 0, 0, 0);
  const [selectedDate, setSelectedDate] = useState(toKey(today));

  useEffect(() => {
    try { localStorage.setItem(LS_KEY, JSON.stringify(data)); } catch { /* ignore */ }
    setSavedAt(new Date().toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
  }, [data]);

  const dates = Array.from({ length: 5 }, (_, i) => {
    const d = new Date(today); d.setDate(d.getDate() - (4 - i)); return d;
  });

  const diaData: DiaData = data[selectedDate] ?? { manana: [newFila()], tarde: [newFila()] };

  function updateFila(turno: 'manana' | 'tarde', id: string, patch: Partial<Fila>) {
    setData(prev => {
      const dia = prev[selectedDate] ?? { manana: [], tarde: [] };
      if (turno === 'manana' && dia.manana_cerrado) return prev;
      if (turno === 'tarde'  && dia.tarde_cerrado)  return prev;
      return { ...prev, [selectedDate]: { ...dia, [turno]: dia[turno].map(f => f.id === id ? { ...f, ...patch } : f) } };
    });
  }

  function addFila(turno: 'manana' | 'tarde') {
    setData(prev => {
      const dia = prev[selectedDate] ?? { manana: [], tarde: [] };
      return { ...prev, [selectedDate]: { ...dia, [turno]: [...dia[turno], newFila()] } };
    });
  }

  function deleteFila(turno: 'manana' | 'tarde', id: string) {
    setData(prev => {
      const dia = prev[selectedDate] ?? { manana: [], tarde: [] };
      const filas = dia[turno].filter(f => f.id !== id);
      return { ...prev, [selectedDate]: { ...dia, [turno]: filas.length > 0 ? filas : [newFila()] } };
    });
  }

  function cerrarTurno(turno: 'manana' | 'tarde') {
    setData(prev => {
      const dia = prev[selectedDate] ?? { manana: [], tarde: [] };
      return { ...prev, [selectedDate]: { ...dia, [`${turno}_cerrado`]: true, [`${turno}_cerrado_at`]: nowStr() } };
    });
  }

  function applyScan(result: ScanResult) {
    if (!scanTarget) return;
    const { turno, filaId } = scanTarget;

    const obs: string[] = [];
    if (result.vendido_txt)   obs.push(result.vendido_txt);
    if (result.observaciones) obs.push(result.observaciones);

    const hasVendido = (result.vendido_45 ?? 0) + (result.vendido_15 ?? 0) + (result.vendido_11 ?? 0) + (result.vendido_5 ?? 0) > 0;

    const carga = {
      '45 kg': result.carga_45 ?? 0,
      '15 kg': result.carga_15 ?? 0,
      '11 kg': result.carga_11 ?? 0,
      '5 kg':  result.carga_5  ?? 0,
    };
    const vendido = hasVendido ? {
      '45 kg': result.vendido_45 ?? 0,
      '15 kg': result.vendido_15 ?? 0,
      '11 kg': result.vendido_11 ?? 0,
      '5 kg':  result.vendido_5  ?? 0,
    } : undefined;
    const sobrante = hasVendido ? {
      '45 kg': Math.max(0, (result.carga_45 ?? 0) - (result.vendido_45 ?? 0)),
      '15 kg': Math.max(0, (result.carga_15 ?? 0) - (result.vendido_15 ?? 0)),
      '11 kg': Math.max(0, (result.carga_11 ?? 0) - (result.vendido_11 ?? 0)),
      '5 kg':  Math.max(0, (result.carga_5  ?? 0) - (result.vendido_5  ?? 0)),
    } : undefined;

    const patch: Partial<Fila> = {
      ...(result.conductor && { conductor: result.conductor }),
      ...(result.patente   && { patente:   result.patente.toUpperCase() }),
      ...(result.folio     && { folio:     result.folio }),
      observaciones: obs.join('\n'),
      carga,
      ...(vendido  && { vendido }),
      ...(sobrante && { sobrante }),
    };
    updateFila(turno, filaId, patch);
    setScanTarget(null);
  }

  function applyPlanilla(planRows: PlanillaFila[], turno: 'manana' | 'tarde') {
    setData(prev => {
      const dia = prev[selectedDate] ?? { manana: [], tarde: [] };
      if (turno === 'manana' && dia.manana_cerrado) return prev;
      if (turno === 'tarde'  && dia.tarde_cerrado)  return prev;
      const nuevas: Fila[] = planRows.map(r => ({
        id: crypto.randomUUID(),
        conductor: r.conductor,
        patente: r.patente,
        folio: '',
        carga:    { '45 kg': r.carga_45, '15 kg': r.carga_15, '11 kg': r.carga_11, '5 kg': r.carga_5 },
        vendido:  emptyMap(),
        sobrante: emptyMap(),
        observaciones: '',
      }));
      // Reemplaza filas vacías y agrega las nuevas al turno
      const prevFilas = dia[turno].filter(f => f.conductor || f.patente || TIPOS.some(t => f.carga[t] > 0));
      return { ...prev, [selectedDate]: { ...dia, [turno]: [...prevFilas, ...nuevas] } };
    });
    setPlanillaOpen(false);
  }

  function formatTab(d: Date) {
    const key = toKey(d);
    const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
    return {
      key,
      line1: key === toKey(today) ? 'Hoy' : key === toKey(yesterday) ? 'Ayer' : d.toLocaleDateString('es-CL', { weekday: 'short' }),
      line2: d.toLocaleDateString('es-CL', { day: 'numeric', month: 'short' }),
      locked: !!(data[key]?.manana_cerrado && data[key]?.tarde_cerrado),
    };
  }

  return (
    <div className="space-y-5">

      {scanTarget && (
        <ScanModal
          onApply={applyScan}
          onClose={() => setScanTarget(null)}
        />
      )}

      {planillaOpen && (
        <PlanillaModal
          onApply={applyPlanilla}
          onClose={() => setPlanillaOpen(false)}
        />
      )}

      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold text-white">Tránsito</h1>
          <p className="text-sm mt-0.5" style={{ color: '#4a5568' }}>
            Registra las guías de despacho · Presiona <Camera size={11} style={{ display: 'inline', color: '#f97316' }} /> para escanear una guía
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0 mt-1">
          {savedAt && (
            <div className="flex items-center gap-1.5 text-[11px]" style={{ color: '#4a5568' }}>
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: '#34d399' }} />
              Guardado {savedAt}
            </div>
          )}
          <button onClick={() => setPlanillaOpen(true)}
            className="flex items-center gap-1.5 text-[12px] font-semibold px-3 py-1.5 rounded-lg hover:opacity-80"
            style={{ background: '#431407', color: '#fb923c', border: '1px solid #fb923c40' }}>
            <Camera size={13} /> Cargar planilla
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-xl" style={{ background: '#0d1117', border: '1px solid #1e2432' }}>
        {dates.map(d => {
          const { key, line1, line2, locked } = formatTab(d);
          const isSelected = key === selectedDate;
          return (
            <button key={key} onClick={() => setSelectedDate(key)}
              className="flex-1 flex flex-col items-center py-2 px-2 rounded-lg transition-all"
              style={{ background: isSelected ? '#1e2432' : 'transparent', border: isSelected ? '1px solid #2d3748' : '1px solid transparent' }}>
              <div className="flex items-center gap-1">
                <span className="text-[11px] font-bold capitalize" style={{ color: isSelected ? '#fb923c' : '#4a5568' }}>{line1}</span>
                {locked && <Lock size={9} style={{ color: isSelected ? '#fb923c' : '#2d3748' }} />}
              </div>
              <span className="text-[10px]" style={{ color: isSelected ? '#64748b' : '#2d3748' }}>{line2}</span>
            </button>
          );
        })}
      </div>

      <TurnoTable
        label="Turno Mañana" accentColor="#fbbf24"
        icon={<Sun size={15} style={{ color: diaData.manana_cerrado ? '#fbbf2445' : '#fbbf24' }} />}
        filas={diaData.manana} cerrado={diaData.manana_cerrado} cerrado_at={diaData.manana_cerrado_at}
        onChange={(id, patch) => updateFila('manana', id, patch)}
        onAdd={() => addFila('manana')}
        onDelete={id => deleteFila('manana', id)}
        onCerrar={() => cerrarTurno('manana')}
        onScan={id => setScanTarget({ turno: 'manana', filaId: id })}
      />

      <TurnoTable
        label="Turno Tarde" accentColor="#818cf8"
        icon={<Moon size={15} style={{ color: diaData.tarde_cerrado ? '#818cf845' : '#818cf8' }} />}
        filas={diaData.tarde} cerrado={diaData.tarde_cerrado} cerrado_at={diaData.tarde_cerrado_at}
        onChange={(id, patch) => updateFila('tarde', id, patch)}
        onAdd={() => addFila('tarde')}
        onDelete={id => deleteFila('tarde', id)}
        onCerrar={() => cerrarTurno('tarde')}
        onScan={id => setScanTarget({ turno: 'tarde', filaId: id })}
      />
    </div>
  );
}
