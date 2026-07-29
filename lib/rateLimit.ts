import 'server-only'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export interface ResultadoRateLimit {
  permitido: boolean
  /** Segundos hasta que se libere el cupo. 0 si esta permitido. */
  reintentarEn: number
}

/**
 * Saca la IP del cliente de los headers del proxy.
 *
 * Antes se usaba x-forwarded-for entero como clave. Ese header lo puede
 * empezar el cliente: mandando `X-Forwarded-For: <aleatorio>` cambiaba la clave
 * en cada request y el limite quedaba anulado.
 *
 * El orden de x-forwarded-for es cliente, proxy1, proxy2..., y cada proxy
 * agrega al final. Solo son confiables las entradas que agrego nuestra
 * infraestructura, o sea las de la derecha. Los headers propios de Vercel son
 * mejores todavia, porque el cliente no los puede escribir.
 */
export function ipDeRequest(request: Request): string {
  const vercel = request.headers.get('x-vercel-forwarded-for')
  if (vercel) return vercel.split(',').pop()!.trim()

  const real = request.headers.get('x-real-ip')
  if (real) return real.trim()

  const xff = request.headers.get('x-forwarded-for')
  if (xff) {
    const partes = xff.split(',').map((p) => p.trim()).filter(Boolean)
    if (partes.length > 0) return partes[partes.length - 1]!
  }

  return 'desconocida'
}

/**
 * Consume una unidad del cupo de `clave`.
 *
 * El contador vive en Postgres, no en memoria del proceso: en serverless cada
 * instancia tiene su propia memoria y se reinicia en cada cold start, asi que
 * un Map local no limita nada.
 *
 * Si la consulta falla se deja pasar. Es a proposito: que se caiga el contador
 * no puede dejar a todo el mundo afuera del login.
 */
export async function consumirRateLimit(
  clave: string,
  max: number,
  ventanaSegundos: number
): Promise<ResultadoRateLimit> {
  try {
    const { data, error } = await supabaseAdmin.rpc('consumir_rate_limit', {
      p_clave: clave,
      p_max: max,
      p_ventana_segundos: ventanaSegundos,
    })

    if (error || !data || data.length === 0) {
      console.warn('rate limit no disponible, se deja pasar:', error?.message)
      return { permitido: true, reintentarEn: 0 }
    }

    const fila = data[0]!
    return { permitido: fila.permitido, reintentarEn: fila.reintentar_en }
  } catch (e) {
    console.warn('rate limit no disponible, se deja pasar:', e)
    return { permitido: true, reintentarEn: 0 }
  }
}

/** Respuesta 429 con Retry-After, para no repetirla en cada ruta. */
export function respuesta429(reintentarEn: number): Response {
  return new Response(
    JSON.stringify({ error: 'Demasiados intentos. Probá de nuevo en un momento.' }),
    {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        'Retry-After': String(Math.max(reintentarEn, 1)),
      },
    }
  )
}
