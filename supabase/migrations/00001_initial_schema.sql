-- =============================================================
-- BASELINE: el schema real de produccion
-- =============================================================
-- Este archivo NO es "lo que se escribio el primer dia": es el schema que hay
-- hoy en produccion, sacado del schema.sql del backup diario (30/07/2026).
--
-- Antes era un schema inventado que no coincidia con la base real: nombraba
-- get_user_empresa_id() donde produccion tiene get_empresa_id(), le faltaban
-- las columnas foto_* de traslados y le sobraban fotos_urls, fecha_carga,
-- kilometros_previstos y updated_at. Como produccion se armo a mano desde el
-- dashboard y despues se baselineo, la diferencia no molestaba ahi, pero hacia
-- que el repo no pudiera reconstruir la base: `supabase start` sobre una base
-- vacia moria en la septima migracion.
--
-- Las migraciones posteriores siguen aplicandose encima. Son idempotentes
-- (drop if exists antes de cada create), asi que re-declaran lo que este
-- baseline ya trae sin chocar.
--
-- Si algun dia el schema de produccion cambia por fuera de una migracion, este
-- archivo queda viejo otra vez. La forma de regenerarlo es el schema.sql de
-- cualquier backup, o `supabase db dump --linked`.




SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE TYPE "public"."plan_enum" AS ENUM (
    'free',
    'premium',
    'admin'
);


ALTER TYPE "public"."plan_enum" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."consumir_rate_limit"("p_clave" "text", "p_max" integer, "p_ventana_segundos" integer) RETURNS TABLE("permitido" boolean, "reintentar_en" integer)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
declare
  v_ahora timestamptz := now();
  v_corte timestamptz := v_ahora - make_interval(secs => p_ventana_segundos);
  v_contador integer;
  v_inicio timestamptz;
begin
  -- Limpieza oportunista: sin esto la tabla crece con una fila por IP para
  -- siempre. Se hace de vez en cuando para no pagarla en cada request.
  if random() < 0.01 then
    delete from public.rate_limits
     where ventana_inicio < v_ahora - interval '1 day';
  end if;

  insert into public.rate_limits as rl (clave, contador, ventana_inicio)
  values (p_clave, 1, v_ahora)
  on conflict (clave) do update
    set contador = case when rl.ventana_inicio < v_corte then 1 else rl.contador + 1 end,
        ventana_inicio = case when rl.ventana_inicio < v_corte then v_ahora else rl.ventana_inicio end
  returning rl.contador, rl.ventana_inicio into v_contador, v_inicio;

  return query select
    v_contador <= p_max,
    greatest(
      ceil(extract(epoch from (v_inicio + make_interval(secs => p_ventana_segundos) - v_ahora)))::integer,
      0
    );
end;
$$;


ALTER FUNCTION "public"."consumir_rate_limit"("p_clave" "text", "p_max" integer, "p_ventana_segundos" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."expulsar_chofer"("chofer_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
declare
  v_admin_empresa uuid;
  v_admin_rol text;
  v_chofer_empresa uuid;
begin
  select empresa_id, rol into v_admin_empresa, v_admin_rol
    from public.perfiles where id = auth.uid();

  if v_admin_rol is distinct from 'admin' then
    raise exception 'solo un admin puede expulsar choferes'
      using errcode = '42501';
  end if;

  select empresa_id into v_chofer_empresa
    from public.perfiles where id = chofer_id;

  if v_admin_empresa is null or v_chofer_empresa is distinct from v_admin_empresa then
    raise exception 'no tenes permiso para expulsar este chofer'
      using errcode = '42501';
  end if;

  update public.perfiles set empresa_id = null where id = chofer_id;
  return true;
end;
$$;


ALTER FUNCTION "public"."expulsar_chofer"("chofer_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."foto_es_de_mi_empresa"("nombre_objeto" "text") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
  select exists (
    select 1
      from public.traslados t
     where t.id::text = (storage.foldername(nombre_objeto))[1]
       and t.empresa_id = public.get_empresa_id()
  );
$$;


ALTER FUNCTION "public"."foto_es_de_mi_empresa"("nombre_objeto" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_empresa_id"() RETURNS "uuid"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
  select empresa_id from public.perfiles where id = auth.uid();
$$;


ALTER FUNCTION "public"."get_empresa_id"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_resumen_mensual"("p_empresa_id" "uuid", "p_meses" integer DEFAULT 6) RETURNS TABLE("mes" "text", "ingresos" numeric, "gastos" numeric)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
  with limites as (
    select date_trunc('month', now()) - make_interval(months => greatest(p_meses, 1) - 1) as desde
  ),
  meses as (
    select to_char(generate_series(
      (select desde from limites),
      date_trunc('month', now()),
      interval '1 month'
    ), 'YYYY-MM') as mes
  ),
  ing as (
    select to_char(date_trunc('month', created_at), 'YYYY-MM') as mes,
           sum(coalesce(importe_total, 0)) as total
      from public.traslados
     where empresa_id = p_empresa_id
       and estado = 'completado'
       and estado_pago <> 'pendiente'
       and created_at >= (select desde from limites)
     group by 1
  ),
  gas as (
    select to_char(date_trunc('month', fecha), 'YYYY-MM') as mes,
           sum(coalesce(importe, 0)) as total
      from public.gastos
     where empresa_id = p_empresa_id
       and fecha >= (select desde from limites)::date
     group by 1
  )
  select m.mes,
         coalesce(ing.total, 0)::numeric as ingresos,
         coalesce(gas.total, 0)::numeric as gastos
    from meses m
    left join ing on ing.mes = m.mes
    left join gas on gas.mes = m.mes
   where p_empresa_id = public.get_empresa_id()
   order by m.mes;
$$;


ALTER FUNCTION "public"."get_resumen_mensual"("p_empresa_id" "uuid", "p_meses" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_total_ingresos"("p_empresa_id" "uuid") RETURNS numeric
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
  select coalesce(sum(coalesce(importe_total, 0)), 0)::numeric
    from public.traslados
   where empresa_id = p_empresa_id
     and estado = 'completado'
     and estado_pago <> 'pendiente'
     and p_empresa_id = public.get_empresa_id();
$$;


ALTER FUNCTION "public"."get_total_ingresos"("p_empresa_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_traslados_counts"("p_empresa_id" "uuid") RETURNS json
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
  select json_build_object(
    'total', count(*),
    'pendiente', count(*) filter (where estado = 'pendiente'),
    'en_curso', count(*) filter (where estado = 'en_curso'),
    'completado', count(*) filter (where estado = 'completado')
  )
  from public.traslados
  where empresa_id = p_empresa_id
    and empresa_id = public.get_empresa_id();
$$;


ALTER FUNCTION "public"."get_traslados_counts"("p_empresa_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
declare
  v_empresa uuid := nullif(new.raw_user_meta_data->>'empresa_id', '')::uuid;
  v_ocupada boolean;
begin
  if v_empresa is not null then
    select exists(select 1 from public.perfiles where empresa_id = v_empresa)
      into v_ocupada;

    if v_ocupada then
      raise exception 'empresa_id no disponible para alta directa'
        using errcode = '42501';
    end if;
  end if;

  insert into public.perfiles (id, nombre_completo, rol, empresa_id)
  values (
    new.id,
    new.raw_user_meta_data->>'nombre_completo',
    case when v_empresa is null then 'chofer' else 'admin' end,
    v_empresa
  )
  on conflict (id) do nothing;

  return new;
end;
$$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."perfiles_lock_privilegios"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
begin
  -- 'authenticated' = llamada desde el cliente via PostgREST.
  -- expulsar_chofer corre como 'postgres' y service_role como 'service_role';
  -- esos caminos tienen que poder seguir escribiendo rol/empresa_id.
  if current_user <> 'authenticated' then
    return new;
  end if;

  if new.id is distinct from old.id
     or new.rol is distinct from old.rol
     or new.empresa_id is distinct from old.empresa_id then
    raise exception 'no se puede modificar id, rol ni empresa_id'
      using errcode = '42501';
  end if;

  return new;
end;
$$;


ALTER FUNCTION "public"."perfiles_lock_privilegios"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."ruta_de_foto"("valor" "text") RETURNS "text"
    LANGUAGE "sql" IMMUTABLE
    AS $$
  select case
    when valor is null then null
    when position('/fotos-traslados/' in valor) > 0
      then split_part(
             substring(valor from position('/fotos-traslados/' in valor) + length('/fotos-traslados/')),
             '?', 1
           )
    else ltrim(valor, '/')
  end;
$$;


ALTER FUNCTION "public"."ruta_de_foto"("valor" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_perfil_email"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
begin
  -- Busca el email del usuario en la tabla de usuarios de Auth
  select email into NEW.email from auth.users where id = NEW.id;
  return NEW;
end;
$$;


ALTER FUNCTION "public"."set_perfil_email"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."audit_log" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "empresa_id" "uuid",
    "action" "text" NOT NULL,
    "details" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "ip_address" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."audit_log" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."empresas" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "nombre" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."empresas" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."fotos_urls_respaldo" (
    "traslado_id" "uuid" NOT NULL,
    "foto_frontal" "text",
    "foto_lateral" "text",
    "foto_trasera" "text",
    "foto_interior" "text",
    "respaldado_en" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."fotos_urls_respaldo" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."gastos" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "empresa_id" "uuid",
    "usuario_id" "uuid" NOT NULL,
    "tipo" "text" NOT NULL,
    "importe" numeric NOT NULL,
    "descripcion" "text",
    "fecha" "date" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "gastos_tipo_check" CHECK (("tipo" = ANY (ARRAY['combustible'::"text", 'seguro'::"text", 'mantenimiento'::"text", 'peaje'::"text", 'patente'::"text", 'multa'::"text", 'otro'::"text"])))
);


ALTER TABLE "public"."gastos" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."inspecciones" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "traslado_id" "uuid",
    "tipo" "text",
    "fotos_urls" "jsonb" DEFAULT '[]'::"jsonb",
    "observaciones" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "inspecciones_tipo_check" CHECK (("tipo" = ANY (ARRAY['recepcion'::"text", 'entrega'::"text"])))
);


ALTER TABLE "public"."inspecciones" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."invitaciones" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "empresa_id" "uuid",
    "codigo" character varying(20) NOT NULL,
    "usado" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "expires_at" timestamp with time zone DEFAULT ("now"() + '7 days'::interval) NOT NULL
);


ALTER TABLE "public"."invitaciones" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."perfiles" (
    "id" "uuid" NOT NULL,
    "empresa_id" "uuid",
    "nombre_completo" "text",
    "rol" "text" DEFAULT 'admin'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "plan" "text" DEFAULT 'free'::"public"."plan_enum",
    "plan_renovacion" "date",
    "traslados_mes_actual" integer DEFAULT 0,
    "email" "text",
    "fecha_compra" timestamp with time zone,
    "mp_subscription_id" "text",
    "onboarding_completed" boolean DEFAULT false NOT NULL,
    "telefono" "text",
    CONSTRAINT "perfiles_rol_check" CHECK (("rol" = ANY (ARRAY['admin'::"text", 'chofer'::"text"]))),
    CONSTRAINT "perfiles_telefono_largo" CHECK ((("telefono" IS NULL) OR ("char_length"("telefono") <= 30)))
);

ALTER TABLE ONLY "public"."perfiles" REPLICA IDENTITY FULL;


ALTER TABLE "public"."perfiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."planes" (
    "id" "text" NOT NULL,
    "nombre" "text" NOT NULL,
    "traslados_max" integer,
    "puede_agregar_personas" boolean NOT NULL,
    "puede_exportar" boolean NOT NULL,
    "precio" numeric NOT NULL,
    "duracion_dias" integer NOT NULL,
    "descripcion" "text"
);


ALTER TABLE "public"."planes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."rate_limits" (
    "clave" "text" NOT NULL,
    "contador" integer DEFAULT 0 NOT NULL,
    "ventana_inicio" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."rate_limits" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."traslados" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "empresa_id" "uuid",
    "chofer_id" "uuid",
    "marca_modelo" "text" NOT NULL,
    "matricula" "text",
    "es_0km" boolean DEFAULT false,
    "estado" "text" DEFAULT 'pendiente'::"text",
    "importe_total" numeric(10,2),
    "created_at" timestamp with time zone DEFAULT "now"(),
    "foto_frontal" "text",
    "foto_lateral" "text",
    "foto_trasera" "text",
    "foto_interior" "text",
    "observaciones" "text",
    "departamento" "text",
    "direccion" "text",
    "estado_pago" "text" DEFAULT 'pendiente'::"text",
    "desde" "text",
    "hasta" "text",
    CONSTRAINT "traslados_estado_check" CHECK (("estado" = ANY (ARRAY['pendiente'::"text", 'en_curso'::"text", 'completado'::"text"]))),
    CONSTRAINT "traslados_estado_pago_check" CHECK (("estado_pago" = ANY (ARRAY['pendiente'::"text", 'efectivo'::"text", 'transferencia'::"text"])))
);

ALTER TABLE ONLY "public"."traslados" REPLICA IDENTITY FULL;


ALTER TABLE "public"."traslados" OWNER TO "postgres";


ALTER TABLE ONLY "public"."audit_log"
    ADD CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."empresas"
    ADD CONSTRAINT "empresas_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."fotos_urls_respaldo"
    ADD CONSTRAINT "fotos_urls_respaldo_pkey" PRIMARY KEY ("traslado_id");



ALTER TABLE ONLY "public"."gastos"
    ADD CONSTRAINT "gastos_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."inspecciones"
    ADD CONSTRAINT "inspecciones_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."invitaciones"
    ADD CONSTRAINT "invitaciones_codigo_key" UNIQUE ("codigo");



ALTER TABLE ONLY "public"."invitaciones"
    ADD CONSTRAINT "invitaciones_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."perfiles"
    ADD CONSTRAINT "perfiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."planes"
    ADD CONSTRAINT "planes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."rate_limits"
    ADD CONSTRAINT "rate_limits_pkey" PRIMARY KEY ("clave");



ALTER TABLE ONLY "public"."traslados"
    ADD CONSTRAINT "traslados_pkey" PRIMARY KEY ("id");



CREATE INDEX "idx_audit_log_empresa_created" ON "public"."audit_log" USING "btree" ("empresa_id", "created_at" DESC);



CREATE INDEX "idx_audit_log_user" ON "public"."audit_log" USING "btree" ("user_id");



CREATE INDEX "idx_rate_limits_ventana" ON "public"."rate_limits" USING "btree" ("ventana_inicio");



CREATE INDEX "idx_traslados_chofer_id" ON "public"."traslados" USING "btree" ("chofer_id");



CREATE OR REPLACE TRIGGER "perfiles_lock_privilegios_trg" BEFORE UPDATE ON "public"."perfiles" FOR EACH ROW EXECUTE FUNCTION "public"."perfiles_lock_privilegios"();



CREATE OR REPLACE TRIGGER "set_perfil_email_trigger" BEFORE INSERT ON "public"."perfiles" FOR EACH ROW EXECUTE FUNCTION "public"."set_perfil_email"();



ALTER TABLE ONLY "public"."audit_log"
    ADD CONSTRAINT "audit_log_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."audit_log"
    ADD CONSTRAINT "audit_log_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."fotos_urls_respaldo"
    ADD CONSTRAINT "fotos_urls_respaldo_traslado_id_fkey" FOREIGN KEY ("traslado_id") REFERENCES "public"."traslados"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."gastos"
    ADD CONSTRAINT "gastos_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id");



ALTER TABLE ONLY "public"."gastos"
    ADD CONSTRAINT "gastos_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "public"."perfiles"("id");



ALTER TABLE ONLY "public"."inspecciones"
    ADD CONSTRAINT "inspecciones_traslado_id_fkey" FOREIGN KEY ("traslado_id") REFERENCES "public"."traslados"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."invitaciones"
    ADD CONSTRAINT "invitaciones_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."perfiles"
    ADD CONSTRAINT "perfiles_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."perfiles"
    ADD CONSTRAINT "perfiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."traslados"
    ADD CONSTRAINT "traslados_chofer_id_fkey" FOREIGN KEY ("chofer_id") REFERENCES "public"."perfiles"("id");



ALTER TABLE ONLY "public"."traslados"
    ADD CONSTRAINT "traslados_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE CASCADE;



CREATE POLICY "Actualizar perfiles de la empresa" ON "public"."perfiles" FOR UPDATE TO "authenticated" USING (("empresa_id" = "public"."get_empresa_id"()));



CREATE POLICY "Admin crea traslados de su empresa" ON "public"."traslados" FOR INSERT WITH CHECK (("empresa_id" IN ( SELECT "perfiles"."empresa_id"
   FROM "public"."perfiles"
  WHERE (("perfiles"."id" = "auth"."uid"()) AND ("perfiles"."rol" = 'admin'::"text")))));



CREATE POLICY "Admin puede actualizar perfiles de su empresa" ON "public"."perfiles" FOR UPDATE TO "authenticated" USING ((("empresa_id" = ( SELECT "perfiles_1"."empresa_id"
   FROM "public"."perfiles" "perfiles_1"
  WHERE ("perfiles_1"."id" = "auth"."uid"()))) OR ("empresa_id" IS NULL))) WITH CHECK ((("empresa_id" IS NULL) OR ("empresa_id" = ( SELECT "perfiles_1"."empresa_id"
   FROM "public"."perfiles" "perfiles_1"
  WHERE ("perfiles_1"."id" = "auth"."uid"())))));



CREATE POLICY "Admin puede crear traslados" ON "public"."traslados" FOR INSERT TO "authenticated" WITH CHECK (("empresa_id" = "public"."get_empresa_id"()));



CREATE POLICY "Admin puede leer traslados" ON "public"."traslados" FOR SELECT TO "authenticated" USING (("empresa_id" = "public"."get_empresa_id"()));



CREATE POLICY "Admins crean invitaciones" ON "public"."invitaciones" FOR INSERT WITH CHECK (("empresa_id" IN ( SELECT "perfiles"."empresa_id"
   FROM "public"."perfiles"
  WHERE (("perfiles"."id" = "auth"."uid"()) AND ("perfiles"."rol" = 'admin'::"text")))));



CREATE POLICY "Chofer puede leer sus traslados" ON "public"."traslados" FOR SELECT TO "authenticated" USING (("chofer_id" = "auth"."uid"()));



CREATE POLICY "Crear gastos" ON "public"."gastos" FOR INSERT TO "authenticated" WITH CHECK ((("usuario_id" = "auth"."uid"()) AND (("empresa_id" IS NULL) OR ("empresa_id" = "public"."get_empresa_id"()))));



CREATE POLICY "Eliminar gastos" ON "public"."gastos" FOR DELETE USING ((("usuario_id" = "auth"."uid"()) OR (( SELECT "perfiles"."rol"
   FROM "public"."perfiles"
  WHERE ("perfiles"."id" = "auth"."uid"())) = 'admin'::"text")));



CREATE POLICY "Leer perfil propio" ON "public"."perfiles" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "id"));



CREATE POLICY "Leer perfiles de la empresa" ON "public"."perfiles" FOR SELECT TO "authenticated" USING (("empresa_id" = "public"."get_empresa_id"()));



CREATE POLICY "Usuarios editan su perfil" ON "public"."perfiles" FOR UPDATE USING (("auth"."uid"() = "id"));



CREATE POLICY "Usuarios ven su perfil" ON "public"."perfiles" FOR SELECT USING (("auth"."uid"() = "id"));



CREATE POLICY "Ver gastos" ON "public"."gastos" FOR SELECT USING ((("usuario_id" = "auth"."uid"()) OR ("empresa_id" IN ( SELECT "perfiles"."empresa_id"
   FROM "public"."perfiles"
  WHERE (("perfiles"."id" = "auth"."uid"()) AND ("perfiles"."empresa_id" IS NOT NULL))))));



CREATE POLICY "Ver traslados" ON "public"."traslados" FOR SELECT USING ((("empresa_id" IN ( SELECT "perfiles"."empresa_id"
   FROM "public"."perfiles"
  WHERE (("perfiles"."id" = "auth"."uid"()) AND ("perfiles"."empresa_id" IS NOT NULL)))) OR ("chofer_id" = "auth"."uid"())));



ALTER TABLE "public"."audit_log" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "audit_log_select_admin" ON "public"."audit_log" FOR SELECT TO "authenticated" USING ((("empresa_id" = "public"."get_empresa_id"()) AND (EXISTS ( SELECT 1
   FROM "public"."perfiles"
  WHERE (("perfiles"."id" = "auth"."uid"()) AND ("perfiles"."rol" = 'admin'::"text"))))));



ALTER TABLE "public"."empresas" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "empresas_select_propia" ON "public"."empresas" FOR SELECT TO "authenticated" USING (("id" = "public"."get_empresa_id"()));



CREATE POLICY "empresas_update_admin" ON "public"."empresas" FOR UPDATE TO "authenticated" USING ((("id" = "public"."get_empresa_id"()) AND (EXISTS ( SELECT 1
   FROM "public"."perfiles"
  WHERE (("perfiles"."id" = "auth"."uid"()) AND ("perfiles"."rol" = 'admin'::"text"))))));



ALTER TABLE "public"."fotos_urls_respaldo" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."gastos" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."invitaciones" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "invitaciones_select_empresa" ON "public"."invitaciones" FOR SELECT TO "authenticated" USING (("empresa_id" = "public"."get_empresa_id"()));



CREATE POLICY "invitaciones_update_admin" ON "public"."invitaciones" FOR UPDATE TO "authenticated" USING ((("empresa_id" = "public"."get_empresa_id"()) AND (EXISTS ( SELECT 1
   FROM "public"."perfiles"
  WHERE (("perfiles"."id" = "auth"."uid"()) AND ("perfiles"."rol" = 'admin'::"text"))))));



ALTER TABLE "public"."perfiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."rate_limits" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."traslados" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "traslados_delete_admin_empresa" ON "public"."traslados" FOR DELETE TO "authenticated" USING ((("empresa_id" = "public"."get_empresa_id"()) AND (EXISTS ( SELECT 1
   FROM "public"."perfiles"
  WHERE (("perfiles"."id" = "auth"."uid"()) AND ("perfiles"."rol" = 'admin'::"text"))))));



CREATE POLICY "traslados_update_empresa" ON "public"."traslados" FOR UPDATE TO "authenticated" USING (("empresa_id" = "public"."get_empresa_id"())) WITH CHECK (("empresa_id" = "public"."get_empresa_id"()));





ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";






ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."perfiles";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."traslados";



GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";






















































































































































REVOKE ALL ON FUNCTION "public"."consumir_rate_limit"("p_clave" "text", "p_max" integer, "p_ventana_segundos" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."consumir_rate_limit"("p_clave" "text", "p_max" integer, "p_ventana_segundos" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."expulsar_chofer"("chofer_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."expulsar_chofer"("chofer_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."foto_es_de_mi_empresa"("nombre_objeto" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."foto_es_de_mi_empresa"("nombre_objeto" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."foto_es_de_mi_empresa"("nombre_objeto" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_empresa_id"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_empresa_id"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_resumen_mensual"("p_empresa_id" "uuid", "p_meses" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_resumen_mensual"("p_empresa_id" "uuid", "p_meses" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_resumen_mensual"("p_empresa_id" "uuid", "p_meses" integer) TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_total_ingresos"("p_empresa_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_total_ingresos"("p_empresa_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_total_ingresos"("p_empresa_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_traslados_counts"("p_empresa_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_traslados_counts"("p_empresa_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."perfiles_lock_privilegios"() TO "anon";
GRANT ALL ON FUNCTION "public"."perfiles_lock_privilegios"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."perfiles_lock_privilegios"() TO "service_role";



GRANT ALL ON FUNCTION "public"."ruta_de_foto"("valor" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."ruta_de_foto"("valor" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."ruta_de_foto"("valor" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."set_perfil_email"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_perfil_email"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_perfil_email"() TO "service_role";


















GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."audit_log" TO "anon";
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."audit_log" TO "authenticated";
GRANT ALL ON TABLE "public"."audit_log" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."empresas" TO "anon";
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."empresas" TO "authenticated";
GRANT ALL ON TABLE "public"."empresas" TO "service_role";



GRANT UPDATE("nombre") ON TABLE "public"."empresas" TO "authenticated";



GRANT ALL ON TABLE "public"."fotos_urls_respaldo" TO "service_role";



GRANT ALL ON TABLE "public"."gastos" TO "anon";
GRANT ALL ON TABLE "public"."gastos" TO "authenticated";
GRANT ALL ON TABLE "public"."gastos" TO "service_role";



GRANT ALL ON TABLE "public"."inspecciones" TO "anon";
GRANT ALL ON TABLE "public"."inspecciones" TO "authenticated";
GRANT ALL ON TABLE "public"."inspecciones" TO "service_role";



GRANT ALL ON TABLE "public"."invitaciones" TO "anon";
GRANT ALL ON TABLE "public"."invitaciones" TO "authenticated";
GRANT ALL ON TABLE "public"."invitaciones" TO "service_role";



GRANT ALL ON TABLE "public"."perfiles" TO "anon";
GRANT ALL ON TABLE "public"."perfiles" TO "authenticated";
GRANT ALL ON TABLE "public"."perfiles" TO "service_role";



GRANT ALL ON TABLE "public"."planes" TO "anon";
GRANT ALL ON TABLE "public"."planes" TO "authenticated";
GRANT ALL ON TABLE "public"."planes" TO "service_role";



GRANT ALL ON TABLE "public"."rate_limits" TO "service_role";



GRANT ALL ON TABLE "public"."traslados" TO "anon";
GRANT ALL ON TABLE "public"."traslados" TO "authenticated";
GRANT ALL ON TABLE "public"."traslados" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";































