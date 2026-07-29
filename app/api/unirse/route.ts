import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { auditLog } from '@/lib/audit'
import {
  sanitizeString,
  sanitizeAndLimit,
  isValidEmail,
  isValidPassword,
  isValidCodigoInvitacion,
  LIMITS,
} from '@/lib/validation'

const MAX_BODY_SIZE = 5_000

export async function POST(request: Request) {
  try {
    // Content-Type check
    const contentType = request.headers.get('content-type')
    if (!contentType?.includes('application/json')) {
      return NextResponse.json({ error: 'Content-Type debe ser application/json' }, { status: 415 })
    }

    // Body size limit
    const rawBody = await request.text()
    if (rawBody.length > MAX_BODY_SIZE) {
      return NextResponse.json({ error: 'Body demasiado grande' }, { status: 413 })
    }

    let body: Record<string, unknown>
    try {
      body = JSON.parse(rawBody)
    } catch {
      return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
    }

    if (typeof body !== 'object' || body === null || Array.isArray(body)) {
      return NextResponse.json({ error: 'Se espera un objeto JSON' }, { status: 400 })
    }

    // Validate inputs
    const codigo = sanitizeString(body.codigo)
    const email = sanitizeString(body.email)
    const password = sanitizeString(body.password)
    const nombre = sanitizeAndLimit(body.nombre, LIMITS.nombre)

    if (!isValidCodigoInvitacion(codigo)) {
      return NextResponse.json({ error: 'Código de invitación inválido' }, { status: 400 })
    }
    if (!isValidEmail(email)) {
      return NextResponse.json({ error: 'Email inválido' }, { status: 400 })
    }
    if (!isValidPassword(password)) {
      return NextResponse.json({ error: 'La contraseña debe tener entre 6 y 128 caracteres' }, { status: 400 })
    }
    if (!nombre) {
      return NextResponse.json({ error: 'El nombre es requerido' }, { status: 400 })
    }

    // Consumir la invitacion PRIMERO, con un UPDATE condicional.
    // Antes se leia, se creaba el usuario y recien al final se marcaba usada:
    // dos requests concurrentes con el mismo codigo pasaban ambos el chequeo y
    // creaban dos cuentas. Aca el UPDATE es el que arbitra: solo uno recibe fila.
    const { data: invitacion, error: invError } = await supabaseAdmin
      .from('invitaciones')
      .update({ usado: true })
      .eq('codigo', codigo)
      .eq('usado', false)
      .gte('expires_at', new Date().toISOString())
      .select('id, empresa_id')
      .single()

    if (invError || !invitacion) {
      return NextResponse.json(
        { error: 'Invitación inválida, ya utilizada o expirada' },
        { status: 400 },
      )
    }

    /** Devuelve la invitacion al pool si el alta no llega a completarse. */
    const liberarInvitacion = async () => {
      await supabaseAdmin.from('invitaciones').update({ usado: false }).eq('id', invitacion.id)
    }

    const { data: authData, error: signUpError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Auto-confirmado: viene de una invitacion
    })

    if (signUpError || !authData?.user) {
      await liberarInvitacion()
      console.error('Error creando usuario:', signUpError)
      if (signUpError?.message?.includes('already registered')) {
        return NextResponse.json({ error: 'Este email ya está registrado' }, { status: 409 })
      }
      return NextResponse.json({ error: 'Error al crear la cuenta' }, { status: 500 })
    }

    // UPDATE, no INSERT: el trigger on_auth_user_created ya creo la fila de
    // perfiles al insertarse el usuario en auth.users. Insertar de nuevo choca
    // contra la PK (23505) y hacia fallar todo el alta con un 500.
    // El email lo completa el trigger set_perfil_email.
    const { error: profileError } = await supabaseAdmin
      .from('perfiles')
      .update({
        nombre_completo: nombre,
        rol: 'chofer',
        empresa_id: invitacion.empresa_id,
      })
      .eq('id', authData.user.id)

    if (profileError) {
      console.error('Error completando perfil:', profileError)
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id)
      await liberarInvitacion()
      return NextResponse.json({ error: 'Error al crear el perfil' }, { status: 500 })
    }

    auditLog({ userId: authData.user.id, empresaId: invitacion.empresa_id, action: 'join_company', details: { codigo } })

    return NextResponse.json({ ok: true, userId: authData.user.id })
  } catch (e) {
    console.error('Error en unirse POST:', e)
    return NextResponse.json({ error: 'Error al procesar la invitación' }, { status: 500 })
  }
}
