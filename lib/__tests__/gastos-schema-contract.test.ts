// @vitest-environment node
/**
 * Guardrail contra el drift que rompió el alta de gastos:
 * la columna dueña de `public.gastos` se llama `usuario_id` en la DB.
 * El commit 1808daf la renombró a `user_id` solo en el API route y el insert
 * empezó a fallar con Postgres 42703. Este test falla si vuelve a pasar.
 *
 * Verificado contra la DB viva (2026-07-26): las columnas de public.gastos son
 * id, empresa_id, usuario_id, tipo, importe, descripcion, fecha, created_at.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { isValidTipoGasto } from '../validation'

const root = path.resolve(__dirname, '../..')
const read = (rel: string) => readFileSync(path.join(root, rel), 'utf8')

const ROUTE = 'app/api/gastos/route.ts'
const HOOK = 'lib/useSupabaseQuery.ts'
const PAGE = 'app/(authenticated)/dashboard/gastos/page.tsx'
/**
 * El baseline dejo de ser un schema inventado y paso a ser el dump real de
 * produccion, asi que ahora declara las columnas entre comillas y en mayusculas
 * (`"usuario_id" "uuid"`). Las migraciones que ese baseline ya contiene viven en
 * supabase/historico/.
 */
const MIGRATION = 'supabase/migrations/00001_initial_schema.sql'
const TIPO_CHECK = 'supabase/historico/20260728_gastos_tipo_check.sql'

/**
 * `user_id` sigue siendo legítimo como nombre de campo del payload JSON que el
 * cliente manda a POST /api/gastos (solo se usa para comparar contra la sesión).
 * Lo que nunca puede volver es `user_id` como nombre de columna.
 */
const USOS_PERMITIDOS_EN_ROUTE = [
  /body\.user_id/g,
  /'user_id inválido'/g,
  // Desestructurado del payload ya validado por el esquema y renombrado en el
  // acto: sigue siendo la key del JSON, no un nombre de columna.
  /user_id: userId/g,
]

/** Mismo motivo, del lado del cliente: es la key del JSON, no una columna. */
const USOS_PERMITIDOS_EN_PAGE = [/user_id: perfil\.id/g]

describe('contrato de schema de gastos', () => {
  it('el API route no usa user_id como columna', () => {
    let src = read(ROUTE)
    for (const permitido of USOS_PERMITIDOS_EN_ROUTE) src = src.replace(permitido, '')

    const restantes = src.match(/\buser_id\b/g) ?? []
    expect(restantes, `usos de user_id como columna en ${ROUTE}`).toEqual([])
  })

  it('el API route inserta y lee usuario_id', () => {
    const src = read(ROUTE)
    expect(src).toContain('usuario_id: user.id')
    expect(src).toContain("select('id, empresa_id, usuario_id')")
    expect(src).toContain('gasto.usuario_id !== user.id')
  })

  it('el read path usa usuario_id y no user_id', () => {
    for (const [rel, permitidos] of [[HOOK, []], [PAGE, USOS_PERMITIDOS_EN_PAGE]] as const) {
      let src = read(rel)
      for (const permitido of permitidos) src = src.replace(permitido, '')

      expect(src.match(/\buser_id\b/g) ?? [], `user_id como columna en ${rel}`).toEqual([])
      expect(src).toMatch(/\busuario_id\b/)
    }
  })

  it('la migración declara usuario_id en gastos y en sus políticas RLS', () => {
    const sql = read(MIGRATION)

    // El baseline es un dump de pg_dump: comillas, mayusculas y las FK en un
    // ALTER TABLE aparte. Se busca por forma y no por texto exacto para que un
    // regenerado del baseline no rompa el test por como formatea Postgres.
    const desde = sql.search(/CREATE TABLE.*"gastos"/i)
    expect(desde, 'no se encontro la tabla gastos').toBeGreaterThan(-1)
    // Solo el CREATE TABLE de gastos: audit_log si tiene un user_id legitimo,
    // que referencia a auth.users y no tiene nada que ver con este contrato.
    const bloqueGastos = sql.slice(desde, sql.indexOf(');', desde))

    // La columna se llama usuario_id. user_id como nombre de columna es el bug
    // que este contrato existe para que no vuelva (c97afe7).
    expect(bloqueGastos.match(/"user_id"/g) ?? [], `user_id en gastos`).toEqual([])
    expect(bloqueGastos).toMatch(/"usuario_id"\s+"uuid"/i)

    // Y apunta a perfiles, no a auth.users.
    // [^;] en vez del flag `s`: tsconfig apunta debajo de es2018 y ahi el flag
    // no compila. La clase negada cruza saltos de linea igual.
    expect(sql).toMatch(/gastos_usuario_id_fkey[^;]*REFERENCES\s+"public"\."perfiles"/i)

    // Las policies de gastos filtran por esa columna contra la sesion.
    const policiesGastos = [...sql.matchAll(/CREATE POLICY[^;]*"public"\."gastos"[^;]*;/gi)].map(
      (m) => m[0]
    )
    expect(policiesGastos.length, 'gastos deberia tener policies').toBeGreaterThan(0)
    expect(policiesGastos.some((p) => /"usuario_id"\s*=\s*"auth"\."uid"\(\)/i.test(p))).toBe(true)
  })

  /**
   * Las filas anteriores al commit 1808daf guardaban el tipo capitalizado
   * ("Combustible"), y el filtro por tipo del dashboard compara exacto, asi que
   * no aparecian al filtrar. Se normalizaron en
   * supabase/migrations/20260727_normalizar_tipo_gastos.sql; esto sostiene el invariante.
   */
  it('el dropdown de tipos coincide con el whitelist y es todo minuscula', () => {
    const page = read(PAGE)
    const bloque = page.slice(page.indexOf('const tiposGasto'), page.indexOf('const getIconForTipo'))
    const valores = [...bloque.matchAll(/value:\s*'([^']+)'/g)].map((m) => m[1])

    expect(valores.length).toBeGreaterThan(0)
    for (const v of valores) {
      expect(v, `${v} deberia estar en TIPOS_GASTO_VALIDOS`).toSatisfy(isValidTipoGasto)
      expect(v).toBe(v.toLowerCase())
    }
  })

  /**
   * El CHECK gastos_tipo_check rechaza cualquier tipo fuera del whitelist (23514).
   * Si el dropdown y el constraint se desalinean, el alta rompe en produccion.
   */
  it('el CHECK de la DB cubre exactamente los tipos del dropdown', () => {
    const sql = read(TIPO_CHECK)
    const lista = sql.slice(sql.indexOf('check (tipo in ('))
    const enCheck = [...lista.matchAll(/'([a-z_]+)'/g)].map((m) => m[1])

    expect(enCheck.length).toBeGreaterThan(0)
    for (const tipo of enCheck) {
      expect(tipo, `${tipo} esta en el CHECK pero no en TIPOS_GASTO_VALIDOS`).toSatisfy(isValidTipoGasto)
    }

    const page = read(PAGE)
    const bloque = page.slice(page.indexOf('const tiposGasto'), page.indexOf('const getIconForTipo'))
    const enDropdown = [...bloque.matchAll(/value:\s*'([^']+)'/g)].map((m) => m[1])

    for (const tipo of enDropdown) {
      expect(enCheck, `el dropdown ofrece "${tipo}" pero el CHECK lo rechazaria`).toContain(tipo)
    }
  })

  it('gastos no tiene updated_at (la DB viva no la tiene, no lleva trigger)', () => {
    const sql = read(MIGRATION)
    const desdeGastos = sql.slice(sql.indexOf('create table public.gastos'))
    const ddl = desdeGastos.slice(0, desdeGastos.indexOf(');'))

    expect(ddl).not.toContain('updated_at')
    expect(sql).not.toMatch(/create trigger set_updated_at before update on public\.gastos/)
  })
})
