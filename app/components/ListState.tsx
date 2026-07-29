'use client'
import { Inbox, AlertTriangle, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'

interface ListStateProps {
  isLoading: boolean
  error?: unknown
  isEmpty: boolean
  emptyMessage: string
  emptyIcon?: React.ReactNode
  /** Accion sugerida cuando no hay nada todavia, para no dejar un callejon sin salida. */
  emptyAction?: React.ReactNode
  onRetry?: () => void
  /** Cuantas filas fantasma dibujar mientras carga. */
  skeletonRows?: number
  children: React.ReactNode
}

/**
 * Resuelve los tres estados de una lista: cargando, error y vacia.
 *
 * Antes ninguna pagina leia isLoading ni error de SWR: solo se destructuraba
 * data con `?? []`. Eso hacia que el primer paint de una cuenta CON datos
 * dijera "No hay traslados registrados" y despues saltara a la lista, y que un
 * fetch fallido se viera exactamente igual que una cuenta vacia.
 */
export default function ListState({
  isLoading,
  error,
  isEmpty,
  emptyMessage,
  emptyIcon,
  emptyAction,
  onRetry,
  skeletonRows = 5,
  children,
}: ListStateProps) {
  if (isLoading) {
    return (
      <div className="space-y-2" aria-busy="true" aria-live="polite">
        <span className="sr-only">Cargando…</span>
        {Array.from({ length: skeletonRows }).map((_, i) => (
          <Skeleton key={i} className="h-[72px] w-full rounded-lg" />
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-center py-12 sm:py-16" role="alert">
        <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-4">
          <AlertTriangle className="w-8 h-8 text-destructive" />
        </div>
        <p className="text-foreground text-sm sm:text-base font-medium mb-1">
          No se pudieron cargar los datos
        </p>
        <p className="text-muted-foreground text-sm mb-4">
          Revisá tu conexión e intentá de nuevo.
        </p>
        {onRetry && (
          <Button variant="outline" size="sm" onClick={onRetry}>
            <RefreshCw className="size-4 mr-1.5" />
            Reintentar
          </Button>
        )}
      </div>
    )
  }

  if (isEmpty) {
    return (
      <div className="text-center py-12 sm:py-16">
        <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
          {emptyIcon || <Inbox className="w-8 h-8 text-muted-foreground" />}
        </div>
        <p className="text-muted-foreground text-sm sm:text-base">{emptyMessage}</p>
        {emptyAction && <div className="mt-5">{emptyAction}</div>}
      </div>
    )
  }

  return <>{children}</>
}
