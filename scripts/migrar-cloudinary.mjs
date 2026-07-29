/**
 * Migra las fotos alojadas en Cloudinary al storage propio.
 *
 *   node scripts/migrar-cloudinary.mjs            # ensayo, no escribe nada
 *   node scripts/migrar-cloudinary.mjs --aplicar  # migra de verdad
 *
 * Orden de cada foto: descargar -> guardar copia local -> subir al bucket ->
 * recien ahi actualizar la base. Si algo falla en el medio, la columna queda
 * como estaba y la URL de Cloudinary sigue sirviendo.
 *
 * Las URLs originales ya estan en public.fotos_urls_respaldo, y ademas queda
 * una copia de cada archivo en respaldo-fotos/. Nada se borra de Cloudinary.
 *
 * Es idempotente: una columna ya migrada no vuelve a procesarse.
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync, mkdirSync, writeFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const APLICAR = process.argv.includes('--aplicar')
const BUCKET = 'fotos-traslados'
const DIR_RESPALDO = 'respaldo-fotos'
const COLUMNAS = ['foto_frontal', 'foto_lateral', 'foto_trasera', 'foto_interior']

const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8').split('\n').filter(l => l.trim() && !l.startsWith('#'))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')] })
)
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
})

/** Devuelve las URLs de Cloudinary que haya en el valor de una columna. */
function urlsCloudinary(valor) {
  if (!valor || typeof valor !== 'string') return []
  const texto = valor.trim()
  if (!texto || texto === '[]') return []
  let items
  if (texto.startsWith('[')) {
    try { items = JSON.parse(texto) } catch { return [] }
    if (!Array.isArray(items)) return []
  } else {
    items = [texto]
  }
  return items.filter(x => typeof x === 'string' && x.includes('res.cloudinary.com'))
}

function extension(url) {
  const limpia = url.split('?')[0]
  const m = /\.(jpe?g|png|webp)$/i.exec(limpia)
  return m ? m[1].toLowerCase().replace('jpeg', 'jpg') : 'jpg'
}

const TIPO_MIME = { jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp' }

async function main() {
  console.log(APLICAR ? '=== MIGRANDO ===' : '=== ENSAYO (no escribe nada) ===')

  const filas = []
  let desde = 0
  for (;;) {
    const { data, error } = await admin
      .from('traslados')
      .select(`id, empresa_id, ${COLUMNAS.join(', ')}`)
      .range(desde, desde + 999)
    if (error) throw new Error(error.message)
    if (!data?.length) break
    filas.push(...data)
    if (data.length < 1000) break
    desde += 1000
  }

  const pendientes = []
  for (const fila of filas) {
    for (const col of COLUMNAS) {
      const urls = urlsCloudinary(fila[col])
      if (urls.length) pendientes.push({ trasladoId: fila.id, columna: col, urls })
    }
  }

  const totalFotos = pendientes.reduce((s, p) => s + p.urls.length, 0)
  console.log(`traslados revisados: ${filas.length}`)
  console.log(`columnas con fotos en Cloudinary: ${pendientes.length}`)
  console.log(`archivos a migrar: ${totalFotos}`)

  if (!APLICAR) {
    console.log('\nEjemplos:')
    for (const p of pendientes.slice(0, 3)) {
      console.log(`  ${p.trasladoId} ${p.columna} -> ${p.urls.length} foto(s)`)
    }
    console.log('\nVolvé a correrlo con --aplicar para migrar.')
    return
  }

  if (!existsSync(DIR_RESPALDO)) mkdirSync(DIR_RESPALDO, { recursive: true })

  let migradas = 0, fallidas = 0, columnasOk = 0
  const errores = []

  for (const [i, p] of pendientes.entries()) {
    const rutas = []
    let huboError = false

    for (const [n, url] of p.urls.entries()) {
      try {
        const r = await fetch(url)
        if (!r.ok) throw new Error(`descarga ${r.status}`)
        const buffer = Buffer.from(await r.arrayBuffer())
        if (buffer.length === 0) throw new Error('archivo vacio')

        const ext = extension(url)
        const nombre = `${p.columna.replace('foto_', '')}_${Date.now()}_${n}.${ext}`
        const ruta = `${p.trasladoId}/${nombre}`

        // Copia local antes de tocar nada remoto.
        const dirTraslado = join(DIR_RESPALDO, p.trasladoId)
        if (!existsSync(dirTraslado)) mkdirSync(dirTraslado, { recursive: true })
        writeFileSync(join(dirTraslado, nombre), buffer)

        const { error: eSubida } = await admin.storage
          .from(BUCKET)
          .upload(ruta, buffer, { contentType: TIPO_MIME[ext] ?? 'image/jpeg', upsert: false })
        if (eSubida) throw new Error(`subida: ${eSubida.message}`)

        rutas.push(ruta)
        migradas++
      } catch (e) {
        huboError = true
        fallidas++
        errores.push(`${p.trasladoId} ${p.columna} #${n}: ${e.message}`)
      }
    }

    // La base se actualiza solo si TODAS las fotos de esa columna subieron.
    // Con una a medias, es preferible dejar la columna intacta apuntando a
    // Cloudinary antes que perder una referencia.
    if (!huboError && rutas.length) {
      const valor = rutas.length === 1 ? rutas[0] : JSON.stringify(rutas)
      const { error: eUpd } = await admin
        .from('traslados')
        .update({ [p.columna]: valor })
        .eq('id', p.trasladoId)
      if (eUpd) {
        errores.push(`${p.trasladoId} ${p.columna}: update ${eUpd.message}`)
        fallidas++
      } else {
        columnasOk++
      }
    }

    if ((i + 1) % 25 === 0) console.log(`  ${i + 1}/${pendientes.length} columnas procesadas`)
  }

  console.log(`\narchivos migrados: ${migradas}`)
  console.log(`columnas actualizadas: ${columnasOk}`)
  console.log(`fallos: ${fallidas}`)
  if (errores.length) {
    console.log('\nDetalle de fallos:')
    for (const e of errores.slice(0, 20)) console.log(`  ${e}`)
  }
  console.log(`\nCopia local en ${DIR_RESPALDO}/`)
}

main().catch(e => { console.error('ERROR:', e.message); process.exit(1) })
