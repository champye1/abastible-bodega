-- ============================================================
-- AbastibleBodega — Schema + Seed Data
-- Ejecutar en el SQL Editor de Supabase
-- ============================================================

-- ── Tipos de galón ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.tipos_galon (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre      TEXT NOT NULL,
  descripcion TEXT,
  activo      BOOLEAN NOT NULL DEFAULT TRUE
);

ALTER TABLE public.tipos_galon ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all" ON public.tipos_galon FOR ALL USING (TRUE) WITH CHECK (TRUE);

-- ── Conductores ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.conductores (
  id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre  TEXT NOT NULL,
  patente TEXT NOT NULL,
  activo  BOOLEAN NOT NULL DEFAULT TRUE
);

ALTER TABLE public.conductores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all" ON public.conductores FOR ALL USING (TRUE) WITH CHECK (TRUE);

-- ── Fichas ingreso ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.fichas_ingreso (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero_ficha   TEXT UNIQUE NOT NULL,
  fecha_ingreso  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  proveedor      TEXT NOT NULL,
  tipo_galon_id  UUID NOT NULL REFERENCES public.tipos_galon(id),
  cantidad       INTEGER NOT NULL CHECK (cantidad > 0),
  estado         TEXT NOT NULL DEFAULT 'pendiente'
                   CHECK (estado IN ('pendiente','recibido','rechazado')),
  observaciones  TEXT DEFAULT '',
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.fichas_ingreso ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all" ON public.fichas_ingreso FOR ALL USING (TRUE) WITH CHECK (TRUE);

-- ── Fichas salida ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.fichas_salida (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero_ficha   TEXT UNIQUE NOT NULL,
  fecha_salida   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  conductor_id   UUID NOT NULL REFERENCES public.conductores(id),
  tipo_galon_id  UUID NOT NULL REFERENCES public.tipos_galon(id),
  cantidad       INTEGER NOT NULL CHECK (cantidad > 0),
  destino        TEXT NOT NULL,
  estado         TEXT NOT NULL DEFAULT 'pendiente'
                   CHECK (estado IN ('pendiente','en_ruta','entregado')),
  observaciones  TEXT DEFAULT '',
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.fichas_salida ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all" ON public.fichas_salida FOR ALL USING (TRUE) WITH CHECK (TRUE);

-- ── Control calidad ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.control_calidad (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero_ficha     TEXT UNIQUE NOT NULL,
  fecha_revision   DATE NOT NULL DEFAULT CURRENT_DATE,
  tipo_galon_id    UUID NOT NULL REFERENCES public.tipos_galon(id),
  muestras_tomadas INTEGER NOT NULL CHECK (muestras_tomadas > 0),
  inspector        TEXT NOT NULL,
  nota             TEXT DEFAULT '',
  resultado        TEXT NOT NULL DEFAULT 'aprobado'
                     CHECK (resultado IN ('aprobado','con_observaciones','rechazado')),
  ficha_ingreso_id UUID REFERENCES public.fichas_ingreso(id),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.control_calidad ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all" ON public.control_calidad FOR ALL USING (TRUE) WITH CHECK (TRUE);


-- ============================================================
-- SEED DATA
-- ============================================================

-- Tipos galón
INSERT INTO public.tipos_galon (id, nombre, descripcion, activo) VALUES
  ('a1b2c3d4-0001-0000-0000-000000000001', '5 kg',  'Cilindro pequeño doméstico',    TRUE),
  ('a1b2c3d4-0001-0000-0000-000000000002', '11 kg', 'Cilindro estándar doméstico',   TRUE),
  ('a1b2c3d4-0001-0000-0000-000000000003', '15 kg', 'Cilindro grande industrial',    TRUE)
ON CONFLICT (id) DO NOTHING;

-- Conductores
INSERT INTO public.conductores (id, nombre, patente, activo) VALUES
  ('c0000000-0000-0000-0000-000000000001', 'Juan Pérez',      'BCHK45', TRUE),
  ('c0000000-0000-0000-0000-000000000002', 'Carlos González', 'ABCD12', TRUE),
  ('c0000000-0000-0000-0000-000000000003', 'María Silva',     'WXYZ78', TRUE),
  ('c0000000-0000-0000-0000-000000000004', 'Pedro Rodríguez', 'EFGH34', TRUE)
ON CONFLICT (id) DO NOTHING;

-- Fichas ingreso
INSERT INTO public.fichas_ingreso (numero_ficha, fecha_ingreso, proveedor, tipo_galon_id, cantidad, estado, observaciones) VALUES
  ('ING-001','2026-05-26 09:00:00+00','Gasmarket S.A.',   'a1b2c3d4-0001-0000-0000-000000000002',420,'recibido',  'Lote en buen estado.'),
  ('ING-002','2026-05-28 10:30:00+00','Enap Distribución','a1b2c3d4-0001-0000-0000-000000000001',300,'recibido',  ''),
  ('ING-003','2026-05-30 08:15:00+00','Gasmarket S.A.',   'a1b2c3d4-0001-0000-0000-000000000003',180,'recibido',  'Sin novedades.'),
  ('ING-004','2026-06-02 11:00:00+00','Gasco Chile',      'a1b2c3d4-0001-0000-0000-000000000002',360,'rechazado', 'Cilindros con válvulas dañadas. Devuelto al proveedor.'),
  ('ING-005','2026-06-04 09:45:00+00','Enap Distribución','a1b2c3d4-0001-0000-0000-000000000001',500,'recibido',  ''),
  ('ING-006','2026-06-07 07:30:00+00','Gasmarket S.A.',   'a1b2c3d4-0001-0000-0000-000000000003',220,'recibido',  'Lote prioritario zona sur.'),
  ('ING-007','2026-06-10 10:00:00+00','Gasco Chile',      'a1b2c3d4-0001-0000-0000-000000000002',400,'recibido',  ''),
  ('ING-008','2026-06-14 08:00:00+00','Enap Distribución','a1b2c3d4-0001-0000-0000-000000000001',280,'pendiente', 'Esperando revisión de calidad.'),
  ('ING-009','2026-06-18 09:30:00+00','Gasmarket S.A.',   'a1b2c3d4-0001-0000-0000-000000000003',150,'recibido',  ''),
  ('ING-010','2026-06-22 08:45:00+00','Gasco Chile',      'a1b2c3d4-0001-0000-0000-000000000002',380,'pendiente', 'Recién llegado, pendiente de descarga.');

-- Fichas salida
INSERT INTO public.fichas_salida (numero_ficha, fecha_salida, conductor_id, tipo_galon_id, cantidad, destino, estado) VALUES
  ('SAL-001','2026-05-27 07:00:00+00','c0000000-0000-0000-0000-000000000001','a1b2c3d4-0001-0000-0000-000000000002',120,'Maipú Norte',         'entregado'),
  ('SAL-002','2026-05-29 07:30:00+00','c0000000-0000-0000-0000-000000000002','a1b2c3d4-0001-0000-0000-000000000001', 90,'Las Condes',          'entregado'),
  ('SAL-003','2026-06-01 08:00:00+00','c0000000-0000-0000-0000-000000000003','a1b2c3d4-0001-0000-0000-000000000003', 60,'Renca Industrial',    'entregado'),
  ('SAL-004','2026-06-03 06:45:00+00','c0000000-0000-0000-0000-000000000004','a1b2c3d4-0001-0000-0000-000000000002',150,'Pudahuel Oriente',    'entregado'),
  ('SAL-005','2026-06-05 07:15:00+00','c0000000-0000-0000-0000-000000000001','a1b2c3d4-0001-0000-0000-000000000001',200,'Quilicura Centro',    'entregado'),
  ('SAL-006','2026-06-09 08:30:00+00','c0000000-0000-0000-0000-000000000002','a1b2c3d4-0001-0000-0000-000000000003', 80,'Lampa Agroindustrial','entregado'),
  ('SAL-007','2026-06-12 07:00:00+00','c0000000-0000-0000-0000-000000000003','a1b2c3d4-0001-0000-0000-000000000002',180,'San Bernardo',        'entregado'),
  ('SAL-008','2026-06-16 06:30:00+00','c0000000-0000-0000-0000-000000000004','a1b2c3d4-0001-0000-0000-000000000001',140,'Lo Espejo Residencial','entregado'),
  ('SAL-009','2026-06-20 07:45:00+00','c0000000-0000-0000-0000-000000000001','a1b2c3d4-0001-0000-0000-000000000003', 55,'Cerrillos Industrial', 'en_ruta'),
  ('SAL-010','2026-06-22 07:00:00+00','c0000000-0000-0000-0000-000000000002','a1b2c3d4-0001-0000-0000-000000000002',160,'Estación Central',    'pendiente');

-- Control calidad (usando ids de fichas insertadas arriba)
INSERT INTO public.control_calidad (numero_ficha, fecha_revision, tipo_galon_id, muestras_tomadas, inspector, nota, resultado,
  ficha_ingreso_id) VALUES
  ('CAL-001','2026-05-26','a1b2c3d4-0001-0000-0000-000000000002',20,'Ana Torres',   'Presión dentro del rango normal.',           'aprobado',
    (SELECT id FROM fichas_ingreso WHERE numero_ficha='ING-001' LIMIT 1)),
  ('CAL-002','2026-05-28','a1b2c3d4-0001-0000-0000-000000000001',15,'Roberto Vega', 'Sin observaciones.',                          'aprobado',
    (SELECT id FROM fichas_ingreso WHERE numero_ficha='ING-002' LIMIT 1)),
  ('CAL-003','2026-05-30','a1b2c3d4-0001-0000-0000-000000000003',10,'Ana Torres',   'Dos cilindros con leve oxidación externa.',   'con_observaciones',
    (SELECT id FROM fichas_ingreso WHERE numero_ficha='ING-003' LIMIT 1)),
  ('CAL-004','2026-06-02','a1b2c3d4-0001-0000-0000-000000000002',18,'Marcelo Ruiz', 'Válvulas defectuosas. Lote rechazado.',        'rechazado',
    (SELECT id FROM fichas_ingreso WHERE numero_ficha='ING-004' LIMIT 1)),
  ('CAL-005','2026-06-07','a1b2c3d4-0001-0000-0000-000000000003',12,'Ana Torres',   'Revisión rutinaria. Aprobado.',               'aprobado',
    (SELECT id FROM fichas_ingreso WHERE numero_ficha='ING-006' LIMIT 1)),
  ('CAL-006','2026-06-10','a1b2c3d4-0001-0000-0000-000000000002',22,'Roberto Vega', 'Lote cumple normativa vigente.',              'aprobado',
    (SELECT id FROM fichas_ingreso WHERE numero_ficha='ING-007' LIMIT 1)),
  ('CAL-007','2026-06-18','a1b2c3d4-0001-0000-0000-000000000003', 8,'Marcelo Ruiz', 'Revisión express. Sin problemas.',           'aprobado',
    (SELECT id FROM fichas_ingreso WHERE numero_ficha='ING-009' LIMIT 1)),
  ('CAL-008','2026-06-22','a1b2c3d4-0001-0000-0000-000000000001',14,'Ana Torres',   'Inspección pendiente de completar.',          'con_observaciones',
    NULL);
