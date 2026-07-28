'use client'
import { useState, useRef, useEffect, useCallback } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { supabase } from '@/lib/supabase'
import { showError } from '@/lib/swal'
import { Button } from '@/components/ui/button'
import { Mail, Copy, Check } from 'lucide-react'

/**
 * Generacion de codigo de invitacion + QR + copiar link.
 *
 * Fuente unica para InviteModal y para el paso de invitacion del onboarding.
 * Antes eran dos copias que ya habian divergido: una mandaba expires_at y la
 * otra no, mientras ambas prometian "expira en 7 dias" en pantalla.
 * Hoy el vencimiento lo pone la DB (default de 7 dias, NOT NULL).
 *
 * El QR se dibuja localmente. Antes salia de api.qrserver.com, lo que mandaba
 * el link de invitacion entero a un tercero y dependia de su disponibilidad
 * en un paso critico del alta.
 */

/** Alfabeto sin caracteres ambiguos (0/O, 1/I/L) para dictar el codigo en voz alta. */
const ALFABETO = '23456789ABCDEFGHJKMNPQRSTUVWXYZ'
const LARGO_CODIGO = 12

function generarCodigo(): string {
  const bytes = new Uint8Array(LARGO_CODIGO)
  crypto.getRandomValues(bytes)
  // Rechazo del resto para no sesgar hacia el principio del alfabeto.
  const limite = 256 - (256 % ALFABETO.length)
  let out = ''
  for (let i = 0; out.length < LARGO_CODIGO; i++) {
    if (i >= bytes.length) {
      crypto.getRandomValues(bytes)
      i = 0
    }
    const b = bytes[i]!
    if (b < limite) out += ALFABETO[b % ALFABETO.length]
  }
  return out
}

interface Props {
  empresaId: string | null
  /** Se llama despues de generar, por si el contenedor quiere reaccionar. */
  onGenerado?: (codigo: string) => void
}

export default function InvitacionQR({ empresaId, onGenerado }: Props) {
  const [codigo, setCodigo] = useState('')
  const [link, setLink] = useState('')
  const [generando, setGenerando] = useState(false)
  const [copiado, setCopiado] = useState(false)
  const timersRef = useRef<NodeJS.Timeout[]>([])

  useEffect(() => () => timersRef.current.forEach(clearTimeout), [])

  const generar = useCallback(async () => {
    if (!empresaId) return
    setGenerando(true)
    const nuevo = generarCodigo()
    const { error } = await supabase
      .from('invitaciones')
      .insert({ empresa_id: empresaId, codigo: nuevo })

    if (error) {
      showError('No se pudo generar el codigo. Intentalo de nuevo.')
      console.error('Error generando invitacion:', error)
      setGenerando(false)
      return
    }

    setCodigo(nuevo)
    setLink(`${window.location.origin}/unirse/${nuevo}`)
    setGenerando(false)
    onGenerado?.(nuevo)
  }, [empresaId, onGenerado])

  const copiar = useCallback(async () => {
    if (!link) return
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(link)
      } else {
        const ta = document.createElement('textarea')
        ta.value = link
        document.body.appendChild(ta)
        ta.select()
        document.execCommand('copy')
        document.body.removeChild(ta)
      }
      setCopiado(true)
      timersRef.current.push(setTimeout(() => setCopiado(false), 2000))
    } catch {
      showError('No se pudo copiar. Copialo manualmente: ' + link)
    }
  }, [link])

  if (!codigo) {
    return (
      <div className="text-center py-4">
        <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
          <Mail className="size-7 text-primary" />
        </div>
        <p className="text-muted-foreground text-sm mb-6">
          Compartile el link o codigo al chofer para que se registre
        </p>
        <Button onClick={generar} disabled={generando || !empresaId} className="w-full max-w-xs mx-auto">
          {generando ? 'Generando...' : 'Generar Invitacion'}
        </Button>
      </div>
    )
  }

  return (
    <div className="text-center py-2">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
        Codigo de invitacion
      </p>
      <p className="text-2xl font-bold text-primary mb-4 tracking-widest font-mono break-all">{codigo}</p>

      {/* Fondo blanco fijo y borde: un QR necesita contraste claro/oscuro real,
          asi que no sigue el tema. */}
      <div className="inline-flex bg-white p-3 rounded-lg mb-4 border border-border">
        <QRCodeSVG value={link} size={144} level="M" marginSize={0} />
      </div>

      <p className="text-xs text-muted-foreground mb-3">El chofer puede escanear el QR o usar el link</p>
      <div className="bg-muted rounded-lg p-3 mb-4">
        <p className="text-xs text-muted-foreground break-all font-mono">{link}</p>
      </div>
      <Button onClick={copiar} className="w-full max-w-xs mx-auto" variant={copiado ? 'outline' : 'default'}>
        {copiado ? (
          <><Check className="size-4 mr-1.5" /> Link Copiado</>
        ) : (
          <><Copy className="size-4 mr-1.5" /> Copiar Link</>
        )}
      </Button>
      <p className="text-xs text-muted-foreground mt-3">
        Este codigo expira en 7 dias y solo puede usarse una vez
      </p>
    </div>
  )
}
