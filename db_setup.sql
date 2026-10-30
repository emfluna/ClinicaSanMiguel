
-- ==============================================================================
-- SCRIPT DE BASE DE DATOS FINAL: CLÍNICA DENTAL SAN MIGUEL
-- ==============================================================================

-- 1. EXTENSIONES
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. TABLA: PACIENTES
CREATE TABLE IF NOT EXISTS public.pacientes (
    id uuid NOT NULL DEFAULT uuid_generate_v4() PRIMARY KEY,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    nombres text NOT NULL,
    apellidos text NOT NULL,
    dni text,
    fecha_nacimiento date,
    genero text DEFAULT 'Other',
    telefono text,
    email text,
    direccion text,
    antecedentes_medicos jsonb DEFAULT '{}'::jsonb,
    historial_clinico jsonb DEFAULT '[]'::jsonb,
    observaciones jsonb DEFAULT '{}'::jsonb,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    deleted_at timestamp with time zone -- COLUMNA PARA SOFT DELETE
);

-- Function to set updated_at timestamp
CREATE OR REPLACE FUNCTION set_updated_at_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update updated_at before each update operation, ensuring it doesn't run if deleted_at is being set
DROP TRIGGER IF EXISTS tr_pacientes_updated_at ON public.pacientes;
CREATE TRIGGER tr_pacientes_updated_at
BEFORE UPDATE ON public.pacientes
FOR EACH ROW
WHEN (NEW.deleted_at IS DISTINCT FROM OLD.deleted_at IS FALSE) -- Only update if deleted_at is NOT changing
EXECUTE FUNCTION set_updated_at_timestamp();


-- 3. TABLA: GALERIA CLINICA
CREATE TABLE IF NOT EXISTS public.galeria_clinica (
    id uuid NOT NULL DEFAULT uuid_generate_v4() PRIMARY KEY,
    fecha timestamp with time zone DEFAULT timezone('utc'::text, now()),
    paciente_id uuid REFERENCES public.pacientes(id) ON DELETE CASCADE,
    url_foto text NOT NULL,
    tipo_imagen text DEFAULT 'Foto Clínica',
    descripcion text
);

-- 4. TABLA: FINANZAS
CREATE TABLE IF NOT EXISTS public.finanzas (
    id uuid NOT NULL DEFAULT uuid_generate_v4() PRIMARY KEY,
    fecha date DEFAULT CURRENT_DATE,
    hora text DEFAULT to_char(now(), 'HH24:MI'),
    paciente_id uuid REFERENCES public.pacientes(id) ON DELETE CASCADE,
    tipo_movimiento text CHECK (tipo_movimiento IN ('Cargo', 'Abono')),
    monto numeric NOT NULL,
    moneda text DEFAULT 'PEN',
    descripcion text,
    autor text
);

-- 5. TABLA: CITAS
CREATE TABLE IF NOT EXISTS public.citas (
    id uuid NOT NULL DEFAULT uuid_generate_v4() PRIMARY KEY,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    paciente_id uuid REFERENCES public.pacientes(id) ON DELETE CASCADE,
    fecha date NOT NULL,
    hora text NOT NULL,
    motivo text,
    estado text DEFAULT 'scheduled',
    recordatorio_enviado boolean DEFAULT false
);

-- 6. TABLA: INVENTARIO
CREATE TABLE IF NOT EXISTS public.inventario (
    id uuid NOT NULL DEFAULT uuid_generate_v4() PRIMARY KEY,
    fecha date DEFAULT CURRENT_DATE,
    hora text DEFAULT to_char(now(), 'HH24:MI'),
    texto text NOT NULL,
    status text DEFAULT 'pending',
    author text
);

-- 7. TABLA: ACTIVIDADES (NUEVA)
CREATE TABLE IF NOT EXISTS public.actividades (
    id uuid NOT NULL DEFAULT uuid_generate_v4() PRIMARY KEY,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    type text NOT NULL,
    description text NOT NULL,
    patient_name text NOT NULL,
    amount numeric,
    author text
);

-- 8. VISTA: PACIENTES_ACTIVOS
-- Esta vista solo muestra pacientes que no han sido borrados lógicamente
CREATE OR REPLACE VIEW public.pacientes_activos AS
SELECT
    id, created_at, nombres, apellidos, dni, fecha_nacimiento, genero, telefono, email, direccion, antecedentes_medicos, historial_clinico, observaciones, updated_at
FROM
    public.pacientes
WHERE
    deleted_at IS NULL;

-- 9. RESET DE SEGURIDAD (RLS) PARA PERMITIR GUARDAR
ALTER TABLE public.pacientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.galeria_clinica ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finanzas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.citas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventario ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.actividades ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pacientes_activos ENABLE ROW LEVEL SECURITY; -- Habilitar RLS en la vista también

DROP POLICY IF EXISTS "Acceso Total Pacientes" ON public.pacientes;
DROP POLICY IF EXISTS "Acceso Total Galeria" ON public.galeria_clinica;
DROP POLICY IF EXISTS "Acceso Total Finanzas" ON public.finanzas;
DROP POLICY IF EXISTS "Acceso Total Citas" ON public.citas;
DROP POLICY IF EXISTS "Acceso Total Inventario" ON public.inventario;
DROP POLICY IF EXISTS "Acceso Total Actividades" ON public.actividades;
DROP POLICY IF EXISTS "Acceso Total Pacientes Activos" ON public.pacientes_activos;

-- Nueva política para la tabla base de pacientes (solo permitir inserciones y actualizaciones, no se leerá directamente de aquí)
CREATE POLICY "Permitir CRUD en pacientes (incluyendo soft delete)" ON public.pacientes FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Acceso Total Galeria" ON public.galeria_clinica FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Acceso Total Finanzas" ON public.finanzas FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Acceso Total Citas" ON public.citas FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Acceso Total Inventario" ON public.inventario FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Acceso Total Actividades" ON public.actividades FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Acceso Total Pacientes Activos" ON public.pacientes_activos FOR SELECT USING (true); -- La vista solo permite SELECT

GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role; -- Asegurar que las secuencias también tengan permisos
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO anon, authenticated, service_role; -- Asegurar que las funciones también tengan permisos
GRANT ALL ON public.pacientes_activos TO anon, authenticated, service_role; -- Conceder permisos a la vista
