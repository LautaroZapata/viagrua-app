#!/usr/bin/env node
/**
 * Compara lo que dice el dump contra lo que quedo en la base restaurada.
 *
 * Lee data.sql, cuenta las filas de cada bloque COPY y emite un SQL que falla
 * si alguna tabla no tiene exactamente esa cantidad. Se emite SQL en vez de
 * consultar desde Node para no meter una dependencia de driver de Postgres:
 * psql ya esta en el runner y devuelve un exit code distinto de cero cuando la
 * excepcion salta.
 *
 *   node scripts/verificar-restore.mjs restore/data.sql > verificar.sql
 *   psql "$URL" -v ON_ERROR_STOP=1 -f verificar.sql
 *
 * Un restore que corre sin errores no prueba nada: psql puede aplicar un
 * schema.sql entero y un data.sql vacio sin quejarse una sola vez.
 */

import { readFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'

const BARRA = 92 // '\'
const PUNTO = 46 // '.'

/**
 * El terminador de un bloque COPY es la linea "\." exacta. Se compara por
 * charCode y no contra un literal para no depender de como el shell de turno
 * trate las barras invertidas.
 */
const esTerminador = (l) =>
  l.length === 2 && l.charCodeAt(0) === BARRA && l.charCodeAt(1) === PUNTO

/**
 * Cuenta las filas de cada bloque COPY de un data.sql.
 *
 * Pura y exportada para testear. Devuelve solo las tablas de `public`: las de
 * `auth` y `storage` las maneja Supabase y su contenido puede cambiar entre el
 * dump y el restore (sesiones que expiran, por ejemplo).
 *
 * @param {string} sql  Contenido de data.sql.
 * @returns {{tabla: string, filas: number}[]}
 */
export function contarFilas(sql) {
  const lineas = sql.split(/\r?\n/)
  const res = []
  let tabla = null
  let n = 0

  for (const l of lineas) {
    if (l.startsWith('COPY ')) {
      const fin = l.indexOf(' (')
      tabla = l.slice(5, fin === -1 ? undefined : fin).replace(/"/g, '')
      n = 0
      continue
    }
    if (tabla === null) continue
    if (esTerminador(l)) {
      if (tabla.startsWith('public.')) res.push({ tabla, filas: n })
      tabla = null
    } else {
      n++
    }
  }

  return res
}

/**
 * Arma el SQL de verificacion.
 *
 * Se comprueba tabla por tabla y no con un total, para que el mensaje diga cual
 * fallo. Las tablas vacias tambien se comprueban: una que deberia estar vacia y
 * aparece con filas significa que el restore trajo algo de otro lado.
 */
export function generarSql(conteos) {
  const checks = conteos
    .map(
      ({ tabla, filas }) => `  select count(*) into n from ${tabla};
  if n <> ${filas} then
    raise exception 'REVENTO: ${tabla} tiene % filas y el dump dice ${filas}', n;
  end if;`
    )
    .join('\n\n')

  return `-- Generado por scripts/verificar-restore.mjs. No editar a mano.
do $verificacion$
declare
  n bigint;
begin
${checks}

  raise notice 'OK: ${conteos.length} tabla(s) coinciden con el dump.';
end
$verificacion$;
`
}

function main() {
  const ruta = process.argv[2]
  if (!ruta) {
    console.error('Uso: node scripts/verificar-restore.mjs <data.sql>')
    process.exit(1)
  }

  const conteos = contarFilas(readFileSync(ruta, 'utf8'))

  if (conteos.length === 0) {
    console.error('El dump no tiene ni un bloque COPY de public: no hay nada que verificar.')
    process.exit(1)
  }

  process.stdout.write(generarSql(conteos))
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main()
}
