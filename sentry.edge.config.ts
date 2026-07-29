/**
 * Sentry en el runtime edge, que es donde corre proxy.ts. Lo carga
 * instrumentation.ts.
 */
import * as Sentry from '@sentry/nextjs'
import { SENTRY_ACTIVO, opcionesComunes } from './sentry.opciones'

if (SENTRY_ACTIVO) {
  Sentry.init(opcionesComunes)
}
