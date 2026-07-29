// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

/**
 * Estas ramas deciden si alguien entra o no a la app, y varias fallan "hacia
 * adentro" a proposito (si Google no contesta, se deja pasar). Conviene que ese
 * criterio este fijado por un test y no por lo que uno se acuerde.
 *
 * El modulo lee RECAPTCHA_SECRET_KEY al importarse, asi que cada caso lo
 * reimporta con resetModules despues de acomodar el entorno.
 */

const SECRET_ORIGINAL = process.env.RECAPTCHA_SECRET_KEY
const UMBRAL_ORIGINAL = process.env.RECAPTCHA_MIN_SCORE

async function importarConSecret(secret: string | undefined, umbral?: string) {
  vi.resetModules()
  if (secret === undefined) delete process.env.RECAPTCHA_SECRET_KEY
  else process.env.RECAPTCHA_SECRET_KEY = secret

  if (umbral === undefined) delete process.env.RECAPTCHA_MIN_SCORE
  else process.env.RECAPTCHA_MIN_SCORE = umbral

  return import('../recaptcha')
}

/** Respuesta de siteverify con los campos que devuelve Google en v3. */
function siteverify(cuerpo: Record<string, unknown>, ok = true) {
  return vi.fn().mockResolvedValue({
    ok,
    json: async () => cuerpo,
  })
}

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn())
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  process.env.RECAPTCHA_SECRET_KEY = SECRET_ORIGINAL
  process.env.RECAPTCHA_MIN_SCORE = UMBRAL_ORIGINAL
})

describe('verificarRecaptcha sin configurar', () => {
  it('deja pasar y no le pega a Google', async () => {
    const { verificarRecaptcha, RECAPTCHA_ACTIVO } = await importarConSecret(undefined)

    expect(RECAPTCHA_ACTIVO).toBe(false)
    const r = await verificarRecaptcha('lo-que-sea', 'login', true)

    expect(r.permitido).toBe(true)
    expect(r.motivo).toBe('sin-configurar')
    expect(fetch).not.toHaveBeenCalled()
  })
})

describe('verificarRecaptcha configurado', () => {
  it('acepta un token bueno con score sobre el umbral', async () => {
    const { verificarRecaptcha } = await importarConSecret('secreto')
    vi.stubGlobal('fetch', siteverify({ success: true, score: 0.9, action: 'login' }))

    const r = await verificarRecaptcha('token', 'login', true)

    expect(r.permitido).toBe(true)
    expect(r.score).toBe(0.9)
  })

  it('rechaza score bajo', async () => {
    const { verificarRecaptcha } = await importarConSecret('secreto')
    // 0.1 es lo que devolvio Google al probar el flujo con curl: el score tipico
    // de un cliente automatizado.
    vi.stubGlobal('fetch', siteverify({ success: true, score: 0.1, action: 'login' }))

    const r = await verificarRecaptcha('token', 'login', true)

    expect(r.permitido).toBe(false)
    expect(r.motivo).toContain('score bajo')
  })

  it('rechaza un token valido pero de otra accion', async () => {
    // El caso que evita reciclar un token del formulario publico de alta para
    // martillar el login.
    const { verificarRecaptcha } = await importarConSecret('secreto')
    vi.stubGlobal('fetch', siteverify({ success: true, score: 0.9, action: 'registro' }))

    const r = await verificarRecaptcha('token', 'login', true)

    expect(r.permitido).toBe(false)
    expect(r.motivo).toContain('accion no coincide')
  })

  it('rechaza cuando Google dice que el token no sirve', async () => {
    const { verificarRecaptcha } = await importarConSecret('secreto')
    vi.stubGlobal(
      'fetch',
      siteverify({ success: false, 'error-codes': ['timeout-or-duplicate'] })
    )

    const r = await verificarRecaptcha('token', 'login', true)

    expect(r.permitido).toBe(false)
    expect(r.motivo).toContain('timeout-or-duplicate')
  })

  it('respeta un umbral custom', async () => {
    const { verificarRecaptcha } = await importarConSecret('secreto', '0.8')
    vi.stubGlobal('fetch', siteverify({ success: true, score: 0.7, action: 'login' }))

    expect((await verificarRecaptcha('token', 'login', true)).permitido).toBe(false)
  })

  describe('sin token', () => {
    it('lo exige donde se crean cuentas', async () => {
      const { verificarRecaptcha } = await importarConSecret('secreto')

      const r = await verificarRecaptcha(null, 'registro', true)

      expect(r.permitido).toBe(false)
      expect(r.motivo).toBe('sin-token')
      expect(fetch).not.toHaveBeenCalled()
    })

    it('lo perdona en el login', async () => {
      // Un bloqueador de publicidad no puede dejar a un chofer sin poder entrar.
      const { verificarRecaptcha } = await importarConSecret('secreto')

      const r = await verificarRecaptcha(null, 'login', false)

      expect(r.permitido).toBe(true)
      expect(r.motivo).toBe('sin-token')
    })
  })

  describe('cuando Google no esta disponible', () => {
    it('deja pasar si siteverify devuelve un error HTTP', async () => {
      const { verificarRecaptcha } = await importarConSecret('secreto')
      vi.stubGlobal('fetch', siteverify({}, false))

      const r = await verificarRecaptcha('token', 'login', true)

      expect(r.permitido).toBe(true)
      expect(r.motivo).toBe('siteverify-no-disponible')
    })

    it('deja pasar si la request se cae o hace timeout', async () => {
      const { verificarRecaptcha } = await importarConSecret('secreto')
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('TimeoutError')))

      const r = await verificarRecaptcha('token', 'registro', true)

      expect(r.permitido).toBe(true)
      expect(r.motivo).toBe('error-de-red')
    })
  })
})

describe('tokenDeRequest', () => {
  it('lee el header, sin importar mayusculas', async () => {
    const { tokenDeRequest } = await importarConSecret('secreto')

    const req = new Request('https://x.test', { headers: { 'X-Recaptcha-Token': 'abc' } })

    expect(tokenDeRequest(req)).toBe('abc')
  })

  it('devuelve null si no vino', async () => {
    const { tokenDeRequest } = await importarConSecret('secreto')

    expect(tokenDeRequest(new Request('https://x.test'))).toBeNull()
  })
})
