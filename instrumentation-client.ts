/**
 * Sentry en el navegador. Next carga este archivo por convencion de nombre,
 * antes de hidratar.
 *
 * No se agrega replayIntegration a proposito: Session Replay graba el DOM del
 * usuario y son ~50 KB extra en el bundle. En esta app el DOM que se grabaria
 * tiene datos de clientes y patentes de terceros, y el bundle es algo que ya se
 * cuido (por eso zod salio del cliente en 2f54537).
 */
import * as Sentry from '@sentry/nextjs'
import { SENTRY_ACTIVO, opcionesComunes } from './sentry.opciones'

if (SENTRY_ACTIVO) {
  Sentry.init(opcionesComunes)
}

/**
 * Marca el inicio de cada navegacion del App Router. Sin esto, un error que
 * ocurre durante una transicion no queda asociado a la ruta a la que se estaba
 * yendo, sino a la anterior.
 */
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart
