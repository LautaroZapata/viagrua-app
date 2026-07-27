// @vitest-environment node
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { LIMITS } from '../validation'

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  adminFrom: vi.fn(),
  auditLog: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({ createClient: mocks.createClient }))
vi.mock('@/lib/supabaseAdmin', () => ({ supabaseAdmin: { from: mocks.adminFrom } }))
vi.mock('@/lib/audit', () => ({ auditLog: mocks.auditLog }))

const { POST, DELETE } = await import('@/app/api/gastos/route')

const EMPRESA_ID = '3da7854b-b538-4ab9-abde-361b0e0488a7'
const OTRA_EMPRESA_ID = '11111111-2222-3333-4444-555555555555'
const USER_ID = 'af98ce62-1a6f-4803-ae0c-bb3b0666d239'
const OTRO_USER_ID = '99999999-8888-7777-6666-555555555555'
const GASTO_ID = '60c27192-de8c-4a07-9e31-bbdc4d7919ae'

/** Cliente con sesión: `auth.getUser()` + `from('perfiles').select().eq().single()` */
function stubServerClient(opts: {
  user?: { id: string } | null
  authError?: unknown
  perfil?: { empresa_id: string; rol: string } | null
  perfilError?: unknown
} = {}) {
  const {
    user = { id: USER_ID },
    authError = null,
    perfil = { empresa_id: EMPRESA_ID, rol: 'admin' },
    perfilError = null,
  } = opts

  mocks.createClient.mockResolvedValue({
    auth: { getUser: async () => ({ data: { user }, error: authError }) },
    from: () => ({
      select: () => ({
        eq: () => ({ single: async () => ({ data: perfil, error: perfilError }) }),
      }),
    }),
  })
}

/** Cliente service-role. Devuelve los espías para inspeccionar lo que se le pasó. */
function stubAdmin(opts: {
  insertResult?: { data: unknown; error: unknown }
  gastoRow?: { id: string; empresa_id: string; usuario_id?: string; user_id?: string } | null
  gastoError?: unknown
  deleteError?: unknown
} = {}) {
  const {
    insertResult = { data: { id: GASTO_ID }, error: null },
    gastoRow = { id: GASTO_ID, empresa_id: EMPRESA_ID, usuario_id: USER_ID },
    gastoError = null,
    deleteError = null,
  } = opts

  const insert = vi.fn(() => ({ select: () => ({ single: async () => insertResult }) }))
  const select = vi.fn(() => ({
    eq: () => ({ single: async () => ({ data: gastoRow, error: gastoError }) }),
  }))
  const deleteEq = vi.fn(async () => ({ error: deleteError }))
  const del = vi.fn(() => ({ eq: deleteEq }))

  mocks.adminFrom.mockImplementation(() => ({ insert, select, delete: del }))
  return { insert, select, del, deleteEq }
}

function postRequest(body: unknown, contentType: string | null = 'application/json') {
  return new Request('http://localhost/api/gastos', {
    method: 'POST',
    headers: contentType ? { 'Content-Type': contentType } : {},
    body: typeof body === 'string' ? body : JSON.stringify(body),
  })
}

function deleteRequest(id: string | null) {
  const url = id === null
    ? 'http://localhost/api/gastos'
    : `http://localhost/api/gastos?id=${encodeURIComponent(id)}`
  return new Request(url, { method: 'DELETE' })
}

const bodyValido = {
  empresa_id: EMPRESA_ID,
  user_id: USER_ID,
  tipo: 'combustible',
  importe: 1500.5,
  descripcion: 'Nafta ruta 9',
  fecha: '2026-07-26',
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('POST /api/gastos — nombre de columna (regresión usuario_id)', () => {
  it('inserta usando la columna usuario_id, nunca user_id', async () => {
    stubServerClient()
    const { insert } = stubAdmin()

    const res = await POST(postRequest(bodyValido))

    expect(res.status).toBe(200)
    expect(insert).toHaveBeenCalledTimes(1)
    const payload = insert.mock.calls[0][0] as Record<string, unknown>
    expect(payload).toHaveProperty('usuario_id', USER_ID)
    expect(payload).not.toHaveProperty('user_id')
  })

  it('toma usuario_id de la sesión, no del body', async () => {
    stubServerClient({ user: { id: USER_ID }, perfil: { empresa_id: EMPRESA_ID, rol: 'admin' } })
    const { insert } = stubAdmin()

    await POST(postRequest({ ...bodyValido, usuario_id: OTRO_USER_ID }))

    const payload = insert.mock.calls[0][0] as Record<string, unknown>
    expect(payload.usuario_id).toBe(USER_ID)
  })
})

describe('POST /api/gastos — payload insertado', () => {
  it('escribe las 6 columnas esperadas con los tipos correctos', async () => {
    stubServerClient()
    const { insert } = stubAdmin()

    await POST(postRequest({ ...bodyValido, importe: '2500.75' }))

    const payload = insert.mock.calls[0][0] as Record<string, unknown>
    expect(Object.keys(payload).sort()).toEqual(
      ['descripcion', 'empresa_id', 'fecha', 'importe', 'tipo', 'usuario_id'].sort(),
    )
    expect(payload.empresa_id).toBe(EMPRESA_ID)
    expect(payload.tipo).toBe('combustible')
    expect(payload.importe).toBe(2500.75)
    expect(typeof payload.importe).toBe('number')
    expect(payload.fecha).toBe('2026-07-26')
    expect(payload.descripcion).toBe('Nafta ruta 9')
  })

  it('manda descripcion null cuando viene vacía', async () => {
    stubServerClient()
    const { insert } = stubAdmin()

    await POST(postRequest({ ...bodyValido, descripcion: '' }))

    expect((insert.mock.calls[0][0] as Record<string, unknown>).descripcion).toBeNull()
  })

  it('trunca descripcion a LIMITS.descripcion', async () => {
    stubServerClient()
    const { insert } = stubAdmin()

    await POST(postRequest({ ...bodyValido, descripcion: 'x'.repeat(LIMITS.descripcion + 200) }))

    const payload = insert.mock.calls[0][0] as Record<string, unknown>
    expect((payload.descripcion as string).length).toBe(LIMITS.descripcion)
  })

  it('devuelve el gasto creado y audita create_gasto', async () => {
    stubServerClient()
    stubAdmin({ insertResult: { data: { id: GASTO_ID, tipo: 'combustible' }, error: null } })

    const res = await POST(postRequest(bodyValido))
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.gasto).toEqual({ id: GASTO_ID, tipo: 'combustible' })
    expect(mocks.auditLog).toHaveBeenCalledWith(
      expect.objectContaining({ userId: USER_ID, empresaId: EMPRESA_ID, action: 'create_gasto' }),
    )
  })
})

describe('POST /api/gastos — guards', () => {
  it('415 si el Content-Type no es JSON', async () => {
    const res = await POST(postRequest(bodyValido, 'text/plain'))
    expect(res.status).toBe(415)
  })

  it('413 si el body supera 5000 bytes', async () => {
    const res = await POST(postRequest({ ...bodyValido, descripcion: 'x'.repeat(6000) }))
    expect(res.status).toBe(413)
  })

  it('400 si el JSON es inválido', async () => {
    const res = await POST(postRequest('{ no es json', 'application/json'))
    expect(res.status).toBe(400)
    expect((await res.json()).error).toBe('JSON inválido')
  })

  it('400 si el body es un array', async () => {
    const res = await POST(postRequest([bodyValido]))
    expect(res.status).toBe(400)
  })

  it('400 si empresa_id no es UUID', async () => {
    const res = await POST(postRequest({ ...bodyValido, empresa_id: 'no-uuid' }))
    expect(res.status).toBe(400)
    expect((await res.json()).error).toBe('empresa_id inválido')
  })

  it('400 si user_id no es UUID', async () => {
    const res = await POST(postRequest({ ...bodyValido, user_id: '123' }))
    expect(res.status).toBe(400)
    expect((await res.json()).error).toBe('user_id inválido')
  })

  it('400 si el tipo está fuera del whitelist', async () => {
    const res = await POST(postRequest({ ...bodyValido, tipo: 'criptomonedas' }))
    expect(res.status).toBe(400)
    expect((await res.json()).error).toBe('Tipo de gasto inválido')
  })

  it('400 si el importe es negativo o no numérico', async () => {
    expect((await POST(postRequest({ ...bodyValido, importe: -5 }))).status).toBe(400)
    expect((await POST(postRequest({ ...bodyValido, importe: 'abc' }))).status).toBe(400)
  })

  it('400 si la fecha no es YYYY-MM-DD válida', async () => {
    expect((await POST(postRequest({ ...bodyValido, fecha: '26/07/2026' }))).status).toBe(400)
    expect((await POST(postRequest({ ...bodyValido, fecha: '2026-02-30' }))).status).toBe(400)
  })

  it('401 sin sesión', async () => {
    stubServerClient({ user: null })
    const res = await POST(postRequest(bodyValido))
    expect(res.status).toBe(401)
  })

  it('403 si no existe el perfil', async () => {
    stubServerClient({ perfil: null, perfilError: { message: 'no rows' } })
    const res = await POST(postRequest(bodyValido))
    expect(res.status).toBe(403)
    expect((await res.json()).error).toBe('No se pudo verificar el perfil')
  })

  it('403 si el empresa_id del body no es el del perfil', async () => {
    stubServerClient({ perfil: { empresa_id: OTRA_EMPRESA_ID, rol: 'admin' } })
    const res = await POST(postRequest(bodyValido))
    expect(res.status).toBe(403)
    expect((await res.json()).error).toBe('No tienes permiso para crear gastos en esta empresa')
  })

  it('403 si el user_id del body no coincide con la sesión', async () => {
    stubServerClient()
    const res = await POST(postRequest({ ...bodyValido, user_id: OTRO_USER_ID }))
    expect(res.status).toBe(403)
    expect((await res.json()).error).toBe('Usuario no coincide con la sesión')
  })

  it('500 si Postgres rechaza el insert', async () => {
    stubServerClient()
    stubAdmin({ insertResult: { data: null, error: { code: '42703', message: 'column does not exist' } } })
    vi.spyOn(console, 'error').mockImplementation(() => {})

    const res = await POST(postRequest(bodyValido))

    expect(res.status).toBe(500)
    expect((await res.json()).error).toBe('Error al crear el gasto')
  })
})

describe('DELETE /api/gastos', () => {
  it('lee la columna usuario_id, nunca user_id', async () => {
    stubServerClient()
    const { select } = stubAdmin()

    await DELETE(deleteRequest(GASTO_ID))

    expect(select).toHaveBeenCalledWith('id, empresa_id, usuario_id')
  })

  it('el chofer dueño puede eliminar su propio gasto', async () => {
    stubServerClient({ perfil: { empresa_id: EMPRESA_ID, rol: 'chofer' } })
    const { deleteEq } = stubAdmin({ gastoRow: { id: GASTO_ID, empresa_id: EMPRESA_ID, usuario_id: USER_ID } })

    const res = await DELETE(deleteRequest(GASTO_ID))

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true })
    expect(deleteEq).toHaveBeenCalledWith('id', GASTO_ID)
    expect(mocks.auditLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'delete_gasto', empresaId: EMPRESA_ID }),
    )
  })

  it('el admin puede eliminar un gasto ajeno de su empresa', async () => {
    stubServerClient({ perfil: { empresa_id: EMPRESA_ID, rol: 'admin' } })
    stubAdmin({ gastoRow: { id: GASTO_ID, empresa_id: EMPRESA_ID, usuario_id: OTRO_USER_ID } })

    expect((await DELETE(deleteRequest(GASTO_ID))).status).toBe(200)
  })

  it('403 si un chofer intenta eliminar un gasto ajeno', async () => {
    stubServerClient({ perfil: { empresa_id: EMPRESA_ID, rol: 'chofer' } })
    stubAdmin({ gastoRow: { id: GASTO_ID, empresa_id: EMPRESA_ID, usuario_id: OTRO_USER_ID } })

    const res = await DELETE(deleteRequest(GASTO_ID))

    expect(res.status).toBe(403)
    expect((await res.json()).error).toBe('Solo el admin o el creador pueden eliminar este gasto')
  })

  it('403 si el gasto pertenece a otra empresa', async () => {
    stubServerClient()
    stubAdmin({ gastoRow: { id: GASTO_ID, empresa_id: OTRA_EMPRESA_ID, usuario_id: USER_ID } })

    const res = await DELETE(deleteRequest(GASTO_ID))

    expect(res.status).toBe(403)
    expect((await res.json()).error).toBe('No tienes permiso para eliminar este gasto')
  })

  it('400 si el id no es UUID (o falta)', async () => {
    expect((await DELETE(deleteRequest('abc'))).status).toBe(400)
    expect((await DELETE(deleteRequest(null))).status).toBe(400)
  })

  it('404 si el gasto no existe', async () => {
    stubServerClient()
    stubAdmin({ gastoRow: null, gastoError: { message: 'no rows' } })

    const res = await DELETE(deleteRequest(GASTO_ID))

    expect(res.status).toBe(404)
  })

  it('401 sin sesión', async () => {
    stubServerClient({ user: null })
    expect((await DELETE(deleteRequest(GASTO_ID))).status).toBe(401)
  })

  it('500 si Postgres rechaza el delete', async () => {
    stubServerClient()
    stubAdmin({ deleteError: { message: 'boom' } })
    vi.spyOn(console, 'error').mockImplementation(() => {})

    expect((await DELETE(deleteRequest(GASTO_ID))).status).toBe(500)
  })
})
