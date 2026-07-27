'use client'

import { useEffect, useState } from 'react'
import { AlertTriangle, HelpCircle } from 'lucide-react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { subscribeConfirm, type ConfirmRequest } from '@/lib/confirmStore'
import { cn } from '@/lib/utils'

type Pedido = ConfirmRequest & { resolve: (ok: boolean) => void }

/**
 * Modal de confirmacion global. Se monta una sola vez en el layout raiz y
 * atiende los pedidos de confirmDelete/confirmAction.
 *
 * Antes esto era un toast en la esquina con dos botones chiquitos: se perdia
 * entre el resto de la UI y no bloqueaba nada. Un modal centrado con foco
 * atrapado obliga a decidir, que es justamente el punto de confirmar.
 */
export default function ConfirmDialog() {
  const [pedido, setPedido] = useState<Pedido | null>(null)

  useEffect(() => subscribeConfirm(setPedido), [])

  const abierto = pedido !== null
  const destructivo = pedido?.tone === 'destructive'

  // Radix anima el cierre: resolvemos al confirmar/cancelar, no al desmontar.
  const cerrar = (ok: boolean) => pedido?.resolve(ok)

  return (
    <AlertDialog open={abierto} onOpenChange={(open) => { if (!open) cerrar(false) }}>
      <AlertDialogContent className="pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        <AlertDialogHeader>
          <AlertDialogMedia
            className={cn(
              destructivo
                ? 'bg-destructive/10 text-destructive'
                : 'bg-primary/10 text-primary',
            )}
          >
            {destructivo ? <AlertTriangle /> : <HelpCircle />}
          </AlertDialogMedia>
          <AlertDialogTitle className="font-display text-xl">
            {pedido?.title}
          </AlertDialogTitle>
          <AlertDialogDescription className="text-base">
            {pedido?.text}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => cerrar(false)}>
            {pedido?.cancelButtonText}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={() => cerrar(true)}
            className={cn(
              destructivo &&
                'bg-destructive text-white hover:bg-destructive/90 focus-visible:ring-destructive/30',
            )}
          >
            {pedido?.confirmButtonText}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
