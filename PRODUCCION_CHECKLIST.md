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

- [ ] **🔴 E2E del flujo crítico** (Playwright):
  - Registro de empresa → login admin → crear traslado → cambiar estado → login chofer → completar traslado
  - **Decidido: contra Supabase local (`supabase start`), nunca contra
    producción.** Un familiar usa la app con datos reales; un test que siembra y
    borra no puede correr ahí. Local levanta Postgres en Docker con las
    migraciones de `supabase/migrations`, y el mismo comando sirve en CI.
    Requiere Docker instalado.
  - Ojo al armarlo: reCAPTCHA se saltea solo cuando no hay `RECAPTCHA_SECRET_KEY`,
    así que el entorno de test no necesita keys ni mockear a Google.
- [x] Tests de lo agregado en esta tanda: `lib/__tests__/recaptcha.test.ts` (12),
      `lib/__tests__/csp.test.ts` (13), `scripts/__tests__/backup-storage.test.ts` (6).
      Total del repo: **171 tests**.
- [ ] **🟡 Integration tests de API routes** — hoy solo `gastos-route.test.ts`
- [ ] **🟡 Component tests** — con Vitest + Testing Library
- [ ] **🟢 Cobertura mínima** — definir threshold y medir en CI

## 4. Base de datos & Backup

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
  - Restaurar: bajar el `.tar.gz` y aplicar `roles.sql`, `schema.sql` y
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

Los cinco 🔴 del plan original están cerrados salvo el E2E. El backup corre solo
(primera corrida por cron sin intervención: 30/07 08:30 UTC), el restore está
probado, las migraciones aplicadas y Sentry y reCAPTCHA verificados contra
producción. Lo que queda, en orden:

1. **Pasar la CSP a bloqueante** (`CSP_ENFORCE=1`) después de recorrer el
   dashboard logueado sin violaciones en consola. Es lo único que exige estar
   adentro de la app para verificarlo.
2. **E2E del flujo crítico** contra Supabase local. Último 🔴 abierto.
3. **Emails transaccionales** — hoy el chofer no se entera de que le asignaron
   un traslado si no abre la app.

Opcionales, cuando haya ganas:
- `SUPABASE_RESTORE_DB_URL` para correr el restore desde Actions y no a mano.
- `SENTRY_AUTH_TOKEN` y compañía, para dejar de leer stack traces minificados.
- Los dominios de preview en la consola de reCAPTCHA, si molesta que el alta
  falle ahí.
