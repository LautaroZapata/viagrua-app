#!/usr/bin/env node
/**
 * Deja el entorno listo para correr los E2E contra Supabase local.
 *
 * Levanta el stack si hace falta, lee sus credenciales y las escribe en
 * .env.e2e, que es lo unico que van a ver el build y el server de los tests.
 *
 *   node scripts/e2e-preparar.mjs
 *
 * Por que un archivo aparte y no .env.local: ese apunta al proyecto de
 * PRODUCCION, que usa gente con datos reales. Un test que siembra y borra no
 * puede correr ahi ni por accidente. Las variables reales le ganan a los .env
 * de Next, asi que el build de los tests se corre con --env-file=.env.e2e y
 * .env.local queda fuera de juego.
 */

import { execFileSync } from 'node:child_process'
import { writeFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'

/** Lo unico que se acepta como destino. Ver verificarEsLocal(). */
const HOSTS_LOCALES = new Set(['127.0.0.1', 'localhost', '[::1]'])

/**
 * El freno.
 *
 * Si `supabase status` devolviera las credenciales del proyecto linkeado en vez
 * de las del stack local, los tests borrarian datos de empresas reales. Se
 * comprueba el host antes de escribir nada.
 */
export function verificarEsLocal(url) {
  let host
  try {
    host = new URL(url).hostname
  } catch {
    throw new Error(`La URL de Supabase no parsea: ${url}`)
  }

  if (!HOSTS_LOCALES.has(host)) {
    throw new Error(
      `FRENO: los E2E solo corren contra Supabase local y el destino es ${host}.\n` +
        'Un test que siembra y borra no puede correr contra produccion.'
    )
  }

  return host
}

function supabase(...args) {
  return execFileSync('supabase', args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'inherit'],
    shell: process.platform === 'win32',
  })
}

/** `supabase status -o env` devuelve KEY="valor" por linea. */
function leerEstado() {
  const salida = supabase('status', '-o', 'env')
  const vars = {}

  for (const linea of salida.split(/\r?\n/)) {
    const m = /^([A-Z_]+)="?([^"]*)"?$/.exec(linea.trim())
    if (m) vars[m[1]] = m[2]
  }

  return vars
}

function main() {
  console.log('Levantando Supabase local (si ya esta arriba, no hace nada)...')
  try {
    supabase('start')
  } catch {
    // `supabase start` sale con error si ya estaba corriendo. El status de abajo
    // dice la verdad, asi que no vale la pena distinguir los dos casos aca.
    console.log('  (ya estaba corriendo)')
  }

  const estado = leerEstado()
  const url = estado.API_URL
  const anon = estado.ANON_KEY
  const service = estado.SERVICE_ROLE_KEY

  if (!url || !anon || !service) {
    console.error('supabase status no devolvio API_URL, ANON_KEY y SERVICE_ROLE_KEY.')
    process.exit(1)
  }

  const host = verificarEsLocal(url)
  console.log(`Destino verificado: ${url} (host ${host})`)

  const contenido = [
    '# Generado por scripts/e2e-preparar.mjs. No editar ni commitear.',
    '# Apunta al Supabase LOCAL. Ver el freno en verificarEsLocal().',
    `NEXT_PUBLIC_SUPABASE_URL=${url}`,
    `NEXT_PUBLIC_SUPABASE_ANON_KEY=${anon}`,
    `SUPABASE_SERVICE_ROLE_KEY=${service}`,
    'NEXT_PUBLIC_APP_URL=http://127.0.0.1:3100',
    '',
    '# Sin RECAPTCHA_SECRET_KEY, verificarRecaptcha() deja pasar todo y los tests',
    '# no necesitan keys ni mockear a Google. Ver lib/recaptcha.ts.',
    'RECAPTCHA_SECRET_KEY=',
    'NEXT_PUBLIC_RECAPTCHA_SITE_KEY=',
    '',
    '# Sin DSN, Sentry no arranca: los tests no tienen por que mandar ruido al',
    '# proyecto compartido.',
    'NEXT_PUBLIC_SENTRY_DSN=',
    '',
  ].join('\n')

  writeFileSync('.env.e2e', contenido)
  console.log('Escrito .env.e2e')
}

// Solo corre si se lo invoca directo. Importado desde un test, exporta
// verificarEsLocal y no levanta nada.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main()
}
