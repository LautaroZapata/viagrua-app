#!/usr/bin/env node
/**
 * Sube un dump al bucket privado `backups` y borra los que pasaron la
 * retencion.
 *
 * Corre desde .github/workflows/backup.yml. No usa supabase-js ni ninguna
 * dependencia: con la API REST de Storage y el fetch que ya trae Node alcanza,
 * y asi el workflow no necesita instalar node_modules para hacer un backup.
 *
 *   node scripts/backup-storage.mjs viagrua-2026-07-29.tar.gz
 *
 * Variables de entorno:
 *   SUPABASE_URL               https://<ref>.supabase.co
 *   SUPABASE_SERVICE_ROLE_KEY  la unica llave que puede escribir en el bucket
 *   RETENCION_DIAS             opcional, default 30
 */

import { readFile, stat } from 'node:fs/promises'
import { basename } from 'node:path'
import { pathToFileURL } from 'node:url'

const BUCKET = 'backups'
const RETENCION_DIAS = Number(process.env.RETENCION_DIAS ?? 30)

/**
 * Piso de seguridad: pase lo que pase con las fechas, nunca se borran los N
 * dumps mas nuevos.
 *
 * La poda decide por el nombre del archivo, y el nombre lo pone el workflow.
 * Si algun dia ese formato cambia, o el reloj del runner se va de fecha, la
 * regla de "mas viejo que 30 dias" podria matchear todo. Este piso hace que el
 * peor caso sea perder los backups viejos, nunca quedarse sin ninguno.
 */
const MINIMO_A_CONSERVAR = 7

/** Nombres que genera el workflow: viagrua-YYYY-MM-DD.tar.gz */
const PATRON_NOMBRE = /^viagrua-(\d{4}-\d{2}-\d{2})\.tar\.gz$/

/**
 * Decide que backups se borran. Pura y exportada para poder testearla: es la
 * unica parte de este script que destruye algo.
 *
 * Las fechas se comparan como texto ISO (YYYY-MM-DD), donde el orden
 * lexicografico coincide con el cronologico, asi que no hace falta parsear ni
 * pelear con zonas horarias.
 *
 * @param {string[]} nombres  Lo que devuelve el bucket, tal cual.
 * @param {string} hoy        Fecha ISO de corte de hoy, YYYY-MM-DD.
 * @param {number} retencionDias
 */
export function seleccionarVencidos(nombres, hoy, retencionDias) {
  // Solo se consideran los archivos que este script mismo nombro. Cualquier
  // otra cosa que alguien haya subido al bucket a mano se deja quieta.
  const dumps = nombres
    .map((nombre) => ({ nombre, match: PATRON_NOMBRE.exec(nombre ?? '') }))
    .filter((o) => o.match)
    .map((o) => ({ nombre: o.nombre, fecha: o.match[1] }))
    .sort((a, b) => b.fecha.localeCompare(a.fecha)) // mas nuevo primero

  const corte = new Date(`${hoy}T00:00:00Z`)
  corte.setUTCDate(corte.getUTCDate() - retencionDias)
  const fechaCorte = corte.toISOString().slice(0, 10)

  return {
    total: dumps.length,
    fechaCorte,
    vencidos: dumps
      .slice(MINIMO_A_CONSERVAR) // los mas nuevos nunca se tocan
      .filter((d) => d.fecha < fechaCorte)
      .map((d) => d.nombre),
  }
}

const URL_BASE = process.env.SUPABASE_URL?.replace(/\/$/, '')
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

const cabeceras = {
  apikey: SERVICE_KEY,
  Authorization: `Bearer ${SERVICE_KEY}`,
}

function formatearBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 ** 2).toFixed(1)} MB`
}

async function subir(ruta) {
  const nombre = basename(ruta)
  const { size } = await stat(ruta)
  const cuerpo = await readFile(ruta)

  const res = await fetch(`${URL_BASE}/storage/v1/object/${BUCKET}/${nombre}`, {
    method: 'POST',
    headers: {
      ...cabeceras,
      'Content-Type': 'application/gzip',
      // Si el workflow se re-corre el mismo dia, pisa el dump de hoy en vez de
      // fallar con "ya existe".
      'x-upsert': 'true',
    },
    body: cuerpo,
  })

  if (!res.ok) {
    throw new Error(`No se pudo subir ${nombre}: ${res.status} ${await res.text()}`)
  }

  console.log(`Subido ${nombre} (${formatearBytes(size)}) a ${BUCKET}/`)
}

async function listar() {
  const res = await fetch(`${URL_BASE}/storage/v1/object/list/${BUCKET}`, {
    method: 'POST',
    headers: { ...cabeceras, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      prefix: '',
      limit: 1000,
      sortBy: { column: 'name', order: 'asc' },
    }),
  })

  if (!res.ok) {
    throw new Error(`No se pudo listar el bucket: ${res.status} ${await res.text()}`)
  }

  return res.json()
}

async function borrar(nombres) {
  const res = await fetch(`${URL_BASE}/storage/v1/object/${BUCKET}`, {
    method: 'DELETE',
    headers: { ...cabeceras, 'Content-Type': 'application/json' },
    body: JSON.stringify({ prefixes: nombres }),
  })

  if (!res.ok) {
    throw new Error(`No se pudieron borrar los vencidos: ${res.status} ${await res.text()}`)
  }
}

async function podar() {
  const objetos = await listar()
  const hoy = new Date().toISOString().slice(0, 10)

  const { total, fechaCorte, vencidos } = seleccionarVencidos(
    objetos.map((o) => o.name),
    hoy,
    RETENCION_DIAS
  )

  console.log(`Hay ${total} backup(s) en el bucket.`)

  if (vencidos.length === 0) {
    console.log(`Nada que podar (retencion: ${RETENCION_DIAS} dias, corte: ${fechaCorte}).`)
    return
  }

  console.log(`Borrando ${vencidos.length} vencido(s): ${vencidos.join(', ')}`)
  await borrar(vencidos)
}

async function main() {
  if (!URL_BASE || !SERVICE_KEY) {
    console.error('Faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY.')
    process.exit(1)
  }

  const archivo = process.argv[2]
  if (!archivo) {
    console.error('Uso: node scripts/backup-storage.mjs <archivo.tar.gz>')
    process.exit(1)
  }

  // El backup se sube primero y se poda despues. Al reves, un fallo de red
  // entre las dos operaciones dejaria el bucket podado y sin el dump de hoy.
  await subir(archivo)
  await podar()
}

// Solo corre si se lo invoca directo. Importado desde un test, exporta
// seleccionarVencidos y no toca la red.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main()
}
