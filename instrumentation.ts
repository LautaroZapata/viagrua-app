import * as Sentry from '@sentry/nextjs'

/**
 * Next llama a register() una vez por runtime, antes de atender el primer
 * request. Es el unico lugar desde donde se puede inicializar Sentry del lado
 * del servidor: importar la config desde un layout llegaria tarde y se perderia
 * todo lo que falle durante el arranque.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./sentry.server.config')
  }

  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('./sentry.edge.config')
  }
}

/**
 * Sin este hook, los errores que Next atrapa para renderizar error.tsx nunca
 * llegan a Sentry: el framework los maneja y devuelve la pantalla de error, asi
 * que no hay excepcion que burbujee hasta ningun try/catch nuestro.
 */
export const onRequestError = Sentry.captureRequestError
