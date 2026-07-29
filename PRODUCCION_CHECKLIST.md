# Checklist para salir a producción

> Cosas que faltan además del diseño del producto/negocio.
> Prioridad: 🔴 crítica | 🟡 importante | 🟢 nice to have

---

## ⚠️ Pendiente de tu lado

Hay código en el repo que no hace nada hasta que cargues estas credenciales.
Todo degrada solo (la app funciona sin ellas), así que nada de esto rompe el
deploy si falta — pero tampoco protege nada.

**1. Secrets de GitHub** (Settings → Secrets and variables → Actions) — sin esto
no corre ni un backup:

| Secret | De dónde sale |
|---|---|
| `SUPABASE_DB_URL` | Supabase → Project Settings → Database → Connection string → **Session pooler** (no la directa: es IPv6 y los runners de GitHub son IPv4) |
| `SUPABASE_URL` | `https://<ref>.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Project Settings → API → `service_role` |

Después: Actions → Backup → *Run workflow*, para no esperar al cron y confirmar
que el primer dump sube bien.

**2. Sentry** — crear proyecto (plan gratis) y cargar en Vercel:

| Variable | Nota |
|---|---|
| `NEXT_PUBLIC_SENTRY_DSN` | Sin esto, Sentry no arranca y no reporta nada |
| `SENTRY_ORG`, `SENTRY_PROJECT`, `SENTRY_AUTH_TOKEN` | Opcionales. Suben source maps: sin ellos los stack traces llegan minificados. Requiere `pnpm approve-builds` una vez |

**3. reCAPTCHA** — las keys ya existen en `.env.local` (verificadas: son **v3**).
Falta cargarlas en Vercel:

- `NEXT_PUBLIC_RECAPTCHA_SITE_KEY` y `RECAPTCHA_SECRET_KEY`
- En la [consola de reCAPTCHA](https://www.google.com/recaptcha/admin), agregar
  los dominios del deploy. Hoy la key valida `via-grua.vercel.app`; los preview
  de Vercel usan otro hostname y ahí Google va a rechazar todos los tokens.

**4. Migración `20260808_backups_bucket.sql`** — el bucket `backups` ya está
creado en producción (se creó y verificó vía API de Storage). La migración es
idempotente y existe para que un proyecto nuevo quede igual; aplicala cuando
corras el resto de las migraciones pendientes.

---

## 1. Monitoreo & Observabilidad

- [x] **🔴 Error tracking** (Sentry) — `instrumentation.ts` (servidor + edge),
      `instrumentation-client.ts` (navegador), `onRequestError` y
      `global-error.tsx`. Configuración compartida en `sentry.opciones.ts`.
      **Falta el DSN** (ver arriba).
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
      (servidor) y `lib/recaptchaCliente.ts` (navegador). **Faltan las keys en
      Vercel** (ver arriba).
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
      las 06:00 UTC (03:00 ART). **Faltan los secrets** (ver arriba).
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

Los cinco 🔴 del plan original están cerrados salvo el E2E. En orden:

1. **Cargar las credenciales de la sección de arriba.** Hasta que no estén, el
   backup no corre y ni Sentry ni reCAPTCHA hacen nada.
2. **Correr el backup a mano una vez** y bajar el `.tar.gz` para confirmar que
   se puede restaurar. Un backup que nunca se probó no es un backup.
3. **Pasar la CSP a bloqueante** (`CSP_ENFORCE=1`) después de recorrer el
   dashboard sin violaciones en consola.
4. **E2E del flujo crítico** contra Supabase local.
5. **Emails transaccionales** — hoy el chofer no se entera de que le asignaron
   un traslado si no abre la app.
