#!/usr/bin/env node
/**
 * Copia las fotos del bucket `fotos-traslados` al bucket privado `backups`,
 * bajo el prefijo `fotos/`.
 *
 * Existe porque `supabase db dump` NO guarda archivos: guarda las filas de
 * storage.objects, que dicen que foto va con que traslado, pero no los bytes.
 * Restaurar solo el dump deja 900+ traslados con sus fotos listadas y ningun
 * archivo detras. Hasta la migracion de Cloudinary (74e60fa) ese servicio era
 * una segunda copia de hecho; desde entonces el bucket es la unica.
 *
 * Es incremental: copia lo que falta y no toca lo que ya esta. Con ~530 fotos
 * la primera corrida hace el grueso y las siguientes copian las del dia.
 *
 *   node scripts/backup-fotos.mjs
 *
 * Variables de entorno:
 *   SUPABASE_URL               https://<ref>.supabase.co
 *   SUPABASE_SERVICE_ROLE_KEY  la unica llave que puede leer y escribir
 *   FOTOS_MAX_POR_CORRIDA      opcional, tope de copias por corrida
 */

import { pathToFileURL } from 'node:url'

const BUCKET_ORIGEN = 'fotos-traslados'
const BUCKET_DESTINO = 'backups'

/** Prefijo dentro de `backups`. Lo eligio este script y la poda no lo mira. */
const PREFIJO = 'fotos/'

/**
 * Tope de copias por corrida.
 *
 * El workflow corre todos los dias y la primera vez tiene ~530 fotos por
 * delante. Sin tope, un bucket que crecio mucho podria pasarse del limite de
 * tiempo del job y no dejar nada; con tope, cada corrida avanza un pedazo y el
 * backup se completa solo en unos dias. Lo que no se copio hoy sigue estando
 * como faltante manana.
 */
const MAX_POR_CORRIDA = Number(process.env.FOTOS_MAX_POR_CORRIDA ?? 2000)

/** Cuantas copias se disparan a la vez. */
const CONCURRENCIA = 6

/**
 * Decide que hay que copiar: lo que esta en el origen y no en el destino.
 *
 * Pura y exportada para poder testearla sin tocar la red. Compara por ruta
 * relativa, no por contenido: una foto subida se escribe una vez y no se
 * vuelve a modificar, asi que si el nombre ya esta del otro lado, esta.
 *
 * @param {string[]} origen   Rutas dentro de fotos-traslados.
 * @param {string[]} destino  Rutas dentro de backups, con el prefijo puesto.
 * @param {number} max        Tope de esta corrida.
 */
export function seleccionarFaltantes(origen, destino, max = MAX_POR_CORRIDA) {
  const yaEstan = new Set(
    destino
      .filter((r) => r.startsWith(PREFIJO))
      .map((r) => r.slice(PREFIJO.length))
  )

  const faltantes = origen.filter((r) => !yaEstan.has(r))

  return {
    total: origen.length,
    copiadas: yaEstan.size,
    faltantes: faltantes.slice(0, max),
    pendientes: Math.max(0, faltantes.length - max),
  }
}

const URL_BASE = process.env.SUPABASE_URL?.replace(/\/$/, '')
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

const cabeceras = {
  apikey: SERVICE_KEY,
  Authorization: `Bearer ${SERVICE_KEY}`,
}

/**
 * Lista un nivel del bucket. La API devuelve archivos y carpetas mezclados: una
 * carpeta se reconoce porque viene sin `id`.
 */
async function listarNivel(bucket, prefijo, offset) {
  const res = await fetch(`${URL_BASE}/storage/v1/object/list/${bucket}`, {
    method: 'POST',
    headers: { ...cabeceras, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      prefix: prefijo,
      limit: 1000,
      offset,
      sortBy: { column: 'name', order: 'asc' },
    }),
  })

  if (!res.ok) {
    throw new Error(`No se pudo listar ${bucket}/${prefijo}: ${res.status} ${await res.text()}`)
  }

  return res.json()
}

/**
 * Lista todo un bucket, entrando en las subcarpetas.
 *
 * Las fotos estan anidadas por empresa desde eb1f06f, asi que un listado plano
 * devolveria carpetas y ni una foto.
 */
async function listarRecursivo(bucket, prefijo = '') {
  const rutas = []
  let offset = 0

  for (;;) {
    const pagina = await listarNivel(bucket, prefijo, offset)
    if (pagina.length === 0) break

    for (const item of pagina) {
      const ruta = prefijo ? `${prefijo}${item.name}` : item.name
      if (item.id) {
        rutas.push(ruta)
      } else {
        rutas.push(...(await listarRecursivo(bucket, `${ruta}/`)))
      }
    }

    if (pagina.length < 1000) break
    offset += pagina.length
  }

  return rutas
}

/**
 * Copia un objeto entre buckets del lado del servidor, sin que los bytes pasen
 * por el runner.
 */
async function copiar(ruta) {
  const res = await fetch(`${URL_BASE}/storage/v1/object/copy`, {
    method: 'POST',
    headers: { ...cabeceras, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      bucketId: BUCKET_ORIGEN,
      sourceKey: ruta,
      destinationBucket: BUCKET_DESTINO,
      destinationKey: `${PREFIJO}${ruta}`,
    }),
  })

  if (res.ok) return

  const detalle = `${res.status} ${await res.text()}`

  // Algunas versiones de Storage no aceptan destinationBucket y copian solo
  // dentro del mismo bucket. Ahi no queda otra que pasar los bytes por aca.
  if (res.status === 400 || res.status === 404) {
    await copiarBajandoYSubiendo(ruta, detalle)
    return
  }

  throw new Error(`No se pudo copiar ${ruta}: ${detalle}`)
}

let avisoFallback = false

async function copiarBajandoYSubiendo(ruta, detalleOriginal) {
  if (!avisoFallback) {
    console.log(`La copia del lado del servidor no esta disponible (${detalleOriginal}).`)
    console.log('Se copia bajando y subiendo, que es mas lento pero funciona igual.')
    avisoFallback = true
  }

  const bajada = await fetch(`${URL_BASE}/storage/v1/object/${BUCKET_ORIGEN}/${ruta}`, {
    headers: cabeceras,
  })
  if (!bajada.ok) {
    throw new Error(`No se pudo bajar ${ruta}: ${bajada.status} ${await bajada.text()}`)
  }

  const cuerpo = Buffer.from(await bajada.arrayBuffer())
  const tipo = bajada.headers.get('content-type') ?? 'application/octet-stream'

  const subida = await fetch(
    `${URL_BASE}/storage/v1/object/${BUCKET_DESTINO}/${PREFIJO}${ruta}`,
    {
      method: 'POST',
      headers: { ...cabeceras, 'Content-Type': tipo, 'x-upsert': 'true' },
      body: cuerpo,
    }
  )

  if (!subida.ok) {
    throw new Error(`No se pudo subir ${ruta}: ${subida.status} ${await subida.text()}`)
  }
}

/** Corre las copias de a tandas para no abrir 500 conexiones de una. */
async function copiarTodas(rutas) {
  let hechas = 0
  const fallidas = []

  for (let i = 0; i < rutas.length; i += CONCURRENCIA) {
    const tanda = rutas.slice(i, i + CONCURRENCIA)
    const resultados = await Promise.allSettled(tanda.map(copiar))

    resultados.forEach((r, j) => {
      if (r.status === 'fulfilled') hechas++
      else fallidas.push({ ruta: tanda[j], motivo: r.reason?.message ?? String(r.reason) })
    })

    if (hechas > 0 && hechas % 100 === 0) {
      console.log(`  ${hechas}/${rutas.length}...`)
    }
  }

  return { hechas, fallidas }
}

async function main() {
  if (!URL_BASE || !SERVICE_KEY) {
    console.error('Faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY.')
    process.exit(1)
  }

  const [origen, destino] = await Promise.all([
    listarRecursivo(BUCKET_ORIGEN),
    listarRecursivo(BUCKET_DESTINO, PREFIJO),
  ])

  const { total, copiadas, faltantes, pendientes } = seleccionarFaltantes(origen, destino)

  console.log(`${total} foto(s) en ${BUCKET_ORIGEN}, ${copiadas} ya respaldada(s).`)

  if (faltantes.length === 0) {
    console.log('Nada que copiar: el respaldo de fotos esta al dia.')
    return
  }

  console.log(`Copiando ${faltantes.length}...`)
  const { hechas, fallidas } = await copiarTodas(faltantes)
  console.log(`Copiadas ${hechas} de ${faltantes.length}.`)

  if (pendientes > 0) {
    console.log(`Quedan ${pendientes} para la proxima corrida (tope: ${MAX_POR_CORRIDA}).`)
  }

  // Que falle una foto no invalida el dump de la base, que ya se subio. Se
  // avisa fuerte y el job termina en rojo para que no pase inadvertido, pero
  // recien despues de haber intentado todas las demas.
  if (fallidas.length > 0) {
    console.error(`\n${fallidas.length} foto(s) no se pudieron copiar:`)
    for (const f of fallidas.slice(0, 10)) console.error(`  ${f.ruta}: ${f.motivo}`)
    if (fallidas.length > 10) console.error(`  ...y ${fallidas.length - 10} mas.`)
    process.exit(1)
  }
}

// Solo corre si se lo invoca directo. Importado desde un test, exporta
// seleccionarFaltantes y no toca la red.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main()
}
