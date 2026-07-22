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

    // Look up invitation (use supabaseAdmin to bypass RLS for unauthenticated lookup)
    const { data: invitacion, error: invError } = await supabaseAdmin
      .from('invitaciones')
      .select('id, empresa_id, usado, expires_at')
      .eq('codigo', codigo)
      .single()

    if (invError || !invitacion) {
      return NextResponse.json({ error: 'Invitación no encontrada' }, { status: 404 })
    }

    // Check if already used
    if (invitacion.usado) {
      return NextResponse.json({ error: 'Esta invitación ya fue utilizada' }, { status: 400 })
    }

    // Check expiration
    if (invitacion.expires_at && new Date(invitacion.expires_at) < new Date()) {
      return NextResponse.json({ error: 'Esta invitación ha expirado' }, { status: 400 })
    }

    // Create user with Supabase Auth (use admin client to bypass email confirmation if needed)
    const { data: authData, error: signUpError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Auto-confirm since they were invited
    })

    if (signUpError) {
      console.error('Error creando usuario:', signUpError)
      // Don't leak internal error details
      if (signUpError.message?.includes('already registered')) {
        return NextResponse.json({ error: 'Este email ya está registrado' }, { status: 409 })
      }
      return NextResponse.json({ error: 'Error al crear la cuenta' }, { status: 500 })
    }

    if (!authData.user) {
      return NextResponse.json({ error: 'Error al crear la cuenta' }, { status: 500 })
    }

    // Create profile
    const { error: profileError } = await supabaseAdmin
      .from('perfiles')
      .insert({
        id: authData.user.id,
        email,
        nombre_completo: nombre,
        rol: 'chofer',
        empresa_id: invitacion.empresa_id,
      })

    if (profileError) {
      console.error('Error creando perfil:', profileError)
      // Rollback: delete the auth user if profile creation fails
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id)
      return NextResponse.json({ error: 'Error al crear el perfil' }, { status: 500 })
    }

    // Mark invitation as used (atomic update with usado=false check)
    const { error: markError } = await supabaseAdmin
      .from('invitaciones')
      .update({ usado: true })
      .eq('id', invitacion.id)
      .eq('usado', false) // Optimistic lock

    if (markError) {
      console.error('Error marcando invitación:', markError)
      // Non-critical: profile is already created
    }

    auditLog({ userId: authData.user.id, empresaId: invitacion.empresa_id, action: 'join_company', details: { codigo } })

    return NextResponse.json({ ok: true, userId: authData.user.id })
  } catch (e) {
    console.error('Error en unirse POST:', e)
    return NextResponse.json({ error: 'Error al procesar la invitación' }, { status: 500 })
  }
}
