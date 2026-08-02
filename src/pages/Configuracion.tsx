import { useState, useRef } from 'react';
import { Download, Upload, Trash2, ShieldCheck, AlertTriangle, CheckCircle } from 'lucide-react';

const STORAGE_KEYS = [
  { key: 'abastible_inventario_v7', label: 'Inventario de Cilindros' },
  { key: 'abastible_venta_local_v2', label: 'Venta Local (registros)' },
  { key: 'abastible_precios_v1',     label: 'Precios configurados' },
];
const BACKUP_META_KEY = 'abastible_ultimo_backup';

function formatFechaHora(iso: string) {
  return new Date(iso).toLocaleString('es-CL', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function getSizeKB() {
  let total = 0;
  for (const { key } of STORAGE_KEYS) {
    const v = localStorage.getItem(key);
    if (v) total += new TextEncoder().encode(v).length;
  }
  return (total / 1024).toFixed(1);
}

export default function Configuracion() {
  const [msg, setMsg] = useState<{ tipo: 'ok' | 'error' | 'warn'; texto: string } | null>(null);
  const [confirmLimpiar, setConfirmLimpiar] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const ultimoBackup = localStorage.getItem(BACKUP_META_KEY);

  function showMsg(tipo: 'ok' | 'error' | 'warn', texto: string) {
    setMsg({ tipo, texto });
    setTimeout(() => setMsg(null), 4000);
  }

  function exportar() {
    const datos: Record<string, unknown> = {};
    for (const { key } of STORAGE_KEYS) {
      const v = localStorage.getItem(key);
      if (v) { try { datos[key] = JSON.parse(v); } catch { datos[key] = v; } }
    }
    const backup = { version: '1.0', app: 'AbastibleBodega', fecha: new Date().toISOString(), datos };
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `abastible_backup_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    const ahora = new Date().toISOString();
    localStorage.setItem(BACKUP_META_KEY, ahora);
    showMsg('ok', 'Backup exportado correctamente.');
  }

  function importar(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const raw = ev.target?.result as string;
        const backup = JSON.parse(raw);
        if (!backup.datos || backup.app !== 'AbastibleBodega') {
          showMsg('error', 'Archivo inválido: no es un backup de AbastibleBodega.');
          return;
        }
        let restaurados = 0;
        for (const { key } of STORAGE_KEYS) {
          if (backup.datos[key] !== undefined) {
            localStorage.setItem(key, JSON.stringify(backup.datos[key]));
            restaurados++;
          }
        }
        showMsg('ok', `${restaurados} módulos restaurados. Recargando...`);
        setTimeout(() => window.location.reload(), 1500);
      } catch {
        showMsg('error', 'No se pudo leer el archivo. Verifica que sea un backup válido.');
      }
    };
    reader.readAsText(file);
    if (inputRef.current) inputRef.current.value = '';
  }

  function limpiarTodo() {
    for (const { key } of STORAGE_KEYS) localStorage.removeItem(key);
    localStorage.removeItem(BACKUP_META_KEY);
    showMsg('warn', 'Todos los datos fueron eliminados. Recargando...');
    setTimeout(() => window.location.reload(), 1500);
    setConfirmLimpiar(false);
  }

  const sizeKB = getSizeKB();

  return (
    <div style={{ maxWidth: 680, margin: '0 auto' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24 }}>
        <ShieldCheck size={20} style={{ color: '#f97316' }} />
        <h1 style={{ color: '#fff', fontSize: 18, fontWeight: 700, margin: 0 }}>Configuración y Backup</h1>
      </div>

      {/* Mensaje de estado */}
      {msg && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px',
          borderRadius: 8, marginBottom: 20, fontSize: 13,
          background: msg.tipo === 'ok' ? '#0f2318' : msg.tipo === 'error' ? '#2a0a0a' : '#2a1a00',
          border: `1px solid ${msg.tipo === 'ok' ? '#4ade8030' : msg.tipo === 'error' ? '#ef444430' : '#f59e0b30'}`,
          color: msg.tipo === 'ok' ? '#4ade80' : msg.tipo === 'error' ? '#f87171' : '#fbbf24',
        }}>
          {msg.tipo === 'ok'    && <CheckCircle size={15} />}
          {msg.tipo === 'error' && <AlertTriangle size={15} />}
          {msg.tipo === 'warn'  && <AlertTriangle size={15} />}
          {msg.texto}
        </div>
      )}

      {/* Estado actual */}
      <div style={{ background: '#0d1117', border: '1px solid #1e2432', borderRadius: 10, padding: 20, marginBottom: 16 }}>
        <p style={{ color: '#475569', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 14px' }}>
          Estado del almacenamiento
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
          <div style={{ background: '#161b27', borderRadius: 8, padding: '12px 16px' }}>
            <p style={{ color: '#475569', fontSize: 11, margin: '0 0 4px' }}>Tamaño total</p>
            <p style={{ color: '#e2e8f0', fontSize: 20, fontWeight: 700, margin: 0 }}>{sizeKB} <span style={{ fontSize: 12, color: '#475569', fontWeight: 400 }}>KB</span></p>
          </div>
          <div style={{ background: '#161b27', borderRadius: 8, padding: '12px 16px' }}>
            <p style={{ color: '#475569', fontSize: 11, margin: '0 0 4px' }}>Último backup</p>
            <p style={{ color: ultimoBackup ? '#4ade80' : '#ef4444', fontSize: 13, fontWeight: 600, margin: 0 }}>
              {ultimoBackup ? formatFechaHora(ultimoBackup) : 'Sin backup aún'}
            </p>
          </div>
        </div>

        {/* Módulos */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {STORAGE_KEYS.map(({ key, label }) => {
            const existe = !!localStorage.getItem(key);
            return (
              <div key={key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', background: '#0a0d13', borderRadius: 6, border: '1px solid #1e2432' }}>
                <span style={{ fontSize: 12, color: '#94a3b8' }}>{label}</span>
                <span style={{ fontSize: 11, fontWeight: 600, color: existe ? '#4ade80' : '#4a5568' }}>
                  {existe ? '● Con datos' : '○ Vacío'}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Exportar */}
      <div style={{ background: '#0d1117', border: '1px solid #1e2432', borderRadius: 10, padding: 20, marginBottom: 16 }}>
        <p style={{ color: '#475569', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 8px' }}>
          Exportar backup
        </p>
        <p style={{ color: '#64748b', fontSize: 12, margin: '0 0 14px', lineHeight: 1.6 }}>
          Descarga un archivo <code style={{ background: '#1e2432', padding: '1px 5px', borderRadius: 4 }}>.json</code> con todos los datos del sistema (inventario, ventas, precios). Guárdalo en un lugar seguro o en la nube.
        </p>
        <button onClick={exportar} style={{
          display: 'flex', alignItems: 'center', gap: 8,
          background: '#0f2318', color: '#4ade80', border: '1px solid #4ade8030',
          borderRadius: 8, padding: '9px 20px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
        }}>
          <Download size={15} /> Exportar todos los datos
        </button>
      </div>

      {/* Importar */}
      <div style={{ background: '#0d1117', border: '1px solid #1e2432', borderRadius: 10, padding: 20, marginBottom: 16 }}>
        <p style={{ color: '#475569', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 8px' }}>
          Importar backup
        </p>
        <p style={{ color: '#64748b', fontSize: 12, margin: '0 0 14px', lineHeight: 1.6 }}>
          Restaura los datos desde un archivo de backup. <strong style={{ color: '#fbbf24' }}>Atención: reemplaza los datos actuales</strong> con los del archivo importado.
        </p>
        <input ref={inputRef} type="file" accept=".json" onChange={importar} style={{ display: 'none' }} id="import-file" />
        <label htmlFor="import-file" style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          background: '#0f1e38', color: '#60a5fa', border: '1px solid #60a5fa30',
          borderRadius: 8, padding: '9px 20px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
        }}>
          <Upload size={15} /> Importar desde archivo
        </label>
      </div>

      {/* Limpiar datos */}
      <div style={{ background: '#0d1117', border: '1px solid #2a0a0a', borderRadius: 10, padding: 20 }}>
        <p style={{ color: '#475569', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 8px' }}>
          Zona de peligro
        </p>
        <p style={{ color: '#64748b', fontSize: 12, margin: '0 0 14px', lineHeight: 1.6 }}>
          Elimina permanentemente todos los datos almacenados en este navegador. <strong style={{ color: '#f87171' }}>Esta acción no se puede deshacer.</strong> Exporta un backup antes de proceder.
        </p>
        {confirmLimpiar ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ color: '#fbbf24', fontSize: 12 }}>¿Confirmas que quieres borrar todo?</span>
            <button onClick={limpiarTodo} style={{ background: '#dc2626', color: '#fff', border: 'none', borderRadius: 6, padding: '6px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
              Sí, borrar todo
            </button>
            <button onClick={() => setConfirmLimpiar(false)} style={{ background: '#1e2432', color: '#94a3b8', border: 'none', borderRadius: 6, padding: '6px 12px', fontSize: 12, cursor: 'pointer' }}>
              Cancelar
            </button>
          </div>
        ) : (
          <button onClick={() => setConfirmLimpiar(true)} style={{
            display: 'flex', alignItems: 'center', gap: 8,
            background: '#1a0505', color: '#f87171', border: '1px solid #f8717130',
            borderRadius: 8, padding: '9px 20px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
          }}>
            <Trash2 size={15} /> Limpiar todos los datos
          </button>
        )}
      </div>

    </div>
  );
}
