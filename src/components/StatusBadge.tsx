type IngresoEstado = 'pendiente' | 'recibido' | 'rechazado';
type SalidaEstado  = 'pendiente' | 'en_ruta' | 'entregado';
type CalidadEstado = 'aprobado' | 'con_observaciones' | 'rechazado';

type Estado = IngresoEstado | SalidaEstado | CalidadEstado;

const CONFIG: Record<Estado, { label: string; bg: string; text: string }> = {
  pendiente:         { label: 'Pendiente',         bg: '#451a03', text: '#fbbf24' },
  recibido:          { label: 'Recibido',           bg: '#052e16', text: '#34d399' },
  rechazado:         { label: 'Rechazado',          bg: '#450a0a', text: '#f87171' },
  en_ruta:           { label: 'En Distribución',    bg: '#1a2e4a', text: '#38bdf8' },
  entregado:         { label: 'Entregado',          bg: '#052e16', text: '#34d399' },
  aprobado:          { label: 'Aprobado',           bg: '#052e16', text: '#34d399' },
  con_observaciones: { label: 'Con Observaciones',  bg: '#451a03', text: '#fbbf24' },
};

interface Props {
  estado: Estado;
  small?: boolean;
}

export default function StatusBadge({ estado, small }: Props) {
  const cfg = CONFIG[estado] ?? { label: estado, bg: '#1e2432', text: '#94a3b8' };
  return (
    <span
      className={`inline-flex items-center font-semibold rounded-full whitespace-nowrap ${small ? 'text-[10px] px-2 py-0.5' : 'text-xs px-2.5 py-1'}`}
      style={{ background: cfg.bg, color: cfg.text }}
    >
      {cfg.label}
    </span>
  );
}
