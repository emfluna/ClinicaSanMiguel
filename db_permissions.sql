
-- =========================================================
-- SCRIPT DE CORRECCIÓN DE PERMISOS (RLS FIX)
-- Ejecuta esto en Supabase -> SQL Editor para arreglar el problema de guardado
-- =========================================================

-- 1. Asegurar que las políticas antiguas se borren para evitar conflictos
DROP POLICY IF EXISTS "Acceso total pacientes" ON public.pacientes;
DROP POLICY IF EXISTS "Acceso total citas" ON public.citas;
DROP POLICY IF EXISTS "Acceso total finanzas" ON public.finanzas;
DROP POLICY IF EXISTS "Acceso total inventario" ON public.inventario;
DROP POLICY IF EXISTS "Acceso total servicios" ON public.servicios;

-- 2. Habilitar RLS (Seguridad a nivel de fila) explícitamente
ALTER TABLE public.pacientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.citas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finanzas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventario ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.servicios ENABLE ROW LEVEL SECURITY;

-- 3. CREAR NUEVAS POLÍTICAS "PERMISSIVE" (ABIERTAS PARA TODOS LOS ROLES)
-- Esto permite que usuarios autenticados y anónimos (si es necesario) inserten datos
-- sin restricciones de ID o autenticación estricta por ahora.

CREATE POLICY "Acceso total pacientes" ON public.pacientes
FOR ALL
USING (true)
WITH CHECK (true);

CREATE POLICY "Acceso total citas" ON public.citas
FOR ALL
USING (true)
WITH CHECK (true);

CREATE POLICY "Acceso total finanzas" ON public.finanzas
FOR ALL
USING (true)
WITH CHECK (true);

CREATE POLICY "Acceso total inventario" ON public.inventario
FOR ALL
USING (true)
WITH CHECK (true);

CREATE POLICY "Acceso total servicios" ON public.servicios
FOR ALL
USING (true)
WITH CHECK (true);

-- 4. GRANT EXPLICITO A ROLES (Por si acaso Supabase restringió 'anon' o 'authenticated')
GRANT ALL ON TABLE public.pacientes TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.citas TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.finanzas TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.inventario TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.servicios TO anon, authenticated, service_role;

-- Confirmación visual
SELECT 'Permisos corregidos exitosamente. Intenta guardar un paciente ahora.' as resultado;
