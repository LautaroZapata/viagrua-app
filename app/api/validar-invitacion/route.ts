import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { sanitizeString, isValidCodigoInvitacion } from '@/lib/validation'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const codigo = sanitizeString(searchParams.get('codigo') ?? '')

  if (!isValidCodigoInvitacion(codigo)) {
    return NextResponse.json({ error: 'Código de invitación inválido' }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin
    .from('invitaciones')
    .select('id, empresa_id, codigo, usado, expires_at')
    .eq('codigo', codigo)
    .single()

  if (error || !data) {
    return NextResponse.json({ error: 'Código de invitación inválido' }, { status: 404 })
  }

  if (data.usado) {
    return NextResponse.json({ error: 'Este código ya fue utilizado' }, { status: 400 })
  }

  if (data.expires_at && new Date(data.expires_at) < new Date()) {
    return NextResponse.json({ error: 'Este código ha expirado' }, { status: 400 })
  }

  if (!data.empresa_id) {
    return NextResponse.json({ error: 'Código de invitación inválido' }, { status: 404 })
  }

  const { data: empresa } = await supabaseAdmin
    .from('empresas')
    .select('nombre')
    .eq('id', data.empresa_id)
    .single()

  // Solo el nombre. Esta ruta es publica y sin autenticar: devolver empresa_id
  // o el id de la invitacion la convertia en un oraculo para enumerar empresas
  // ajenas por UUID. El nombre alcanza para que el invitado sepa a donde entra.
  return NextResponse.json({
    empresa_nombre: empresa?.nombre ?? 'Empresa',
  })
}
