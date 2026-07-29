'use client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { AlertTriangle, Info } from 'lucide-react'
import type { OpcionToggle } from '@/lib/trasladoStatus'

interface Props {
    titulo: string
    opciones: OpcionToggle[]
    valorActual: string | null
    onCambiar: (valor: string) => void
    /** Deshabilita los botones mientras hay un update en vuelo. */
    actualizando: boolean
    /** Si el valor ya no se puede cambiar, con el motivo a mostrar. */
    bloqueado?: { mensaje: React.ReactNode; tono: 'destructive' | 'info' }
}

/**
 * Selector de estado / estado de pago del detalle de un traslado.
 *
 * Estaba escrito dos veces, una en la vista de admin y otra en la del chofer,
 * con los mismos mapas de estilos copiados en cada archivo (y en la del chofer
 * la copia se llamaba pagoConfig2).
 *
 * min-h-[44px] es a proposito: es el minimo de area tactil de WCAG 2.5.5, y
 * estos botones se usan sobre todo desde el telefono.
 */
export default function ToggleEstado({
    titulo,
    opciones,
    valorActual,
    onCambiar,
    actualizando,
    bloqueado,
}: Props) {
    return (
        <Card>
            <CardHeader className="pb-3">
                <CardTitle className="text-sm">{titulo}</CardTitle>
            </CardHeader>
            <CardContent>
                {bloqueado && (
                    <Alert variant={bloqueado.tono === 'destructive' ? 'destructive' : 'default'} className="mb-3">
                        {bloqueado.tono === 'destructive' ? <AlertTriangle className="size-4" /> : <Info className="size-4" />}
                        <AlertDescription>{bloqueado.mensaje}</AlertDescription>
                    </Alert>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2" role="group" aria-label={titulo}>
                    {opciones.map((o) => {
                        const seleccionado = valorActual === o.valor
                        return (
                            <Button
                                key={o.valor}
                                variant="ghost"
                                aria-pressed={seleccionado}
                                onClick={() => onCambiar(o.valor)}
                                disabled={actualizando || !!bloqueado}
                                className={`min-h-[44px] ${seleccionado ? o.activo : o.inactivo} ${bloqueado ? 'opacity-50' : ''}`}
                            >
                                {o.label}
                            </Button>
                        )
                    })}
                </div>
            </CardContent>
        </Card>
    )
}
