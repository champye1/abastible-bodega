export interface TipoGalon {
  id: string;
  nombre: string;
  descripcion: string;
  activo: boolean;
  precio_planta: number;  // precio mayorista planta → distribuidor (CLP)
  precio_publico: number; // precio sugerido al consumidor final (CLP)
}

export interface Conductor {
  id: string;
  nombre: string;
  patente: string;
  activo: boolean;
}

export interface FichaItem {
  tipo_galon_id: string;
  tipo_galon?: TipoGalon;
  cantidad: number;
}

export interface FichaIngreso {
  id: string;
  numero_ficha: string;
  fecha_ingreso: string;
  proveedor: string;
  // Primer ítem (compatibilidad con tablas/filtros)
  tipo_galon_id: string;
  tipo_galon?: TipoGalon;
  cantidad: number; // total de todos los ítems
  items: FichaItem[];
  estado: 'pendiente' | 'recibido' | 'rechazado';
  observaciones: string;
  created_at: string;
}

export interface FichaSalida {
  id: string;
  numero_ficha: string;
  fecha_salida: string;
  conductor_id: string;
  conductor?: Conductor;
  // Primer ítem (compatibilidad con tablas/filtros)
  tipo_galon_id: string;
  tipo_galon?: TipoGalon;
  cantidad: number; // total de todos los ítems
  items: FichaItem[];
  destino: string;
  estado: 'pendiente' | 'en_ruta' | 'entregado';
  observaciones: string;
  // Retorno del camión (bitácora)
  vendido?: FichaItem[];   // lo que efectivamente se vendió
  sobrante?: FichaItem[];  // lo que volvió sin vender
  created_at: string;
}

export interface ControlCalidad {
  id: string;
  numero_ficha: string;
  fecha_revision: string;
  tipo_galon_id: string;
  tipo_galon?: TipoGalon;
  muestras_tomadas: number;
  inspector: string;
  nota: string;
  resultado: 'aprobado' | 'con_observaciones' | 'rechazado';
  ficha_ingreso_id: string | null;
  ficha_ingreso?: FichaIngreso;
  created_at: string;
}
