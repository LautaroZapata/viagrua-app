import { readFileSync } from 'node:fs'

/**
 * globalSetup: deja la base lista antes de la corrida.
 *
 * Lo unico que hace es vaciar public.rate_limits.
 *
 * Hace falta porque /api/registro admite 5 altas por hora y por IP, y todas las
 * corridas salen de 127.0.0.1. A partir de la sexta el alta devuelve 429 y el
 * test falla como si fuera flaky, cuando en realidad es el rate limit haciendo
 * exactamente lo suyo. El cupo se prueba en lib/__tests__, que es donde
 * corresponde: aca solo estorba.
 *
 * No borra empresas, perfiles ni traslados: cada corrida usa emails y matriculas
 * unicos, asi que las corridas viejas no molestan, y dejarlas ahi sirve para
 * revisar a mano que quedo cuando algo falla.
 */
export default async function prepararBase() {
  const env = Object.fromEntries(
    readFileSync('.env.e2e', 'utf8')
      .split(/\r?\n/)
      .filter((l) => l.includes('=') && !l.trim().startsWith('#'))
      .map((l) => {
        const i = l.indexOf('=')
        return [l.slice(0, i).trim(), l.slice(i + 1).trim()]
      })
  )

  const url = env.NEXT_PUBLIC_SUPABASE_URL
  const key = env.SUPABASE_SERVICE_ROLE_KEY

  // Mismo freno que en los scripts: esto borra filas, y contra produccion
  // borraria el cupo real de todas las empresas.
  if (!/^https?:\/\/(127\.0\.0\.1|localhost|\[::1\])(:|\/|$)/.test(url ?? '')) {
    throw new Error(`FRENO: .env.e2e no apunta a Supabase local (${url}).`)
  }

  // PostgREST exige un filtro para borrar; "contador mayor o igual a cero" toma
  // todas las filas sin depender de que exista una clave puntual.
  const res = await fetch(`${url}/rest/v1/rate_limits?contador=gte.0`, {
    method: 'DELETE',
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  })

  if (!res.ok) {
    throw new Error(`No se pudo limpiar rate_limits: ${res.status} ${await res.text()}`)
  }
}
