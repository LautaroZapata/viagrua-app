#!/usr/bin/env node
/**
 * Baja el backup mas reciente del bucket privado `backups` y lo descomprime.
 *
 * Lo usa .github/workflows/restore-test.yml para probar que el dump se puede
 * restaurar de verdad. Se baja el que esta en el bucket, no uno recien
 * generado: lo que hay que probar es el archivo que se va a usar el dia del
 * desastre.
 *
 *   node scripts/bajar-backup.mjs [destino]
 *
 * Variables de entorno:
 *   SUPABASE_URL               https://<ref>.supabase.co   (el de PRODUCCION)
 *   SUPABASE_SERVICE_ROLE_KEY  la llave que puede leer el bucket
 */

import { mkdir, writeFile } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'

const BUCKET = 'backups'

/** Los que nombra .github/workflows/backup.yml. */
const PATRON_NOMBRE = /^viagrua-(\d{4}-\d{2}-\d{2})\.tar\.gz$/

/**
 * Elige el dump mas nuevo. Pura y exportada para testear.
 *
 * Compara las fechas como texto ISO, donde el orden lexicografico coincide con
 * el cronologico. Ignora cualquier otra cosa que haya en el bucket: ahi tambien
 * viven las fotos, bajo el prefijo fotos/.
 *
 * @param {string[]} nombres
 * @returns {string|null}
 */
export function elegirMasReciente(nombres) {
  const dumps = nombres
    .filter((n) => PATRON_NOMBRE.test(n ?? ''))
    .sort((a, b) => b.localeCompare(a))

  return dumps[0] ?? null
}

const URL_BASE = process.env.SUPABASE_URL?.replace(/\/$/, '')
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

const cabeceras = {
  apikey: SERVICE_KEY,
  Authorization: `Bearer ${SERVICE_KEY}`,
}

async function listar() {
  const res = await fetch(`${URL_BASE}/storage/v1/object/list/${BUCKET}`, {
    method: 'POST',
    headers: { ...cabeceras, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      prefix: '',
      limit: 1000,
      sortBy: { column: 'name', order: 'desc' },
    }),
  })

  if (!res.ok) {
    throw new Error(`No se pudo listar el bucket: ${res.status} ${await res.text()}`)
  }

  return res.json()
}

async function main() {
  if (!URL_BASE || !SERVICE_KEY) {
    console.error('Faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY.')
    process.exit(1)
  }

  const destino = process.argv[2] ?? 'restore'
  const objetos = await listar()
  const nombre = elegirMasReciente(objetos.map((o) => o.name))

  if (!nombre) {
    console.error('No hay ningun backup en el bucket.')
    process.exit(1)
  }

  const res = await fetch(`${URL_BASE}/storage/v1/object/${BUCKET}/${nombre}`, {
    headers: cabeceras,
  })
  if (!res.ok) {
    throw new Error(`No se pudo bajar ${nombre}: ${res.status} ${await res.text()}`)
  }

  await mkdir(destino, { recursive: true })
  const bytes = Buffer.from(await res.arrayBuffer())
  await writeFile(`${destino}/${nombre}`, bytes)

  console.log(`Bajado ${nombre} (${(bytes.length / 1024).toFixed(1)} KB)`)
  console.log(`ARCHIVO=${nombre}`)
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main()
}
