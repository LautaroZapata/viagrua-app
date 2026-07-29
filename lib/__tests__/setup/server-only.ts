/**
 * Stub de `server-only` para los tests.
 *
 * Ese paquete no exporta nada: existe para que el build falle si un modulo de
 * servidor termina importado desde un componente cliente, y lo hace declarando
 * unicamente la condicion de exports "react-server". Vitest no resuelve bajo
 * esa condicion, asi que importar lib/recaptcha.ts o lib/rateLimit.ts en un
 * test explota con "Failed to resolve import server-only".
 *
 * vitest.config.ts lo aliasea a este archivo vacio. En el build de Next no
 * cambia nada: ahi se sigue usando el paquete real.
 */
export {}
