import type { TipoGalon, Conductor, FichaIngreso, FichaSalida, ControlCalidad } from './types';

const T5  = 'a1b2c3d4-0001-0000-0000-000000000001';
const T11 = 'a1b2c3d4-0001-0000-0000-000000000002';
const T15 = 'a1b2c3d4-0001-0000-0000-000000000003';
const T45 = 'a1b2c3d4-0001-0000-0000-000000000004';

const C1 = 'c0000000-0000-0000-0000-000000000001';
const C2 = 'c0000000-0000-0000-0000-000000000002';
const C3 = 'c0000000-0000-0000-0000-000000000003';
const C4 = 'c0000000-0000-0000-0000-000000000004';

export const tiposGalon: TipoGalon[] = [
  {
    id: T5,  nombre: '5 kg',
    descripcion: 'Cilindro doméstico pequeño — cocina y calefacción',
    activo: true,
    precio_planta:  9_200,   // precio mayorista planta→distribuidor (CLP)
    precio_publico: 11_000,  // precio sugerido consumidor final (CLP) — fuente: Sindicato BCH jun-2026
  },
  {
    id: T11, nombre: '11 kg',
    descripcion: 'Cilindro doméstico estándar — uso residencial',
    activo: true,
    precio_planta:  17_500,
    precio_publico: 20_000,  // rango mercado: $18.000–$21.000
  },
  {
    id: T15, nombre: '15 kg',
    descripcion: 'Cilindro semipesado — uso comercial y residencial',
    activo: true,
    precio_planta:  24_200,
    precio_publico: 28_000,  // Abastible RM jun-2026
  },
  {
    id: T45, nombre: '45 kg',
    descripcion: 'Cilindro industrial — comercio, industria y pymes',
    activo: true,
    precio_planta:  67_000,
    precio_publico: 78_000,  // rango mercado: $76.000–$80.000
  },
];

export const conductores: Conductor[] = [
  { id: C1, nombre: 'Juan Pérez Morales',    patente: 'BCHK45', activo: true },
  { id: C2, nombre: 'Carlos González Díaz',  patente: 'ABCD12', activo: true },
  { id: C3, nombre: 'María Silva Rojas',     patente: 'WXYZ78', activo: true },
  { id: C4, nombre: 'Pedro Rodríguez Vega',  patente: 'EFGH34', activo: true },
];

const [t5, t11, t15, t45] = tiposGalon;

// ─── Helper ──────────────────────────────────────────────────────────────────
function totalItems(items: { cantidad: number }[]) {
  return items.reduce((s, i) => s + i.cantidad, 0);
}

// ─── Fichas de ingreso ────────────────────────────────────────────────────────
export const fichasIngreso: FichaIngreso[] = [
  {
    id: 'i001', numero_ficha: 'ING-001',
    fecha_ingreso: '2026-05-26T09:00:00.000Z',
    proveedor: 'Planta Concepción — Abastible',
    tipo_galon_id: T11, tipo_galon: t11,
    items: [
      { tipo_galon_id: T11, tipo_galon: t11, cantidad: 420 },
      { tipo_galon_id: T5,  tipo_galon: t5,  cantidad: 150 },
    ],
    get cantidad() { return totalItems(this.items); },
    estado: 'recibido',
    observaciones: 'Lote en buen estado. Traslado interplanta.',
    created_at: '2026-05-26T09:00:00.000Z',
  },
  {
    id: 'i002', numero_ficha: 'ING-002',
    fecha_ingreso: '2026-05-28T10:30:00.000Z',
    proveedor: 'Terminal Quintero — ENAP',
    tipo_galon_id: T5, tipo_galon: t5,
    items: [
      { tipo_galon_id: T5,  tipo_galon: t5,  cantidad: 300 },
    ],
    get cantidad() { return totalItems(this.items); },
    estado: 'recibido', observaciones: '',
    created_at: '2026-05-28T10:30:00.000Z',
  },
  {
    id: 'i003', numero_ficha: 'ING-003',
    fecha_ingreso: '2026-05-30T08:15:00.000Z',
    proveedor: 'Planta Temuco — Abastible',
    tipo_galon_id: T45, tipo_galon: t45,
    items: [
      { tipo_galon_id: T45, tipo_galon: t45, cantidad: 80  },
      { tipo_galon_id: T15, tipo_galon: t15, cantidad: 120 },
    ],
    get cantidad() { return totalItems(this.items); },
    estado: 'recibido',
    observaciones: 'Traslado prioritario para sector industrial.',
    created_at: '2026-05-30T08:15:00.000Z',
  },
  {
    id: 'i004', numero_ficha: 'ING-004',
    fecha_ingreso: '2026-06-02T11:00:00.000Z',
    proveedor: 'Planta Valparaíso — Abastible',
    tipo_galon_id: T11, tipo_galon: t11,
    items: [
      { tipo_galon_id: T11, tipo_galon: t11, cantidad: 360 },
    ],
    get cantidad() { return totalItems(this.items); },
    estado: 'rechazado',
    observaciones: 'Cilindros con válvulas defectuosas. Devueltos a origen.',
    created_at: '2026-06-02T11:00:00.000Z',
  },
  {
    id: 'i005', numero_ficha: 'ING-005',
    fecha_ingreso: '2026-06-04T09:45:00.000Z',
    proveedor: 'Terminal Quintero — ENAP',
    tipo_galon_id: T5, tipo_galon: t5,
    items: [
      { tipo_galon_id: T5,  tipo_galon: t5,  cantidad: 300 },
      { tipo_galon_id: T11, tipo_galon: t11, cantidad: 200 },
      { tipo_galon_id: T15, tipo_galon: t15, cantidad: 100 },
    ],
    get cantidad() { return totalItems(this.items); },
    estado: 'recibido', observaciones: '',
    created_at: '2026-06-04T09:45:00.000Z',
  },
  {
    id: 'i006', numero_ficha: 'ING-006',
    fecha_ingreso: '2026-06-07T07:30:00.000Z',
    proveedor: 'Planta La Serena — Abastible',
    tipo_galon_id: T15, tipo_galon: t15,
    items: [
      { tipo_galon_id: T15, tipo_galon: t15, cantidad: 220 },
    ],
    get cantidad() { return totalItems(this.items); },
    estado: 'recibido',
    observaciones: 'Lote prioritario para campaña zona sur RM.',
    created_at: '2026-06-07T07:30:00.000Z',
  },
  {
    id: 'i007', numero_ficha: 'ING-007',
    fecha_ingreso: '2026-06-10T10:00:00.000Z',
    proveedor: 'Planta Concepción — Abastible',
    tipo_galon_id: T11, tipo_galon: t11,
    items: [
      { tipo_galon_id: T11, tipo_galon: t11, cantidad: 400 },
      { tipo_galon_id: T45, tipo_galon: t45, cantidad: 40  },
    ],
    get cantidad() { return totalItems(this.items); },
    estado: 'recibido', observaciones: '',
    created_at: '2026-06-10T10:00:00.000Z',
  },
  {
    id: 'i008', numero_ficha: 'ING-008',
    fecha_ingreso: '2026-06-14T08:00:00.000Z',
    proveedor: 'Terminal Quintero — ENAP',
    tipo_galon_id: T45, tipo_galon: t45,
    items: [
      { tipo_galon_id: T45, tipo_galon: t45, cantidad: 60 },
    ],
    get cantidad() { return totalItems(this.items); },
    estado: 'pendiente',
    observaciones: 'Pendiente revisión de válvulas industriales.',
    created_at: '2026-06-14T08:00:00.000Z',
  },
  {
    id: 'i009', numero_ficha: 'ING-009',
    fecha_ingreso: '2026-06-18T09:30:00.000Z',
    proveedor: 'Planta Temuco — Abastible',
    tipo_galon_id: T15, tipo_galon: t15,
    items: [
      { tipo_galon_id: T15, tipo_galon: t15, cantidad: 150 },
      { tipo_galon_id: T5,  tipo_galon: t5,  cantidad: 80  },
    ],
    get cantidad() { return totalItems(this.items); },
    estado: 'recibido', observaciones: '',
    created_at: '2026-06-18T09:30:00.000Z',
  },
  {
    id: 'i010', numero_ficha: 'ING-010',
    fecha_ingreso: '2026-06-22T08:45:00.000Z',
    proveedor: 'Planta Valparaíso — Abastible',
    tipo_galon_id: T11, tipo_galon: t11,
    items: [
      { tipo_galon_id: T11, tipo_galon: t11, cantidad: 380 },
      { tipo_galon_id: T5,  tipo_galon: t5,  cantidad: 120 },
    ],
    get cantidad() { return totalItems(this.items); },
    estado: 'pendiente',
    observaciones: 'Recién llegado, en proceso de descarga.',
    created_at: '2026-06-22T08:45:00.000Z',
  },
];

// ─── Fichas de salida ─────────────────────────────────────────────────────────
export const fichasSalida: FichaSalida[] = [
  {
    id: 's001', numero_ficha: 'SAL-001',
    fecha_salida: '2026-05-27T07:00:00.000Z',
    conductor_id: C1, conductor: conductores[0],
    tipo_galon_id: T11, tipo_galon: t11,
    items: [
      { tipo_galon_id: T11, tipo_galon: t11, cantidad: 120 },
      { tipo_galon_id: T5,  tipo_galon: t5,  cantidad: 60  },
    ],
    get cantidad() { return totalItems(this.items); },
    destino: 'Maipú — Distribuidora Los Almendros',
    estado: 'entregado', observaciones: '',
    vendido:  [{ tipo_galon_id: T11, tipo_galon: t11, cantidad: 98  }, { tipo_galon_id: T5, tipo_galon: t5, cantidad: 52 }],
    sobrante: [{ tipo_galon_id: T11, tipo_galon: t11, cantidad: 22  }, { tipo_galon_id: T5, tipo_galon: t5, cantidad: 8  }],
    created_at: '2026-05-27T07:00:00.000Z',
  },
  {
    id: 's002', numero_ficha: 'SAL-002',
    fecha_salida: '2026-05-29T07:30:00.000Z',
    conductor_id: C2, conductor: conductores[1],
    tipo_galon_id: T5, tipo_galon: t5,
    items: [
      { tipo_galon_id: T5, tipo_galon: t5, cantidad: 90 },
    ],
    get cantidad() { return totalItems(this.items); },
    destino: 'Las Condes — Supermercado Unimarc',
    estado: 'entregado', observaciones: '',
    vendido:  [{ tipo_galon_id: T5, tipo_galon: t5, cantidad: 82 }],
    sobrante: [{ tipo_galon_id: T5, tipo_galon: t5, cantidad: 8  }],
    created_at: '2026-05-29T07:30:00.000Z',
  },
  {
    id: 's003', numero_ficha: 'SAL-003',
    fecha_salida: '2026-06-01T08:00:00.000Z',
    conductor_id: C3, conductor: conductores[2],
    tipo_galon_id: T45, tipo_galon: t45,
    items: [
      { tipo_galon_id: T45, tipo_galon: t45, cantidad: 25 },
      { tipo_galon_id: T15, tipo_galon: t15, cantidad: 40 },
      { tipo_galon_id: T11, tipo_galon: t11, cantidad: 80 },
    ],
    get cantidad() { return totalItems(this.items); },
    destino: 'Renca — Planta Industrial Coresa',
    estado: 'entregado', observaciones: 'Entrega urgente contrato Marco.',
    vendido:  [{ tipo_galon_id: T45, tipo_galon: t45, cantidad: 22 }, { tipo_galon_id: T15, tipo_galon: t15, cantidad: 36 }, { tipo_galon_id: T11, tipo_galon: t11, cantidad: 71 }],
    sobrante: [{ tipo_galon_id: T45, tipo_galon: t45, cantidad: 3  }, { tipo_galon_id: T15, tipo_galon: t15, cantidad: 4  }, { tipo_galon_id: T11, tipo_galon: t11, cantidad: 9  }],
    created_at: '2026-06-01T08:00:00.000Z',
  },
  {
    id: 's004', numero_ficha: 'SAL-004',
    fecha_salida: '2026-06-03T06:45:00.000Z',
    conductor_id: C4, conductor: conductores[3],
    tipo_galon_id: T11, tipo_galon: t11,
    items: [
      { tipo_galon_id: T11, tipo_galon: t11, cantidad: 150 },
      { tipo_galon_id: T5,  tipo_galon: t5,  cantidad: 100 },
    ],
    get cantidad() { return totalItems(this.items); },
    destino: 'Pudahuel — Distribuidora Norte',
    estado: 'entregado', observaciones: '',
    vendido:  [{ tipo_galon_id: T11, tipo_galon: t11, cantidad: 134 }, { tipo_galon_id: T5, tipo_galon: t5, cantidad: 91 }],
    sobrante: [{ tipo_galon_id: T11, tipo_galon: t11, cantidad: 16  }, { tipo_galon_id: T5, tipo_galon: t5, cantidad: 9  }],
    created_at: '2026-06-03T06:45:00.000Z',
  },
  {
    id: 's005', numero_ficha: 'SAL-005',
    fecha_salida: '2026-06-05T07:15:00.000Z',
    conductor_id: C1, conductor: conductores[0],
    tipo_galon_id: T5, tipo_galon: t5,
    items: [
      { tipo_galon_id: T5,  tipo_galon: t5,  cantidad: 200 },
      { tipo_galon_id: T15, tipo_galon: t15, cantidad: 55  },
    ],
    get cantidad() { return totalItems(this.items); },
    destino: 'Quilicura — Ferretería Central',
    estado: 'entregado', observaciones: '',
    vendido:  [{ tipo_galon_id: T5, tipo_galon: t5, cantidad: 178 }, { tipo_galon_id: T15, tipo_galon: t15, cantidad: 50 }],
    sobrante: [{ tipo_galon_id: T5, tipo_galon: t5, cantidad: 22  }, { tipo_galon_id: T15, tipo_galon: t15, cantidad: 5  }],
    created_at: '2026-06-05T07:15:00.000Z',
  },
  {
    id: 's006', numero_ficha: 'SAL-006',
    fecha_salida: '2026-06-09T08:30:00.000Z',
    conductor_id: C2, conductor: conductores[1],
    tipo_galon_id: T45, tipo_galon: t45,
    items: [
      { tipo_galon_id: T45, tipo_galon: t45, cantidad: 30 },
    ],
    get cantidad() { return totalItems(this.items); },
    destino: 'Lampa — Agroindustrias del Valle',
    estado: 'entregado', observaciones: '',
    vendido:  [{ tipo_galon_id: T45, tipo_galon: t45, cantidad: 27 }],
    sobrante: [{ tipo_galon_id: T45, tipo_galon: t45, cantidad: 3  }],
    created_at: '2026-06-09T08:30:00.000Z',
  },
  {
    id: 's007', numero_ficha: 'SAL-007',
    fecha_salida: '2026-06-12T07:00:00.000Z',
    conductor_id: C3, conductor: conductores[2],
    tipo_galon_id: T11, tipo_galon: t11,
    items: [
      { tipo_galon_id: T11, tipo_galon: t11, cantidad: 180 },
      { tipo_galon_id: T5,  tipo_galon: t5,  cantidad: 120 },
      { tipo_galon_id: T15, tipo_galon: t15, cantidad: 60  },
    ],
    get cantidad() { return totalItems(this.items); },
    destino: 'San Bernardo — Dist. Sur Poniente',
    estado: 'entregado', observaciones: '',
    vendido:  [{ tipo_galon_id: T11, tipo_galon: t11, cantidad: 158 }, { tipo_galon_id: T5, tipo_galon: t5, cantidad: 107 }, { tipo_galon_id: T15, tipo_galon: t15, cantidad: 54 }],
    sobrante: [{ tipo_galon_id: T11, tipo_galon: t11, cantidad: 22  }, { tipo_galon_id: T5, tipo_galon: t5, cantidad: 13  }, { tipo_galon_id: T15, tipo_galon: t15, cantidad: 6  }],
    created_at: '2026-06-12T07:00:00.000Z',
  },
  {
    id: 's008', numero_ficha: 'SAL-008',
    fecha_salida: '2026-06-16T06:30:00.000Z',
    conductor_id: C4, conductor: conductores[3],
    tipo_galon_id: T5, tipo_galon: t5,
    items: [
      { tipo_galon_id: T5, tipo_galon: t5, cantidad: 140 },
    ],
    get cantidad() { return totalItems(this.items); },
    destino: 'Lo Espejo — Minimarket Los Aromos',
    estado: 'entregado', observaciones: '',
    vendido:  [{ tipo_galon_id: T5, tipo_galon: t5, cantidad: 125 }],
    sobrante: [{ tipo_galon_id: T5, tipo_galon: t5, cantidad: 15  }],
    created_at: '2026-06-16T06:30:00.000Z',
  },
  {
    id: 's009', numero_ficha: 'SAL-009',
    fecha_salida: '2026-06-20T07:45:00.000Z',
    conductor_id: C1, conductor: conductores[0],
    tipo_galon_id: T15, tipo_galon: t15,
    items: [
      { tipo_galon_id: T15, tipo_galon: t15, cantidad: 55  },
      { tipo_galon_id: T11, tipo_galon: t11, cantidad: 100 },
    ],
    get cantidad() { return totalItems(this.items); },
    destino: 'Cerrillos — Zona Industrial Norte',
    estado: 'en_ruta', observaciones: '',
    created_at: '2026-06-20T07:45:00.000Z',
  },
  {
    id: 's010', numero_ficha: 'SAL-010',
    fecha_salida: '2026-06-22T07:00:00.000Z',
    conductor_id: C2, conductor: conductores[1],
    tipo_galon_id: T11, tipo_galon: t11,
    items: [
      { tipo_galon_id: T11, tipo_galon: t11, cantidad: 160 },
    ],
    get cantidad() { return totalItems(this.items); },
    destino: 'Estación Central — Distribuidora El Olivo',
    estado: 'pendiente', observaciones: 'Carga en proceso.',
    created_at: '2026-06-22T07:00:00.000Z',
  },
];

// ─── Control de calidad ───────────────────────────────────────────────────────
export const controlCalidad: ControlCalidad[] = [
  {
    id: 'q001', numero_ficha: 'CAL-001', fecha_revision: '2026-05-26',
    tipo_galon_id: T11, tipo_galon: t11, muestras_tomadas: 20,
    inspector: 'Ana Torres Cáceres',
    nota: 'Presión dentro del rango normativo SEC. Sin observaciones.',
    resultado: 'aprobado', ficha_ingreso_id: 'i001', ficha_ingreso: fichasIngreso[0],
    created_at: '2026-05-26T10:00:00.000Z',
  },
  {
    id: 'q002', numero_ficha: 'CAL-002', fecha_revision: '2026-05-28',
    tipo_galon_id: T5, tipo_galon: t5, muestras_tomadas: 15,
    inspector: 'Roberto Vega Fuentes',
    nota: 'Cilindros limpios, marcas visibles. Aprobado.',
    resultado: 'aprobado', ficha_ingreso_id: 'i002', ficha_ingreso: fichasIngreso[1],
    created_at: '2026-05-28T11:00:00.000Z',
  },
  {
    id: 'q003', numero_ficha: 'CAL-003', fecha_revision: '2026-05-30',
    tipo_galon_id: T45, tipo_galon: t45, muestras_tomadas: 8,
    inspector: 'Ana Torres Cáceres',
    nota: 'Dos cilindros con leve corrosión externa. Requieren mantenimiento preventivo.',
    resultado: 'con_observaciones', ficha_ingreso_id: 'i003', ficha_ingreso: fichasIngreso[2],
    created_at: '2026-05-30T09:30:00.000Z',
  },
  {
    id: 'q004', numero_ficha: 'CAL-004', fecha_revision: '2026-06-02',
    tipo_galon_id: T11, tipo_galon: t11, muestras_tomadas: 18,
    inspector: 'Marcelo Ruiz Espinoza',
    nota: 'Válvulas defectuosas en 12 unidades. Lote rechazado según norma NCh382.',
    resultado: 'rechazado', ficha_ingreso_id: 'i004', ficha_ingreso: fichasIngreso[3],
    created_at: '2026-06-02T12:00:00.000Z',
  },
  {
    id: 'q005', numero_ficha: 'CAL-005', fecha_revision: '2026-06-07',
    tipo_galon_id: T15, tipo_galon: t15, muestras_tomadas: 12,
    inspector: 'Ana Torres Cáceres',
    nota: 'Revisión rutinaria. Cumple norma SEC D.S. N°298.',
    resultado: 'aprobado', ficha_ingreso_id: 'i006', ficha_ingreso: fichasIngreso[5],
    created_at: '2026-06-07T08:00:00.000Z',
  },
  {
    id: 'q006', numero_ficha: 'CAL-006', fecha_revision: '2026-06-10',
    tipo_galon_id: T11, tipo_galon: t11, muestras_tomadas: 22,
    inspector: 'Roberto Vega Fuentes',
    nota: 'Lote cumple normativa vigente. Presión nominal 7 bar.',
    resultado: 'aprobado', ficha_ingreso_id: 'i007', ficha_ingreso: fichasIngreso[6],
    created_at: '2026-06-10T11:00:00.000Z',
  },
  {
    id: 'q007', numero_ficha: 'CAL-007', fecha_revision: '2026-06-18',
    tipo_galon_id: T15, tipo_galon: t15, muestras_tomadas: 8,
    inspector: 'Marcelo Ruiz Espinoza',
    nota: 'Inspección express aprobada.',
    resultado: 'aprobado', ficha_ingreso_id: 'i009', ficha_ingreso: fichasIngreso[8],
    created_at: '2026-06-18T10:00:00.000Z',
  },
  {
    id: 'q008', numero_ficha: 'CAL-008', fecha_revision: '2026-06-22',
    tipo_galon_id: T45, tipo_galon: t45, muestras_tomadas: 6,
    inspector: 'Ana Torres Cáceres',
    nota: 'Inspección en curso. Pendiente test de presión en cámara.',
    resultado: 'con_observaciones', ficha_ingreso_id: null,
    created_at: '2026-06-22T09:00:00.000Z',
  },
];
