'use client'
import { Loader2 } from 'lucide-react'

interface LoadingSpinnerProps {
  message?: string
  submessage?: string
}

export default function LoadingSpinner({ message = 'Cargando', submessage = 'Verificando sesion y cargando datos...' }: LoadingSpinnerProps) {
  return (
    <div className="page-bg flex items-center justify-center min-h-screen">
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="w-16 h-16 text-primary animate-spin" />
        <div className="text-center">
          <p className="text-foreground font-semibold">{message}</p>
          <p className="text-muted-foreground text-sm">{submessage}</p>
        </div>
      </div>
    </div>
  )
}
