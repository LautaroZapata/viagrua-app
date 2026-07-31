// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { construirCsp, origenSentry, origenesSupabase } from '../csp'

/**
 * La CSP falla de las dos maneras caras y ninguna se ve leyendo el diff: una
 * directiva de mas afloja la politica en silencio, y una de menos rompe una
 * funcionalidad entera con un error que solo aparece en la consola del
 * navegador. Estos tests fijan las dos politicas directiva por directiva.
 */

const NONCE = 'abc123'
const DSN = 'https://clave@o4507.ingest.us.sentry.io/4508'

/** Parte el header en un mapa directiva -> lista de fuentes. */
function directivas(csp: string): Record<string, string[]> {
  return Object.fromEntries(
    csp.split('; ').map((d) => {
      const [nombre, ...fuentes] = d.split(' ')
      return [nombre!, fuentes]
    })
  )
}

const publica = (extra = {}) =>
  directivas(construirCsp({ nonce: null, desarrollo: false, ...extra }))

const autenticada = (extra = {}) =>
  directivas(construirCsp({ nonce: NONCE, desarrollo: false, ...extra }))

describe('politica del area autenticada', () => {
  it('usa nonce y strict-dynamic, sin unsafe-inline', () => {
    const d = autenticada()

    expect(d['script-src']).toContain(`'nonce-${NONCE}'`)
    expect(d['script-src']).toContain("'strict-dynamic'")
    expect(d['script-src']).not.toContain("'unsafe-inline'")
  })

  it('conserva el hash del script de tema de next-themes', () => {
    // Si se cae, vuelve el flash de tema claro en el dashboard.
    expect(autenticada()['script-src']).toContain(
      "'sha256-n46vPwSWuMC0W703pBofImv82Z26xo4LXymv0E9caPk='"
    )
  })

  it('no abre nada de reCAPTCHA: ahi no corre', () => {
    const d = autenticada()

    // Se miran las directivas de a una y no el header entero: font-src lleva
    // fonts.gstatic.com desde antes, por las fuentes de Google, y no tiene nada
    // que ver con reCAPTCHA.
    expect(d['script-src'].join(' ')).not.toContain('gstatic.com')
    expect(d['script-src'].join(' ')).not.toContain('google.com')
    expect(d['connect-src'].join(' ')).not.toContain('google.com')
    expect(d['frame-src']).toEqual(["'none'"])
  })
})

describe('politica de las paginas publicas', () => {
  it('autoriza los cuatro origenes que reCAPTCHA necesita', () => {
    const d = publica()

    expect(d['script-src']).toContain('https://www.google.com/recaptcha/')
    expect(d['script-src']).toContain('https://www.gstatic.com')
    expect(d['connect-src']).toContain('https://www.google.com/recaptcha/')
    expect(d['frame-src']).toContain('https://www.google.com/recaptcha/')
  })

  it('no filtra el nonce ni strict-dynamic', () => {
    // 'strict-dynamic' aca haria que el navegador ignore la lista de hosts y
    // reCAPTCHA dejaria de cargar.
    const d = publica()

    expect(d['script-src']).not.toContain("'strict-dynamic'")
    expect(d['script-src'].join(' ')).not.toContain('nonce-')
  })
})

describe('Sentry en connect-src', () => {
  it('agrega el origen exacto del DSN', () => {
    expect(publica({ dsnSentry: DSN })['connect-src']).toContain(
      'https://o4507.ingest.us.sentry.io'
    )
    expect(autenticada({ dsnSentry: DSN })['connect-src']).toContain(
      'https://o4507.ingest.us.sentry.io'
    )
  })

  it('no afloja connect-src cuando no hay DSN', () => {
    expect(publica()['connect-src'].join(' ')).not.toContain('sentry')
  })

  it('ignora un DSN mal escrito en vez de romper el proxy', () => {
    // Un typo en la variable de entorno no puede tirar abajo todas las
    // requests: el proxy corre en cada navegacion.
    expect(() => construirCsp({ nonce: null, desarrollo: false, dsnSentry: 'no-es-una-url' }))
      .not.toThrow()
    expect(origenSentry('no-es-una-url')).toBeNull()
    expect(origenSentry(undefined)).toBeNull()
  })

  it('no autoriza un wildcard de sentry.io', () => {
    // Con https://*.sentry.io, cualquier proyecto de Sentry del mundo seria un
    // destino valido para los datos de esta app.
    expect(publica({ dsnSentry: DSN })['connect-src']).not.toContain('https://*.sentry.io')
  })
})

describe('unsafe-eval', () => {
  it('aparece solo en desarrollo', () => {
    expect(construirCsp({ nonce: null, desarrollo: true })).toContain("'unsafe-eval'")
    expect(construirCsp({ nonce: NONCE, desarrollo: true })).toContain("'unsafe-eval'")
  })

  it('nunca aparece en produccion', () => {
    expect(construirCsp({ nonce: null, desarrollo: false })).not.toContain("'unsafe-eval'")
    expect(construirCsp({ nonce: NONCE, desarrollo: false })).not.toContain("'unsafe-eval'")
  })
})

describe('directivas de cierre', () => {
  it('se mantienen en las dos politicas', () => {
    for (const d of [publica(), autenticada()]) {
      expect(d['default-src']).toEqual(["'self'"])
      expect(d['frame-ancestors']).toEqual(["'none'"])
      expect(d['base-uri']).toEqual(["'none'"])
      expect(d['object-src']).toEqual(["'none'"])
      expect(d['form-action']).toEqual(["'self'"])
    }
  })

  it('deja pasar el storage de Supabase para las fotos', () => {
    expect(autenticada()['img-src']).toContain('https://*.supabase.co')
    expect(autenticada()['connect-src']).toContain('wss://*.supabase.co')
  })
})

/**
 * El cliente de Supabase pega directo desde el navegador, asi que su origen
 * tiene que estar en connect-src. Con los comodines *.supabase.co alcanzaba en
 * produccion pero no en local, donde escucha en 127.0.0.1: ahi el login moria
 * en silencio (las rutas de API seguian andando por ser same-origin).
 */
describe('origenesSupabase', () => {
  it('deriva el origen http y el ws de un Supabase local', () => {
    expect(origenesSupabase('http://127.0.0.1:54421')).toEqual([
      'http://127.0.0.1:54421',
      'ws://127.0.0.1:54421',
    ])
  })

  it('usa wss cuando la URL es https', () => {
    expect(origenesSupabase('https://abc.supabase.co')).toEqual([
      'https://abc.supabase.co',
      'wss://abc.supabase.co',
    ])
  })

  it('no agrega nada si no hay URL o no parsea', () => {
    expect(origenesSupabase(undefined)).toEqual([])
    expect(origenesSupabase('no-es-una-url')).toEqual([])
  })

  it('mete el origen local en connect-src de la politica', () => {
    const csp = construirCsp({
      nonce: null,
      desarrollo: true,
      urlSupabase: 'http://127.0.0.1:54421',
    })
    expect(csp).toContain('http://127.0.0.1:54421')
    expect(csp).toContain('ws://127.0.0.1:54421')
  })
})
