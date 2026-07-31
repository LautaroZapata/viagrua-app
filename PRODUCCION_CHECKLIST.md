# Checklist para salir a producción

> Cosas que faltan además del diseño del producto/negocio.
> Prioridad: 🔴 crítica | 🟡 importante | 🟢 nice to have

---

## ⚠️ Pendiente de tu lado

Hay código en el repo que no hace nada hasta que cargues estas credenciales.
Todo degrada solo (la app funciona sin ellas), así que nada de esto rompe el
deploy si falta — pero tampoco protege nada.

**1. Secrets de GitHub** — ✅ **hecho** (29/07/2026). Los tres cargados y
verificados con una corrida real del workflow:

| Secret | De dónde sale |
|---|---|
| `SUPABASE_DB_URL` | Supabase → Project Settings → Database → Connection string → **Session pooler** (no la directa: es IPv6 y los runners de GitHub son IPv4) |
| `SUPABASE_URL` | `https://<ref>.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Project Settings → API → `service_role` |

Ojo con el primero: es una cadena `postgresql://`, no la URL `https://` del
proyecto. Confundirlas hace fallar el dump con un error poco claro.

**2. Sentry** — ✅ **hecho** (30/07/2026). Proyecto creado y
`NEXT_PUBLIC_SENTRY_DSN` cargado en Vercel. Verificado de punta a punta: un
error lanzado desde el navegador llega al dashboard (`envelope` → 200).

`SENTRY_ORG`, `SENTRY_PROJECT` y `SENTRY_AUTH_TOKEN` siguen sin cargar. Son
opcionales: suben source maps, sin ellos los stack traces llegan minificados.
Requiere `pnpm approve-builds` una vez.

**3. reCAPTCHA** — ✅ **hecho** (30/07/2026). Las dos keys cargadas en Vercel y
verificadas contra producción: un POST a `/api/registro` sin token devuelve
**403**. El chequeo del secret va antes que el del token en `lib/recaptcha.ts`,
así que un 403 prueba que la key está cargada y aplicando.

Pendiente menor: en la [consola de reCAPTCHA](https://www.google.com/recaptcha/admin)
la key valida `via-grua.vercel.app`. Los preview de Vercel usan otro hostname, así
que ahí Google rechaza todos los tokens y **el registro y `/unirse` fallan en
preview** (el login no: ahí el token es opcional a propósito).

**4. Migración `20260808_backups_bucket.sql`** — ✅ **aplicada** (30/07/2026).
Las 17 migraciones locales están registradas en producción. Verificado además
contra la API de Storage: `backups` quedó privado, 50 MB, `application/gzip`.

---

## 1. Monitoreo & Observabilidad

- [x] **🔴 Error tracking** (Sentry) — `instrumentation.ts` (servidor + edge),
      `instrumentation-client.ts` (navegador), `onRequestError` y
      `global-error.tsx`. Configuración compartida en `sentry.opciones.ts`.
      DSN cargado y **verificado**: un error del navegador llega al dashboard.
  - **Los bloqueadores cortan los eventos del navegador.** Brave Shields bloquea
    `sentry.io` **por defecto** — no hace falta instalar nada — y uBlock/AdGuard
    también. En esos navegadores el `envelope` sale con `(blocked:other)` y el
    error nunca llega. Se pierde una porción real de los errores del cliente,
    que son justo los que más importan acá.
  - Los del servidor no se ven afectados: `instrumentation.ts` y `onRequestError`
    mandan desde Vercel, sin navegador en el medio.
  - Se puede recuperar con `tunnelRoute` en `next.config.js`: el SDK manda a una
    ruta del dominio propio y Next reenvía, así el bloqueador no la reconoce.
    Cuesta una función serverless por evento y deja esa ruta abierta sin auth.
    **Sin decidir**: no se aplicó, queda a la vista si aparece la necesidad.
  - `sendDefaultPii: false` + scrub de `cookie`/`authorization` en `beforeSend`:
    las cookies llevan el token de sesión de Supabase y no pueden salir del sistema.
  - Tracing apagado (`tracesSampleRate: 0`). El plan gratis reparte una sola
    cuota entre errores y spans, y un traslado con fotos genera muchísimos más
    spans que errores.
  - Costo medido: **+68 KB gzip** en el cliente (553 → 622 KB). Se paga porque
    los errores que importan son los que le explotan al chofer en el celular.
    `bundleSizeOptimizations` de Sentry los bajaría, pero es webpack-only y
    Next 16 buildea con Turbopack — ver la nota en `next.config.js`.
- [ ] **🟡 Performance monitoring** — Vercel Analytics, Web Vitals (LCP, CLS, INP)
- [ ] **🟡 Logging estructurado server-side** — hoy es todo `console.error`/`console.warn`
- [ ] **🟢 Uptime monitoring** — Better Uptime, Pingdom, o similar
- [ ] **🟢 Dashboard de métricas de negocio** — DAU, empresas activas, traslados/día

## 2. Seguridad

- [x] **🔴 reCAPTCHA v3 en registro, login y unirse** — `lib/recaptcha.ts`
      (servidor) y `lib/recaptchaCliente.ts` (navegador). Keys cargadas en Vercel
      y **verificadas**: `/api/registro` sin token devuelve 403.
  - El token viaja en el header `X-Recaptcha-Token` y no en el body: mide ~1900
    caracteres y las rutas de auth cortan el body en 2000 (`MAX_BODY_SIZE`).
  - Se valida `score >= 0.5` (ajustable con `RECAPTCHA_MIN_SCORE`) **y** que la
    acción coincida, para que un token del formulario de alta no sirva para
    martillar el login.
  - **Token obligatorio en registro y unirse, opcional en login.** Un bloqueador
    de publicidad corta `google.com/recaptcha`; dejar sin login a un chofer a las
    3 de la mañana es peor que el ataque del que protege, y ahí el rate limit de
    5 intentos por email cada 5 minutos ya frena el credential stuffing. En las
    rutas que crean cuentas el costo de equivocarse es al revés.
  - Si Google no responde, se deja pasar (mismo criterio que `rateLimit.ts`).
- [x] **🔴 Rate limiting en endpoints de auth** — ya estaba: `lib/rateLimit.ts`
      con contador en Postgres (no en memoria: en serverless cada instancia
      tiene la suya), aplicado en login, registro, unirse y validar-invitación.
- [ ] **🟡 CSP nonce** — hecho pero **en modo reporte**. Falta recorrer el
      dashboard con la consola abierta, confirmar que no hay violaciones y
      poner `CSP_ENFORCE=1`. La política ahora se arma en `lib/csp.ts` y está
      cubierta por tests.
- [ ] **🟡 Dependabot / Snyk** — escaneo automático de vulnerabilidades en dependencias
- [ ] **🟢 Secrets scanning** — evitar commiteos accidentales de `.env.*`
- [ ] **🟢 2FA / MFA** — para admins

## 3. Testing

- [x] **🔴 E2E del flujo crítico** (Playwright) — **pasa entero**, 27s.
      Corrido dos veces seguidas para descartar que fuera flaky.
  - Registro de empresa → invitación → alta del chofer → login admin → crear
    traslado → cambiar estado → login chofer → completar.
  - Corre contra Supabase local, nunca contra producción. **Cuatro frenos
    independientes**: `e2e-preparar.mjs` valida al escribir `.env.e2e`,
    `e2e-con-env.mjs` valida al usarlo, el `globalSetup` valida antes de borrar
    `rate_limits`, y las variables inyectadas le ganan a `.env.local` en la
    precedencia de Next. Cubierto por tests.
  - Puerto **3100** y `reuseExistingServer: false`. Con el 3000 y reuse,
    Playwright agarró otra app que corría en la misma máquina y ejecutó el flujo
    contra ella; falló por un selector, que despista. No puede repetirse.
  - Sirve el build de producción (`next start`), no `next dev`: dev con
    Turbopack levanta un watcher y varios hijos, y una corrida cortada deja
    huérfanos.
  - reCAPTCHA se saltea solo cuando no hay `RECAPTCHA_SECRET_KEY`, así que el
    entorno de test no necesita keys ni mockear a Google.
  - El `globalSetup` vacía `rate_limits` antes de correr: `/api/registro` admite
    5 altas por hora y por IP, y a partir de la sexta corrida el test fallaba
    como si fuera flaky cuando era el cupo funcionando bien.
  - El chofer se elige **por nombre y no por índice**: el select lista todos los
    perfiles de la empresa, el admin incluido, y elegir por índice dejaba el
    traslado asignado al admin. No fallaba ahí sino dos pasos después, cuando el
    chofer no veía nada. Hay una aserción que ahora lo agarra en el momento.
  - **Encontró tres bugs reales de la app**: el trigger `on_auth_user_created`
    que faltaba en el repo y en los backups, la CSP que bloqueaba el cliente de
    Supabase en local, y las migraciones que no aplicaban desde cero.
  - `pnpm test:e2e` hace todo: prepara, buildea y corre.
- [x] Tests unitarios: **201** en 13 archivos. Se sumaron los de reCAPTCHA (12),
      CSP (17), backup a storage (6), backup de fotos (9), verificación del
      restore (12) y el freno de los E2E (5).
- [ ] **🟡 Integration tests de API routes** — hoy solo `gastos-route.test.ts`
- [ ] **🟡 Component tests** — con Vitest + Testing Library
- [ ] **🟢 Cobertura mínima** — definir threshold y medir en CI

## 4. Base de datos & Backup

- [x] **🔴 El repo reconstruye la base** — antes no: `supabase start` sobre una
      base vacía moría en la séptima migración. Producción se armó a mano desde
      el dashboard y las migraciones se escribieron encima, así que ninguna se
      había ejecutado nunca contra una base limpia.
  - `00001_initial_schema.sql` ahora **es el schema real de producción**, sacado
    del `schema.sql` del backup diario. Antes era ficticio: nombraba
    `get_user_empresa_id()` donde producción tiene `get_empresa_id()`, le
    faltaban las cuatro columnas `foto_*` y le sobraban `fotos_urls`,
    `fecha_carga`, `kilometros_previstos` y `updated_at`.
  - Las 13 migraciones que ese baseline ya contiene se movieron a
    `supabase/historico/` con `git mv`. Quedan activas las de storage
    (`20260806`–`20260808`), porque `pg_dump` del schema `public` no incluye
    buckets ni policies de `storage.objects`.
  - Producción tiene las 17 registradas y el repo 4: `supabase migration list`
    muestra 13 entradas solo-remotas. Es cosmético; `db push` de migraciones
    nuevas (timestamp posterior a `20260809`) funciona igual.
  - Verificado contra un Postgres limpio: **10 tablas, 22 policies, 11 funciones,
    11 claves foráneas** — los mismos números que producción.
- [x] **🔴 Trigger `on_auth_user_created`** (`20260809_trigger_perfil_nuevo.sql`)
  - `handle_new_user()` estaba en el repo desde `20260729`, pero **el trigger que
    la dispara no**: se creó a mano en el dashboard y nunca quedó en una
    migración.
  - **Esto también faltaba en los backups.** `supabase db dump` vuelca el schema
    `public`, y un trigger sobre `auth.users` no es parte de `public`. Restaurar
    un backup dejaba la app sin poder dar de alta a nadie: el registro crea el
    usuario y la empresa, no crea el perfil, y no muestra ningún error.
  - Apareció en los E2E, donde el alta terminaba con 1 usuario, 1 empresa y 0
    perfiles.
  - **Falta aplicarla en producción** (`supabase db push`). Es idempotente: allá
    el trigger ya existe, así que no cambia el comportamiento — solo deja el
    repo y los backups completos.

- [x] **🔴 Backup técnico (pg_dump)** — `.github/workflows/backup.yml`, diario a
      las 06:00 UTC (03:00 ART). Secrets cargados y **verificado con una corrida
      real**: 2373 filas, 922 traslados, `auth.users` incluido.
  - **GitHub Actions, no Vercel Cron.** El runtime de Vercel no trae el binario
    `pg_dump` y el dump tendría que terminar dentro del límite de una función.
  - Vuelca roles + schema + datos con el CLI de Supabase, los comprime en un
    `.tar.gz` y los sube al bucket privado `backups`. Retención 30 días.
  - Verifica el dump antes de subirlo: si `schema.sql` no tiene un `CREATE TABLE`
    o `data.sql` no tiene un `COPY`, el workflow falla. Un backup vacío que se
    sube en verde recién se descubre el día que hay que restaurar.
  - La poda nunca borra los 7 más nuevos, pase lo que pase con las fechas.
  - **Techo de 50 MB por archivo** (límite del plan actual de Supabase). Hoy
    sobra, y el workflow avisa a partir de 40 MB.
  - Restaurar: bajar el `.tar.gz` y aplicar `roles.sql`, `schema.sql`,
    `data.sql` en ese orden sobre un proyecto vacío.
- [x] **🔴 Backup de las fotos** — `scripts/backup-fotos.mjs`, mismo workflow.
  - `pg_dump` **no guarda archivos**: guarda las filas de `storage.objects`, que
    dicen qué foto va con qué traslado, pero no los bytes. Restaurar solo el
    dump dejaba 922 traslados con sus fotos listadas y ningún archivo detrás.
    Hasta la migración de Cloudinary (`74e60fa`) ese servicio era una segunda
    copia de hecho; desde entonces el bucket es la única.
  - Copia `fotos-traslados` → `backups/fotos/` del lado del servidor (endpoint
    `object/copy`), así los bytes no pasan por el runner. Si la instalación de
    Storage no soporta copia entre buckets, baja y sube.
  - Incremental: compara por ruta completa y copia solo lo que falta. Las fotos
    están aisladas por empresa y `frontal.jpg` se repite en todas, así que
    comparar por nombre de archivo dejaría sin copia a todas menos una.
  - Tope de 2000 por corrida (`FOTOS_MAX_POR_CORRIDA`). Un bucket que creció
    mucho avanza un pedazo por día en vez de pasarse del límite del job y no
    dejar nada.
  - Primera corrida: 528 fotos copiadas, verificadas byte a byte contra el
    original. La poda de dumps no toca el prefijo `fotos/`.
- [x] **🔴 Probar el restore** — `.github/workflows/restore-test.yml`, a mano.
  - Probado el 29/07/2026 sobre un Postgres 17.6 descartable con la misma
    imagen que usa Supabase. **Las 10 tablas de `public` restauran exactas**:
    922 traslados, 724 fotos_urls_respaldo, 139 gastos, 22 policies de RLS en 8
    tablas, 11 funciones, 11 claves foráneas.
  - Tres frenos antes de escribir una fila: hay que tipear `restaurar`, se aborta
    si el destino contiene el ref de producción (sale de `SUPABASE_URL`, no está
    escrito en el workflow) y se aborta si el destino tiene alguna tabla en
    `public`.
  - **`roles.sql` falla parcialmente y es esperable**: `supabase_admin` es un rol
    reservado que solo un superusuario puede modificar. No es lo que el backup
    prueba, así que se aplica sin `ON_ERROR_STOP` y queda en el log.
  - **Los datos de `auth` y `storage` dependen de que el destino tenga la misma
    versión de esos schemas.** `supabase db dump` no incluye su DDL en
    `schema.sql` porque los gestiona Supabase, pero sí sus datos en `data.sql`.
    Contra una imagen más vieja fallaron 29 `COPY` (`auth.users` entre ellos).
    En un proyecto Supabase recién creado no debería pasar; contra uno viejo, sí.
  - **`data.sql` arranca con `SET session_replication_role = replica`**, que apaga
    la comprobación de claves foráneas durante la carga. Es lo correcto para
    cargar un dump, pero significa que un restore puede terminar en verde con
    filas huérfanas: en la prueba entraron 5 `perfiles` y 4 `audit_log`
    apuntando a un `auth.users` vacío, sin un solo error.
  - Por eso el workflow corre `scripts/verificar-integridad.sql` al final, que
    recorre `pg_constraint` y falla si alguna FK quedó apuntando al vacío. Es lo
    que convierte "psql no se quejó" en "el restore sirve".
  - Falta el secret `SUPABASE_RESTORE_DB_URL` para poder correrlo en CI: tiene
    que ser el **Session pooler** del proyecto descartable, no la conexión
    directa (`db.<ref>.supabase.co` es IPv6 y los runners son IPv4).
- [ ] **🟡 Análisis de queries lentas** — revisar `pg_stat_statements`, ver si faltan índices
- [ ] **🟢 Database branching para PRs** — preview branches con datos reales

## 5. Legal & Compliance

- [x] **🔴 Términos de Servicio** (`/terminos`)
- [x] **🔴 Política de Privacidad** (`/privacidad`)
- [x] Aviso de reCAPTCHA en los tres formularios — no es decorativo: los términos
      de Google permiten esconder el badge flotante solo si aparece esa leyenda
      con los dos links (`app/components/AvisoRecaptcha.tsx`).
- [ ] **🟡 Cookie consent banner** — aunque no haya cookies de tracking, es buena práctica
- [ ] **🟡 GDPR compliance** — derecho al olvido (eliminar cuenta + datos), portabilidad
- [ ] **🟡 Términos específicos para choferes** — son usuarios con otro rol
- [ ] **🟢 Data Processing Agreement (DPA)** — si algún cliente lo pide

## 6. Notificaciones

- [ ] **🟡 Emails transaccionales** (Resend, SendGrid, o similar):
  - Notificar chofer cuando se le asigna un traslado
  - Notificar admin cuando un chofer cambia estado
  - Bienvenida al registrarse
  - Recordatorio de pago / suscripción
- [ ] **🟢 Push notifications** (Web Push) — para los que tengan la app instalada como PWA
- [ ] **🟢 WhatsApp / SMS** — avisos críticos a choferes

## 7. Developer Experience

- [ ] **🟡 Prettier** — formato consistente (hoy no hay)
- [ ] **🟡 Husky + lint-staged** — pre-commit hooks (lint + typecheck antes de commitear)
- [ ] **🟢 Conventional commits** — changelog automático
- [ ] **🟢 Storybook** — catálogo de componentes UI

## 8. UX

- [ ] **🟡 Onboarding tutorial interactivo** — guía al admin los primeros pasos
- [ ] **🟡 FAQ / Centro de ayuda** — dentro de la app
- [ ] **🟡 Contacto / soporte** — formulario o link a WhatsApp
- [ ] **🟢 Changelog / novedades** — pantalla de "qué cambió" después de actualizar

## 9. Infraestructura

- [ ] **🟡 Staging environment** — deploy automático a preview branch por PR
- [ ] **🟡 vercel.json** — rewrites y redirects (hoy no existe). Los cron jobs ya
      no lo necesitan: el backup corre en GitHub Actions.
- [ ] **🟢 Docker / docker-compose** — para desarrollo local reproducible
- [ ] **🟢 Feature flags** — activar/desactivar funcionalidades sin deploy

## 10. Monetización (cuando definas el producto)

- [ ] **MercadoPago integración** — los campos existen en schema pero no hay webhooks ni lógica
- [ ] **Sistema de planes** — tabla `planes` existe, límites por plan no implementados
- [ ] **Facturación / recibos**
- [ ] **Webhooks para conciliación**

---

## Qué sigue

### 🔴 Bloqueante, y es rápido

1. **Aplicar `20260809_trigger_perfil_nuevo.sql`** con `supabase db push`. En
   producción no cambia nada —el trigger ya está— pero deja el repo y, sobre
   todo, **los backups** completos. Hoy un restore da una app donde nadie más
   puede registrarse.

### 🔴 Tuyo, necesita el navegador

2. **CSP a bloqueante.** Con el dashboard abierto y la consola, mirar el header
   de la primera request: si dice `Content-Security-Policy-Report-Only`, hace
   falta redeploy para que tome `CSP_ENFORCE=1`; si dice
   `Content-Security-Policy` a secas, ya está listo y no hay nada que hacer.

### 🟡 Lo próximo que mueve la aguja

3. **Emails transaccionales** — hoy el chofer no se entera de que le asignaron
   un traslado si no abre la app.

4. **El E2E en CI.** Hoy corre a mano con `pnpm test:e2e`. Los runners de GitHub
   traen Docker, así que `supabase start` funciona igual; falta el workflow y
   decidir si va en cada push (~3 min) o solo en PR.

### Opcionales

- `SUPABASE_RESTORE_DB_URL` para correr el restore desde Actions y no a mano.
- `SENTRY_AUTH_TOKEN` y compañía, para dejar de leer stack traces minificados.
- `tunnelRoute` de Sentry, si el volumen de errores del cliente justifica
  esquivar los bloqueadores.
- Los dominios de preview en la consola de reCAPTCHA, si molesta que el alta
  falle ahí.

---

**Lo que ya no es un riesgo:** el backup corre solo por cron (primera corrida sin
intervención: 30/07 08:30 UTC), incluye base y fotos, el restore está probado
sobre un Postgres limpio, y ahora además el repo reconstruye la base por su
cuenta. Son dos vías de recuperación independientes y las dos verificadas.
