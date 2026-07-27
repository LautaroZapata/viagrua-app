/**
 * Store minimo para pedir confirmacion desde cualquier lado sin prop drilling
 * ni hooks. `lib/swal.ts` publica el pedido, `app/components/ConfirmDialog.tsx`
 * lo renderiza como modal centrado y resuelve la promesa.
 */

export type ConfirmTone = 'destructive' | 'default'

export interface ConfirmRequest {
  title: string
  text: string
  confirmButtonText: string
  cancelButtonText: string
  tone: ConfirmTone
}

type Listener = (request: (ConfirmRequest & { resolve: (ok: boolean) => void }) | null) => void

let listener: Listener | null = null
let pendiente: (ConfirmRequest & { resolve: (ok: boolean) => void }) | null = null

/** Lo usa el provider al montarse. Devuelve la funcion de limpieza. */
export function subscribeConfirm(fn: Listener): () => void {
  listener = fn
  // Si alguien pidio confirmacion antes de que montara el provider, no se pierde.
  if (pendiente) fn(pendiente)
  return () => {
    if (listener === fn) listener = null
  }
}

export function requestConfirm(request: ConfirmRequest): Promise<boolean> {
  return new Promise((resolve) => {
    // Sin provider montado no se puede confirmar nada: se cancela en vez de
    // colgar la promesa para siempre.
    if (!listener) {
      resolve(false)
      return
    }

    pendiente = {
      ...request,
      resolve: (ok: boolean) => {
        pendiente = null
        listener?.(null)
        resolve(ok)
      },
    }
    listener(pendiente)
  })
}
