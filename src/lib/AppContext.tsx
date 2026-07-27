import { createContext, useContext, useState, useMemo, type ReactNode } from 'react';
import {
  fichasIngreso as initialIngresos,
  fichasSalida  as initialSalidas,
  controlCalidad as initialCalidad,
  tiposGalon,
} from './mockData';
import type { FichaIngreso, FichaSalida, ControlCalidad } from './types';

// Umbrales de stock mínimo por tipo (cilindros)
export const STOCK_MINIMO: Record<string, number> = {
  '5 kg':   100,
  '11 kg':  200,
  '15 kg':  100,
  '45 kg':   50,
};

const DIAS_ALERTA_PENDIENTE = 3;

export interface Alerta {
  id: string;
  tipo: 'stock_bajo' | 'ingreso_pendiente' | 'calidad_obs';
  nivel: 'warning' | 'danger';
  mensaje: string;
  link: string;
}

interface AppContextType {
  fichasIngreso:    FichaIngreso[];
  fichasSalida:     FichaSalida[];
  controlCalidad:   ControlCalidad[];
  stockPorTipo:     Record<string, number>;
  stockTotal:       number;
  alertas:          Alerta[];
  cambiarEstadoIngreso: (id: string, estado: FichaIngreso['estado']) => void;
  cambiarEstadoSalida:  (id: string, estado: FichaSalida['estado'])  => void;
  addIngreso:  (f: FichaIngreso)  => void;
  addSalida:   (f: FichaSalida)   => void;
  addCalidad:  (c: ControlCalidad, rechazarIngreso?: boolean) => void;
}

const AppContext = createContext<AppContextType | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [fichasIngreso,  setFichasIngreso]  = useState<FichaIngreso[]>(initialIngresos);
  const [fichasSalida,   setFichasSalida]   = useState<FichaSalida[]>(initialSalidas);
  const [controlCalidad, setControlCalidad] = useState<ControlCalidad[]>(initialCalidad);

  // ── Stock calculado ─────────────────────────────────────────────────────────
  const stockPorTipo = useMemo(() => {
    const r: Record<string, number> = {};
    tiposGalon.forEach(t => {
      const ing = fichasIngreso
        .filter(f => f.estado === 'recibido')
        .reduce((s, f) => s + (f.items.find(i => i.tipo_galon_id === t.id)?.cantidad ?? 0), 0);
      const sal = fichasSalida
        .filter(f => f.estado === 'en_ruta' || f.estado === 'entregado')
        .reduce((s, f) => s + (f.items.find(i => i.tipo_galon_id === t.id)?.cantidad ?? 0), 0);
      r[t.nombre] = Math.max(0, ing - sal);
    });
    return r;
  }, [fichasIngreso, fichasSalida]);

  const stockTotal = useMemo(
    () => Object.values(stockPorTipo).reduce((s, v) => s + v, 0),
    [stockPorTipo],
  );

  // ── Alertas automáticas ─────────────────────────────────────────────────────
  const alertas = useMemo((): Alerta[] => {
    const now  = new Date();
    const list: Alerta[] = [];

    // Stock bajo por tipo
    tiposGalon.forEach(t => {
      const stock = stockPorTipo[t.nombre] ?? 0;
      const min   = STOCK_MINIMO[t.nombre] ?? 50;
      if (stock < min) {
        list.push({
          id:      `stock_${t.id}`,
          tipo:    'stock_bajo',
          nivel:   stock < Math.round(min * 0.5) ? 'danger' : 'warning',
          mensaje: `Stock bajo — ${t.nombre}: ${stock} cilindros (mín. ${min})`,
          link:    '/dashboard',
        });
      }
    });

    // Ingresos pendientes hace más de DIAS_ALERTA_PENDIENTE días
    fichasIngreso
      .filter(f => f.estado === 'pendiente')
      .forEach(f => {
        const dias = Math.floor((now.getTime() - new Date(f.fecha_ingreso).getTime()) / 86_400_000);
        if (dias >= DIAS_ALERTA_PENDIENTE) {
          list.push({
            id:      `pend_${f.id}`,
            tipo:    'ingreso_pendiente',
            nivel:   'warning',
            mensaje: `${f.numero_ficha} pendiente hace ${dias} día${dias !== 1 ? 's' : ''} — ${f.proveedor.split(' — ')[0]}`,
            link:    '/ingresos',
          });
        }
      });

    // Control de calidad con problemas
    const ccRech = controlCalidad.filter(c => c.resultado === 'rechazado').length;
    const ccObs  = controlCalidad.filter(c => c.resultado === 'con_observaciones').length;
    if (ccRech > 0 || ccObs > 0) {
      const partes: string[] = [];
      if (ccRech > 0) partes.push(`${ccRech} rechazado${ccRech > 1 ? 's' : ''}`);
      if (ccObs  > 0) partes.push(`${ccObs} con observaciones`);
      list.push({
        id:      'calidad_obs',
        tipo:    'calidad_obs',
        nivel:   ccRech > 0 ? 'danger' : 'warning',
        mensaje: `Control de Calidad: ${partes.join(', ')}`,
        link:    '/calidad',
      });
    }

    return list;
  }, [stockPorTipo, fichasIngreso, controlCalidad]);

  // ── Acciones ────────────────────────────────────────────────────────────────
  function cambiarEstadoIngreso(id: string, estado: FichaIngreso['estado']) {
    setFichasIngreso(prev => prev.map(r => r.id === id ? { ...r, estado } : r));
  }

  function cambiarEstadoSalida(id: string, estado: FichaSalida['estado']) {
    setFichasSalida(prev => prev.map(r => r.id === id ? { ...r, estado } : r));
  }

  function addIngreso(f: FichaIngreso) {
    setFichasIngreso(prev => [f, ...prev]);
  }

  function addSalida(f: FichaSalida) {
    setFichasSalida(prev => [f, ...prev]);
  }

  function addCalidad(c: ControlCalidad, rechazarIngreso = false) {
    setControlCalidad(prev => [c, ...prev]);
    if (rechazarIngreso && c.ficha_ingreso_id) {
      cambiarEstadoIngreso(c.ficha_ingreso_id, 'rechazado');
    }
  }

  return (
    <AppContext.Provider value={{
      fichasIngreso,
      fichasSalida,
      controlCalidad,
      stockPorTipo,
      stockTotal,
      alertas,
      cambiarEstadoIngreso,
      cambiarEstadoSalida,
      addIngreso,
      addSalida,
      addCalidad,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp debe usarse dentro de AppProvider');
  return ctx;
}
