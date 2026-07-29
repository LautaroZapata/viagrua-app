'use client'
import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { Camera } from 'lucide-react'
import type { Tables } from '@/lib/db'

/**
 * Grilla de fotos de inspeccion con visor ampliado.
 *
 * Estaba duplicada entre la vista de admin y la del chofer, junto con el
 * armado del array y el Dialog.
 */
export default function FotosTraslado({ traslado }: { traslado: Tables<'traslados'> }) {
    const [ampliada, setAmpliada] = useState<string | null>(null)

    const fotos = [
        { tipo: 'Frontal', url: traslado.foto_frontal },
        { tipo: 'Lateral', url: traslado.foto_lateral },
        { tipo: 'Trasera', url: traslado.foto_trasera },
        { tipo: 'Interior', url: traslado.foto_interior },
    ].filter((f): f is { tipo: string; url: string } => !!f.url)

    if (fotos.length === 0) return null

    return (
        <>
            <Card>
                <CardHeader className="pb-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                        <Camera className="size-4 text-muted-foreground" />
                        Fotos de inspeccion
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-2 gap-2">
                        {fotos.map((f) => (
                            <button
                                key={f.tipo}
                                type="button"
                                onClick={() => setAmpliada(f.url)}
                                aria-label={`Ampliar foto ${f.tipo.toLowerCase()}`}
                                className="relative block w-full rounded-lg overflow-hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            >
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                    src={f.url}
                                    alt={`Foto ${f.tipo.toLowerCase()} del vehiculo`}
                                    loading="lazy"
                                    className="w-full h-28 sm:h-36 object-cover hover:opacity-90 transition"
                                />
                                <span className="absolute bottom-1.5 left-1.5 bg-black/70 text-white text-xs px-1.5 py-0.5 rounded">
                                    {f.tipo}
                                </span>
                            </button>
                        ))}
                    </div>
                </CardContent>
            </Card>

            <Dialog open={!!ampliada} onOpenChange={() => setAmpliada(null)}>
                <DialogContent className="max-w-4xl p-0 bg-black/95 border-none">
                    <DialogTitle className="sr-only">Foto ampliada</DialogTitle>
                    {ampliada && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={ampliada} alt="Foto ampliada del vehiculo" className="w-full max-h-[90vh] object-contain" />
                    )}
                </DialogContent>
            </Dialog>
        </>
    )
}
