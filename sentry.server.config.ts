/**
 * Sentry en el servidor Node: route handlers, Server Components y el render de
 * las paginas. Lo carga instrumentation.ts.
 */
import * as Sentry from '@sentry/nextjs'
import { SENTRY_ACTIVO, opcionesComunes } from './sentry.opciones'

if (SENTRY_ACTIVO) {
  Sentry.init(opcionesComunes)
}
