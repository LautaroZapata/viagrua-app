'use client'
import { AlertTriangle } from 'lucide-react'

export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
    return (
        <div className="min-h-screen bg-background flex items-center justify-center p-4">
            <div className="text-center max-w-sm">
                <div className="w-16 h-16 mx-auto mb-4 bg-destructive/10 rounded-full flex items-center justify-center">
                    <AlertTriangle className="w-8 h-8 text-destructive" />
                </div>
                <h1 className="text-2xl font-bold text-foreground mb-2">Algo salio mal</h1>
                <p className="text-sm text-muted-foreground mb-6">Ha ocurrido un error inesperado.</p>
                <button onClick={reset}
                    className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition">
                    Intentar de nuevo
                </button>
            </div>
        </div>
    )
}
