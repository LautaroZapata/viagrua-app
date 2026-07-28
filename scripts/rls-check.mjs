// Matriz de ataque sobre RLS: verifica que un usuario de la empresa B no pueda
// escalar privilegios ni tocar datos de la empresa A, y que los flujos
// legitimos sigan andando.
//
//   pnpm rls:check
//
// OJO: corre contra el proyecto que apunte .env.local, o sea PRODUCCION.
// Crea dos empresas y tres usuarios descartables (prefijo ZZTest / zztest-) y
// los borra al final, incluso si algun assert falla. Aun asi, no lo corras
// mientras haya gente usando la app.
//
// Necesita SUPABASE_SERVICE_ROLE_KEY en .env.local. Para saltear la
// confirmacion en CI: RLS_CHECK_CONFIRM=si
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'

const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8')
    .split('\n')
    .filter((l) => l.trim() && !l.trim().startsWith('#'))
    .map((l) => {
      const i = l.indexOf('=')
      return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')]
    })
)

const URL = env.NEXT_PUBLIC_SUPABASE_URL
const ANON = env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const SERVICE = env.SUPABASE_SERVICE_ROLE_KEY

if (!URL || !ANON || !SERVICE) {
  console.error('Faltan NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY o SUPABASE_SERVICE_ROLE_KEY en .env.local')
  process.exit(1)
}

const esLocal = URL.includes('localhost') || URL.includes('127.0.0.1')
if (!esLocal && process.env.RLS_CHECK_CONFIRM !== 'si') {
  const host = URL.replace(/^https?:\/\//, '').split('/')[0]
  console.error(`\nEste script escribe y borra datos en un proyecto REMOTO: ${host}`)
  console.error('Si estas seguro, volve a correrlo con RLS_CHECK_CONFIRM=si\n')
  process.exit(1)
}

const admin = createClient(URL, SERVICE, { auth: { persistSession: false } })

const SUFIJO = Date.now()
const PASS = 'Test-' + SUFIJO + '-Xy!'
const creado = { users: [], empresas: [] }

let ok = 0
let fail = 0
function check(nombre, paso, detalle = '') {
  if (paso) { ok++; console.log(`  PASA  ${nombre}`) }
  else { fail++; console.log(`  FALLA ${nombre}${detalle ? ' -> ' + detalle : ''}`) }
}

async function crearUsuario(email) {
  const { data, error } = await admin.auth.admin.createUser({
    email, password: PASS, email_confirm: true,
  })
  if (error) throw new Error('createUser: ' + error.message)
  creado.users.push(data.user.id)
  return data.user
}

async function comoUsuario(email) {
  const c = createClient(URL, ANON, { auth: { persistSession: false } })
  const { error } = await c.auth.signInWithPassword({ email, password: PASS })
  if (error) throw new Error('signIn ' + email + ': ' + error.message)
  return c
}

try {
  console.log('\n=== SETUP ===')
  const { data: empA, error: eA } = await admin
    .from('empresas').insert({ nombre: `ZZTest A ${SUFIJO}` }).select().single()
  if (eA) throw new Error('empresa A: ' + eA.message)
  creado.empresas.push(empA.id)

  const { data: empB, error: eB } = await admin
    .from('empresas').insert({ nombre: `ZZTest B ${SUFIJO}` }).select().single()
  if (eB) throw new Error('empresa B: ' + eB.message)
  creado.empresas.push(empB.id)

  const uA = await crearUsuario(`zztest-a-${SUFIJO}@example.com`)
  const uB = await crearUsuario(`zztest-b-${SUFIJO}@example.com`)

  // service_role puede escribir rol/empresa_id: el trigger solo frena a 'authenticated'
  await admin.from('perfiles').update({ empresa_id: empA.id, rol: 'admin' }).eq('id', uA.id)
  await admin.from('perfiles').update({ empresa_id: empB.id, rol: 'chofer' }).eq('id', uB.id)

  const { data: trasA } = await admin.from('traslados')
    .insert({ empresa_id: empA.id, chofer_id: uA.id, marca_modelo: 'ZZTest Auto A', estado: 'pendiente' })
    .select().single()

  console.log(`  empresa A=${empA.id.slice(0, 8)}  empresa B=${empB.id.slice(0, 8)}`)

  const cliB = await comoUsuario(`zztest-b-${SUFIJO}@example.com`)

  console.log('\n=== ATAQUES (todos deben ser bloqueados) ===')

  // 1. El agujero principal: registrarse como admin de una empresa ajena
  const anon = createClient(URL, ANON, { auth: { persistSession: false } })
  const { data: hijack, error: errHijack } = await anon.auth.signUp({
    email: `zzhijack-${SUFIJO}@example.com`,
    password: PASS,
    options: { data: { nombre_completo: 'Atacante', empresa_id: empA.id } },
  })
  if (hijack?.user?.id) creado.users.push(hijack.user.id)
  let perfilHijack = null
  if (hijack?.user?.id) {
    const { data } = await admin.from('perfiles').select('rol, empresa_id').eq('id', hijack.user.id).single()
    perfilHijack = data
  }
  check(
    'signUp con empresa_id ajeno NO da admin de esa empresa',
    !!errHijack || !perfilHijack || perfilHijack.empresa_id !== empA.id,
    errHijack ? `rechazado: ${errHijack.message}` : `perfil quedo: ${JSON.stringify(perfilHijack)}`
  )

  // 2. Escalada de privilegios sobre la propia fila
  await cliB.from('perfiles').update({ rol: 'admin' }).eq('id', uB.id)
  const { data: pB1 } = await admin.from('perfiles').select('rol').eq('id', uB.id).single()
  check('chofer NO puede subirse a admin', pB1.rol === 'chofer', `rol=${pB1.rol}`)

  // 3. Salto de tenant
  await cliB.from('perfiles').update({ empresa_id: empA.id }).eq('id', uB.id)
  const { data: pB2 } = await admin.from('perfiles').select('empresa_id').eq('id', uB.id).single()
  check('chofer NO puede cambiar su empresa_id', pB2.empresa_id === empB.id,
    `empresa_id=${pB2.empresa_id?.slice(0, 8)}`)

  // 4. Lectura cross-tenant de traslados (la vieja policy "Realtime select")
  const { data: leak } = await cliB.from('traslados').select('id').eq('empresa_id', empA.id)
  check('NO lee traslados de otra empresa', !leak || leak.length === 0, `filas=${leak?.length}`)

  // 5. RPC sin scope de empresa
  const { data: counts } = await cliB.rpc('get_traslados_counts', { p_empresa_id: empA.id })
  check('get_traslados_counts NO filtra otra empresa', !counts || counts.total === 0,
    `total=${counts?.total}`)

  // 6. UPDATE cross-tenant (la policy rota de 'COMPLETADO')
  await cliB.from('traslados').update({ estado: 'completado' }).eq('id', trasA.id)
  const { data: tCheck } = await admin.from('traslados').select('estado').eq('id', trasA.id).single()
  check('NO edita traslados de otra empresa', tCheck.estado === 'pendiente', `estado=${tCheck.estado}`)

  // 7. DELETE cross-tenant
  await cliB.from('traslados').delete().eq('id', trasA.id)
  const { data: tExiste } = await admin.from('traslados').select('id').eq('id', trasA.id).maybeSingle()
  check('NO borra traslados de otra empresa', !!tExiste)

  // 8. Lectura de invitaciones ajenas
  const { data: invA } = await admin.from('invitaciones')
    .insert({ empresa_id: empA.id, codigo: `ZZTEST${SUFIJO}`.slice(0, 20) }).select().single()
  const { data: invLeak } = await cliB.from('invitaciones').select('codigo')
  check('NO lee codigos de invitacion ajenos',
    !invLeak || !invLeak.some((i) => i.codigo === invA?.codigo), `filas=${invLeak?.length}`)

  // 9. Expulsar a alguien de otra empresa
  const { error: errExp } = await cliB.rpc('expulsar_chofer', { chofer_id: uA.id })
  const { data: pA } = await admin.from('perfiles').select('empresa_id').eq('id', uA.id).single()
  check('NO expulsa choferes de otra empresa', !!errExp || pA.empresa_id === empA.id,
    errExp ? `rechazado: ${errExp.message}` : 'sin error')

  console.log('\n=== FLUJOS LEGITIMOS (deben seguir funcionando) ===')

  const cliA = await comoUsuario(`zztest-a-${SUFIJO}@example.com`)

  const { data: propios } = await cliA.from('traslados').select('id').eq('empresa_id', empA.id)
  check('admin lee los traslados de SU empresa', propios?.length > 0, `filas=${propios?.length}`)

  const { error: errUpd } = await cliA.from('traslados')
    .update({ estado_pago: 'efectivo' }).eq('id', trasA.id)
  check('admin actualiza un traslado propio', !errUpd, errUpd?.message)

  const { data: cnt } = await cliA.rpc('get_traslados_counts', { p_empresa_id: empA.id })
  check('get_traslados_counts anda para la empresa propia', cnt?.total > 0, `total=${cnt?.total}`)

  const { error: errTel } = await cliA.from('perfiles')
    .update({ telefono: '+54 11 5555-5555' }).eq('id', uA.id)
  check('usuario edita su telefono', !errTel, errTel?.message)

  const { error: errInv } = await cliA.from('invitaciones')
    .insert({ empresa_id: empA.id, codigo: `ZZOK${SUFIJO}`.slice(0, 20) })
  check('admin crea invitaciones de su empresa', !errInv, errInv?.message)

  const { data: invExp } = await admin.from('invitaciones')
    .select('expires_at').eq('empresa_id', empA.id).limit(1).single()
  check('la invitacion recibe expires_at por default', !!invExp?.expires_at,
    `expires_at=${invExp?.expires_at}`)

  const { error: errExpOk } = await cliA.rpc('expulsar_chofer', { chofer_id: uA.id })
  check('admin puede expulsar en su empresa', !errExpOk, errExpOk?.message)

  console.log(`\n=== RESULTADO: ${ok} pasan, ${fail} fallan ===\n`)
} catch (e) {
  console.error('\nERROR EN EL TEST:', e.message, '\n')
  fail++
} finally {
  console.log('=== LIMPIEZA ===')
  for (const id of creado.empresas) {
    await admin.from('invitaciones').delete().eq('empresa_id', id)
    await admin.from('traslados').delete().eq('empresa_id', id)
  }
  for (const id of creado.users) {
    await admin.from('perfiles').delete().eq('id', id)
    await admin.auth.admin.deleteUser(id).catch(() => {})
  }
  for (const id of creado.empresas) await admin.from('empresas').delete().eq('id', id)

  const { data: resto } = await admin.from('empresas').select('id').like('nombre', 'ZZTest%')
  console.log(`  usuarios borrados: ${creado.users.length}, empresas borradas: ${creado.empresas.length}`)
  console.log(`  empresas ZZTest remanentes: ${resto?.length ?? '?'}`)
  process.exit(fail > 0 ? 1 : 0)
}
