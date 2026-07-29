/**
 * Opciones compartidas por los tres puntos donde arranca Sentry: navegador,
 * servidor Node y runtime edge.
 *
 * Vive en la raiz, al lado de los sentry.*.config.ts, porque esos archivos los
 * carga el bundler de Sentry por convencion de nombre y conviene tenerlos
 * juntos.
 */
import type { ErrorEvent } from '@sentry/nextjs'

/**
 * Sin DSN, Sentry no arranca y no hay ningun costo en runtime.
 *
 * Es a proposito que sea opcional: en local y en el build de CI no hay DSN, y
 * ninguno de los dos deberia mandar errores a un proyecto compartido ni fallar
 * por no tener la variable. En Vercel se carga NEXT_PUBLIC_SENTRY_DSN y ahi si
 * se activa.
 */
export const DSN = process.env.NEXT_PUBLIC_SENTRY_DSN ?? ''

export const SENTRY_ACTIVO = DSN.length > 0

/**
 * Con que etiqueta se agrupan los eventos en Sentry. VERCEL_ENV distingue
 * production de preview, cosa que NODE_ENV no hace: los dos son 'production'
 * para Next.
 */
const ENTORNO =
  process.env.NEXT_PUBLIC_VERCEL_ENV ?? process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? 'development'

export const opcionesComunes = {
  dsn: DSN,
  environment: ENTORNO,

  /**
   * Sin tracing.
   *
   * El plan gratis reparte un cupo mensual entre errores y spans, y un traslado
   * con fotos genera muchisimos mas spans que errores. Con tracing prendido, un
   * dia de uso normal se come el cupo y los errores —el motivo por el que se
   * sumo Sentry— empiezan a rebotar.
   *
   * La performance la mide Vercel Analytics, que es un item aparte del
   * checklist y no gasta de esta cuota.
   */
  tracesSampleRate: 0,

  /**
   * NO mandar datos personales.
   *
   * Con sendDefaultPii en true, Sentry adjunta IP, cookies y headers de cada
   * request. Las cookies incluyen el token de sesion de Supabase: cualquiera
   * con acceso al proyecto de Sentry podria tomar la sesion de un usuario. Y
   * los datos de esta app (choferes, empresas, patentes) son de terceros, no
   * nuestros.
   */
  sendDefaultPii: false,

  /**
   * Segunda barrera, por si algo se cuela igual.
   *
   * sendDefaultPii ya evita que se adjunten, pero un integration de terceros o
   * un captureException hecho a mano con el request encima pueden meterlos de
   * vuelta. Esto los borra justo antes de salir.
   */
  beforeSend(evento: ErrorEvent): ErrorEvent {
    if (evento.request) {
      delete evento.request.cookies
      if (evento.request.headers) {
        for (const header of ['cookie', 'authorization', 'apikey', 'x-forwarded-for']) {
          delete evento.request.headers[header]
        }
      }
    }
    return evento
  },

  /**
   * Ruido que no es un bug de la aplicacion y solo gasta cuota.
   *
   * Las extensiones del navegador y los errores de red del usuario aparecen en
   * cualquier proyecto web y no hay nada que arreglar del lado nuestro.
   */
  ignoreErrors: [
    'ResizeObserver loop completed with undelivered notifications',
    'ResizeObserver loop limit exceeded',
    'Non-Error promise rejection captured',
    'Failed to fetch',
    'NetworkError when attempting to fetch resource',
    'Load failed',
    'AbortError',
  ],
}
