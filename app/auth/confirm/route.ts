import { NextResponse } from 'next/server'
import type { EmailOtpType } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'

/**
 * Punto de aterrizaje de los links que Supabase manda por mail (recuperar
 * contraseña, confirmar email).
 *
 * Acepta las dos formas, porque cual llega depende de la plantilla de mail
 * configurada en el proyecto:
 *
 * - token_hash + type: la plantilla usa {{ .TokenHash }}. Es la que conviene,
 *   porque funciona aunque el mail se abra en otro dispositivo o navegador.
 * - code: flujo PKCE, el default. Solo funciona en el mismo navegador que pidio
 *   el reset, porque el code_verifier vive en una cookie de ese navegador.
 *
 * Si el link es invalido o vencido no se filtra el motivo: se manda a /login
 * con un flag generico.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const tokenHash = searchParams.get('token_hash')
  const type = searchParams.get('type') as EmailOtpType | null
  const code = searchParams.get('code')

  // Solo rutas internas: un `next` controlado por el atacante seria un open
  // redirect, y encima sobre una request que acaba de crear una sesion.
  const nextParam = searchParams.get('next') ?? '/nueva-password'
  const next = nextParam.startsWith('/') && !nextParam.startsWith('//')
    ? nextParam
    : '/nueva-password'

  const supabase = await createClient()

  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash })
    if (!error) return NextResponse.redirect(new URL(next, origin))
  } else if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) return NextResponse.redirect(new URL(next, origin))
  }

  return NextResponse.redirect(new URL('/login?error=link_invalido', origin))
}
