import { describe, it, expect } from 'vitest'
import { contarFilas, generarSql } from '../verificar-restore.mjs'
import { elegirMasReciente } from '../bajar-backup.mjs'

/**
 * Estas dos funciones son las que deciden si un restore se da por bueno. Si
 * contarFilas cuenta de menos, un dump a medias pasa la verificacion y el
 * error recien aparece el dia que hay que restaurar de verdad.
 */

/** Arma un bloque COPY como lo escribe `supabase db dump --use-copy`. */
function bloque(tabla: string, filas: string[]) {
  return [`COPY ${tabla} ("id", "nombre") FROM stdin;`, ...filas, '\\.'].join('\n')
}

describe('contarFilas', () => {
  it('cuenta las filas de un bloque COPY', () => {
    const sql = bloque('"public"."traslados"', ['1\tuno', '2\tdos', '3\ttres'])
    expect(contarFilas(sql)).toEqual([{ tabla: 'public.traslados', filas: 3 }])
  })

  it('cuenta una tabla vacia como cero y no la saltea', () => {
    // Una tabla que deberia estar vacia y aparece con filas tambien es un
    // restore mal hecho, asi que se verifica igual.
    const sql = bloque('"public"."gastos"', [])
    expect(contarFilas(sql)).toEqual([{ tabla: 'public.gastos', filas: 0 }])
  })

  it('ignora las tablas de auth y storage', () => {
    // Las maneja Supabase y su contenido cambia entre el dump y el restore.
    const sql = [
      bloque('"auth"."users"', ['a', 'b']),
      bloque('"storage"."objects"', ['c']),
      bloque('"public"."empresas"', ['d']),
    ].join('\n\n')

    expect(contarFilas(sql)).toEqual([{ tabla: 'public.empresas', filas: 1 }])
  })

  it('cuenta varios bloques seguidos sin arrastrar el conteo', () => {
    const sql = [
      bloque('"public"."a"', ['1', '2']),
      bloque('"public"."b"', ['3']),
    ].join('\n\n')

    expect(contarFilas(sql)).toEqual([
      { tabla: 'public.a', filas: 2 },
      { tabla: 'public.b', filas: 1 },
    ])
  })

  it('no cuenta las lineas de fuera de los bloques', () => {
    const sql = [
      '--',
      '-- Data for Name: empresas',
      '--',
      '',
      bloque('"public"."empresas"', ['1\tuno']),
      '',
      '-- otro comentario',
    ].join('\n')

    expect(contarFilas(sql)).toEqual([{ tabla: 'public.empresas', filas: 1 }])
  })

  it('no confunde una fila que empieza con backslash con el terminador', () => {
    // El terminador es la linea "\." exacta. Un dato como "\N" (null) no lo es.
    const sql = bloque('"public"."perfiles"', ['1\t\\N', '2\tdos'])
    expect(contarFilas(sql)).toEqual([{ tabla: 'public.perfiles', filas: 2 }])
  })

  it('devuelve vacio cuando no hay ningun COPY', () => {
    expect(contarFilas('-- nada por aca\n')).toEqual([])
  })
})

describe('generarSql', () => {
  it('genera una comprobacion por tabla con el numero esperado', () => {
    const sql = generarSql([{ tabla: 'public.traslados', filas: 922 }])
    expect(sql).toContain('select count(*) into n from public.traslados;')
    expect(sql).toContain('if n <> 922 then')
    expect(sql).toContain('raise exception')
  })

  it('genera una comprobacion por cada tabla', () => {
    const sql = generarSql([
      { tabla: 'public.a', filas: 1 },
      { tabla: 'public.b', filas: 2 },
    ])
    expect(sql.match(/select count\(\*\)/g)).toHaveLength(2)
  })
})

describe('elegirMasReciente', () => {
  it('elige el dump de fecha mas alta', () => {
    expect(
      elegirMasReciente([
        'viagrua-2026-07-01.tar.gz',
        'viagrua-2026-07-29.tar.gz',
        'viagrua-2026-07-15.tar.gz',
      ])
    ).toBe('viagrua-2026-07-29.tar.gz')
  })

  it('ignora las fotos y cualquier otra cosa del bucket', () => {
    // El bucket comparte lugar con el respaldo de fotos, bajo el prefijo fotos/.
    expect(elegirMasReciente(['fotos', 'otra-cosa.zip', 'viagrua-2026-07-29.tar.gz'])).toBe(
      'viagrua-2026-07-29.tar.gz'
    )
  })

  it('devuelve null cuando no hay ningun dump', () => {
    expect(elegirMasReciente(['fotos'])).toBeNull()
  })
})
