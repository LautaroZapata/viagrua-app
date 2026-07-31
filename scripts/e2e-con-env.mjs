#!/usr/bin/env node
/**
 * Corre un comando con las variables de .env.e2e cargadas.
 *
 *   node scripts/e2e-con-env.mjs next build
 *   node scripts/e2e-con-env.mjs next start -p 3000
 *
 * Existe porque `node --env-file=.env.e2e next build` no sirve: Next levanta
 * workers y Node rechaza --env-file dentro de NODE_OPTIONS
 * (ERR_WORKER_INVALID_EXEC_ARGV). Inyectando las variables en el env del
 * proceso hijo, los workers las heredan como cualquier variable real.
 *
 * Las variables reales le ganan a los .env de Next, asi que esto tambien es lo
 * que mantiene a .env.local —que apunta a PRODUCCION— fuera del build de los
 * tests.
 */

import { spawn } from 'node:child_process'
import { readFileSync, existsSync } from 'node:fs'

const ARCHIVO = '.env.e2e'

if (!existsSync(ARCHIVO)) {
  console.error(`Falta ${ARCHIVO}. Corre primero: pnpm e2e:preparar`)
  process.exit(1)
}

const env = { ...process.env }

for (const linea of readFileSync(ARCHIVO, 'utf8').split(/\r?\n/)) {
  const limpia = linea.trim()
  if (!limpia || limpia.startsWith('#')) continue

  const i = limpia.indexOf('=')
  if (i === -1) continue

  env[limpia.slice(0, i).trim()] = limpia.slice(i + 1).trim()
}

// Ultimo freno, por si alguien edita .env.e2e a mano. Los tests siembran y
// borran: contra produccion ensuciarian la base de empresas reales.
const url = env.NEXT_PUBLIC_SUPABASE_URL ?? ''
if (!/^https?:\/\/(127\.0\.0\.1|localhost|\[::1\])(:|\/|$)/.test(url)) {
  console.error(`FRENO: ${ARCHIVO} no apunta a Supabase local (${url}).`)
  process.exit(1)
}

const [comando, ...args] = process.argv.slice(2)
if (!comando) {
  console.error('Uso: node scripts/e2e-con-env.mjs <comando> [args...]')
  process.exit(1)
}

const hijo = spawn(comando, args, {
  env,
  stdio: 'inherit',
  shell: process.platform === 'win32',
})

hijo.on('exit', (codigo) => process.exit(codigo ?? 1))
